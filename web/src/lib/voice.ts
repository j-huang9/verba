// The patient's own voice: turn a family video or voice memo into a Cartesia clone, then
// cache every phrase in that voice on the phone so talking never waits on the network.
//   toWav(file) -> cloneVoice(wav, name) -> buildBank(patientId, voiceId) -> voiceUrl(patient, id)
// The API key stays on the server (api/clone.ts, api/tts.ts).
import { PHRASES } from './phrases'
import { getPatient, updatePatient, type Patient } from './store'

const RATE = 22050
const MAX_SECONDS = 45 // keeps the upload ~2 MB, under Vercel's 4.5 MB body limit
const BANK_CONCURRENCY = 3
const CACHE = 'silentvoice-voices-v1'

/** Decode any audio or video file the phone can play (iPhone .mov, .m4a, voice memos, webm),
 *  mix to mono, resample to 22.05 kHz, keep the first 45 s, and encode 16-bit WAV. */
export async function toWav(file: Blob): Promise<{ wav: Blob; seconds: number }> {
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  const ctx = new Ctx()
  let decoded: AudioBuffer
  try {
    decoded = await ctx.decodeAudioData(await file.arrayBuffer())
  } catch {
    throw new Error('Couldn’t read the sound in that file. Try another video or a voice memo.')
  } finally {
    void ctx.close()
  }
  const seconds = Math.min(decoded.duration, MAX_SECONDS)
  const offline = new OfflineAudioContext(1, Math.max(1, Math.ceil(seconds * RATE)), RATE)
  const src = offline.createBufferSource()
  src.buffer = decoded // a 1-channel destination mixes every channel down to mono
  src.connect(offline.destination)
  src.start()
  const mono = (await offline.startRendering()).getChannelData(0)

  const view = new DataView(new ArrayBuffer(44 + mono.length * 2))
  const str = (o: number, s: string) => [...s].forEach((c, i) => view.setUint8(o + i, c.charCodeAt(0)))
  str(0, 'RIFF')
  view.setUint32(4, 36 + mono.length * 2, true)
  str(8, 'WAVE')
  str(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, RATE, true)
  view.setUint32(28, RATE * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  str(36, 'data')
  view.setUint32(40, mono.length * 2, true)
  for (let i = 0; i < mono.length; i++) {
    const v = Math.max(-1, Math.min(1, mono[i]))
    view.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true)
  }
  return { wav: new Blob([view.buffer], { type: 'audio/wav' }), seconds }
}

async function errorText(res: Response): Promise<string> {
  try {
    return ((await res.json()) as { error?: string }).error ?? `HTTP ${res.status}`
  } catch {
    return `HTTP ${res.status}`
  }
}

/** Creates the Cartesia clone. Returns the voice id. */
export async function cloneVoice(wav: Blob, name: string): Promise<string> {
  const form = new FormData()
  form.append('clip', wav, 'clip.wav')
  form.append('name', name)
  const res = await fetch('/api/clone', { method: 'POST', body: form })
  if (!res.ok) throw new Error(await errorText(res))
  return ((await res.json()) as { id: string }).id
}

/** One phrase in a cloned voice, straight from the server. */
export async function synthesize(voiceId: string, text: string): Promise<Blob> {
  const res = await fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ voiceId, text }),
  })
  if (!res.ok) throw new Error(await errorText(res))
  return res.blob()
}

// ---- the phrase bank: Cache Storage, with an in-memory fallback (private mode, no caches) ----

const memory = new Map<string, Blob>()
const keyFor = (voiceId: string, phraseId: string) => `/voice-bank/${voiceId}/${phraseId}.mp3`

async function openCache(): Promise<Cache | null> {
  try {
    return 'caches' in window ? await caches.open(CACHE) : null
  } catch {
    return null
  }
}

async function getCached(voiceId: string, phraseId: string): Promise<Blob | null> {
  const key = keyFor(voiceId, phraseId)
  const hit = memory.get(key)
  if (hit) return hit
  const res = await (await openCache())?.match(key).catch(() => undefined)
  return res ? res.blob() : null
}

