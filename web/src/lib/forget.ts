// Delete a patient from this phone: their details, their conversation log and their cached
// cloned-voice phrases. The cache name and key format mirror lib/voice.ts (A's file):
// cache 'silentvoice-voices-v1', keys '/voice-bank/<voiceId>/<phraseId>.mp3'.
import { getLastPatient, setLastPatient } from './selection'
import { getPatient, getPatients, removePatient } from './store'

const VOICE_CACHE = 'silentvoice-voices-v1'

async function forgetVoice(voiceId: string) {
  try {
    if (!('caches' in window)) return
    const cache = await caches.open(VOICE_CACHE)
    const prefix = `/voice-bank/${voiceId}/`
    for (const req of await cache.keys()) if (new URL(req.url).pathname.startsWith(prefix)) await cache.delete(req)
  } catch {
    // blocked storage: nothing was cached
  }
}

export function deletePatient(id: string) {
  const voiceId = getPatient(id)?.voice.voiceId
  const others = getPatients().filter((p) => p.id !== id)
  removePatient(id) // also removes their log entries
  if (getLastPatient() === id) setLastPatient(null)
  // keep the clone if another patient on this phone uses the same voice
  if (voiceId && !others.some((p) => p.voice.voiceId === voiceId)) void forgetVoice(voiceId)
}