async function putCached(voiceId: string, phraseId: string, blob: Blob) {
  const key = keyFor(voiceId, phraseId)
  memory.set(key, blob)
  try {
    await (await openCache())?.put(key, new Response(blob, { headers: { 'Content-Type': 'audio/mpeg' } }))
  } catch {
    // quota or blocked: the memory copy lasts for this session
  }
}

export interface BankProgress {
  done: number
  total: number
  /** set if a phrase failed; the rest keep going and talking falls back to live TTS */
  failed: number
}

const builds = new Map<string, Promise<BankProgress>>()
const watchers = new Map<string, Set<(p: BankProgress) => void>>()

/** Watch a patient's bank build (e.g. VoiceSetup's n/50). Returns an unsubscribe. */
export function onBankProgress(patientId: string, cb: (p: BankProgress) => void): () => void {
  const set = watchers.get(patientId) ?? new Set()
  watchers.set(patientId, set)
  set.add(cb)
  return () => set.delete(cb)
}

/**
 * Generates every phrase in the clone into Cache Storage, 3 at a time, core phrases first
 * (phrases.json order). Runs at module level, so it keeps going when the page changes, and
 * updates patient.voice.bank as it goes. Calling it again while it runs returns the same build.
 */
export function buildBank(patientId: string, voiceId: string, onProgress?: (p: BankProgress) => void): Promise<BankProgress> {
  const off = onProgress ? onBankProgress(patientId, onProgress) : null
  const key = `${patientId}:${voiceId}`
  let build = builds.get(key)
  if (!build) {
    build = runBank(patientId, voiceId).finally(() => builds.delete(key))
    builds.set(key, build)
  }
  return build.finally(() => off?.())
}

async function runBank(patientId: string, voiceId: string): Promise<BankProgress> {
  const progress: BankProgress = { done: 0, total: PHRASES.length, failed: 0 }
  const report = () => {
    const p = getPatient(patientId)
    if (p?.voice.voiceId === voiceId) updatePatient(patientId, (q) => ({ voice: { ...q.voice, bank: progress.done } }))
    watchers.get(patientId)?.forEach((cb) => cb({ ...progress }))
  }
  const queue = [...PHRASES]
  const worker = async () => {
    for (let phrase = queue.shift(); phrase; phrase = queue.shift()) {
      if (getPatient(patientId)?.voice.voiceId !== voiceId) return // voice changed or patient removed
      try {
        if (!(await getCached(voiceId, phrase.id))) await putCached(voiceId, phrase.id, await synthesize(voiceId, phrase.text))
        progress.done++
      } catch {
        progress.failed++
      }
      report()
    }
  }
  await Promise.all(Array.from({ length: BANK_CONCURRENCY }, worker))
  return progress
}

// ---- what talking plays ----

const urls = new Map<string, string>()

function blobUrl(key: string, blob: Blob): string {
  let url = urls.get(key)
  if (!url) {
    url = URL.createObjectURL(blob)
    urls.set(key, url)
  }
  return url
}

/**
 * The audio to play for a phrase, for speaker.speak(id, text, src):
 * - demo patients: the pre-generated /audio/<id>.mp3
 * - clones: the cached phrase, else live TTS (and cache it), else null
 * - device voice, or anything failing: null (speak() then uses the phone's voice)
 */
export async function voiceUrl(patient: Patient, phraseId: string): Promise<string | null> {
  const { kind, voiceId } = patient.voice
  if (kind === 'demo') return `/audio/${phraseId}.mp3`
  if (kind !== 'clone' || !voiceId) return null
  const key = keyFor(voiceId, phraseId)
  try {
    const cached = await getCached(voiceId, phraseId)
    if (cached) return blobUrl(key, cached)
    const text = PHRASES.find((p) => p.id === phraseId)?.text
    if (!text) return null
    const blob = await synthesize(voiceId, text)
    void putCached(voiceId, phraseId, blob)
    return blobUrl(key, blob)
  } catch {
    return null
  }
}
