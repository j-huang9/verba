// "Give them their voice": upload a family video or voice memo (or record them now), clone it
// with Cartesia, play a sample, then cache all phrases in that voice. Demo voice and the
// phone's own voice are one tap each. Used in the New patient flow and on #/p/:id/voice.
import { useEffect, useRef, useState } from 'react'
import { PHRASES } from '../lib/phrases'
import { unlockAudio, useSpeaker } from '../lib/speaker'
import { updatePatient, usePatient } from '../lib/store'
import { buildBank, cloneVoice, synthesize, toWav } from '../lib/voice'

const SAMPLE = 'Hi, it’s me. I can hear you.'
const RECORD_LIMIT_S = 60
const PASSAGE =
  'When the sunlight strikes raindrops in the air, they act as a prism and form a rainbow. ' +
  'The rainbow is a division of white light into many beautiful colors. ' +
  'These take the shape of a long round arch, with its path high above, ' +
  'and its two ends apparently beyond the horizon.'

type Source = 'upload' | 'record'
type Step =
  | { kind: 'choose' }
  | { kind: 'reading' }
  | { kind: 'record' }
  | { kind: 'preview'; wav: Blob; url: string; seconds: number; source: Source }
  | { kind: 'cloning' }
  | { kind: 'ready'; sample: string | null }
  | { kind: 'error'; message: string }

const primary = 'w-full rounded-full bg-sage py-3.5 text-lg font-medium text-surface disabled:opacity-40 active:opacity-90'
const secondary = 'w-full rounded-full border border-line bg-surface py-3.5 text-lg font-medium text-ink active:bg-line'
const card = 'flex w-full items-start gap-4 rounded-card bg-surface px-5 py-4 text-left shadow-sm active:bg-line'

export function VoiceSetup({ patientId, onDone }: { patientId: string; onDone: () => void }) {
  const patient = usePatient(patientId)
  const [step, setStep] = useState<Step>({ kind: 'choose' })
  const fileRef = useRef<HTMLInputElement>(null)
  const speaker = useSpeaker()

  // free the preview's object URL when it's replaced
  const previewUrl = step.kind === 'preview' ? step.url : null
  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  if (!patient) return <p className="text-muted">Patient not found.</p>
  const name = patient.preferredName || patient.name

  const loadClip = async (file: Blob, source: Source) => {
    setStep({ kind: 'reading' })
    try {
      const { wav, seconds } = await toWav(file)
      setStep({ kind: 'preview', wav, url: URL.createObjectURL(wav), seconds, source })
    } catch (e) {
      setStep({ kind: 'error', message: (e as Error).message })
    }
  }

  const create = async (wav: Blob, source: Source) => {
    unlockAudio() // inside the tap, so iOS lets the sample play when it's ready
    setStep({ kind: 'cloning' })
    try {
      const voiceId = await cloneVoice(wav, name)
      updatePatient(patientId, { voice: { kind: 'clone', voiceId, source, bank: 0 } })
      let sample: string | null = null
      try {
        sample = URL.createObjectURL(await synthesize(voiceId, SAMPLE))
        speaker.speak('sample', SAMPLE, sample)
      } catch {
        // the clone exists; the sample is a nicety
      }
      setStep({ kind: 'ready', sample })
      void buildBank(patientId, voiceId)
    } catch (e) {
      setStep({ kind: 'error', message: (e as Error).message })
    }
  }

  const pick = (kind: 'demo' | 'device') => {
    updatePatient(patientId, { voice: { kind } })
    onDone()
  }

  switch (step.kind) {
    case 'choose':
      return (
        <div className="space-y-3">
          <p className="text-lg text-muted">Hear {name} in their own voice, from a short clip of them talking.</p>
          <input
            ref={fileRef}
            type="file"
            accept="video/*,audio/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) void loadClip(f, 'upload')
            }}
          />
          <button type="button" className={card} onClick={() => fileRef.current?.click()}>
            <Icon d="M12 16V4m0 0-4 4m4-4 4 4M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
            <span>
              <span className="block text-lg font-medium">Upload a video or voice memo</span>
              <span className="block text-muted">Families usually have one. 10–60 seconds of them talking.</span>
            </span>
          </button>
          <button type="button" className={card} onClick={() => setStep({ kind: 'record' })}>
            <Icon d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm6-3a6 6 0 0 1-12 0m6 6v3" />
            <span>
              <span className="block text-lg font-medium">Record them now</span>
              <span className="block text-muted">If they can still speak, for example before a planned surgery.</span>
            </span>
          </button>
          <button type="button" className={card} onClick={() => pick('demo')}>
            <Icon d="M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm12-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            <span>
              <span className="block text-lg font-medium">Use the demo voice</span>
              <span className="block text-muted">Works offline.</span>
            </span>
          </button>
          <button type="button" onClick={() => pick('device')} className="w-full py-3 text-muted underline-offset-4 active:underline">
            Skip and use the phone’s voice
          </button>
        </div>
      )

    case 'reading':
      return <Busy text="Reading the audio…" />

    case 'record':
      return <Recorder onBlob={(b) => void loadClip(b, 'record')} onCancel={() => setStep({ kind: 'choose' })} />

    case 'preview':
      return <Preview step={step} name={name} onCreate={() => void create(step.wav, step.source)} onBack={() => setStep({ kind: 'choose' })} />

    case 'cloning':
      return <Busy text="Creating their voice…" sub="About 10–30 seconds." />

    case 'ready': {
      const bank = patient.voice.bank ?? 0
      return (
        <div className="space-y-5">
          <div className="rounded-card bg-sage-soft px-5 py-5">
            <p className="font-phrase text-3xl">{name}’s voice is ready</p>
            <p className="mt-2 text-muted">“{SAMPLE}”</p>
            {step.sample && (
              <button type="button" onClick={() => speaker.speak('sample', SAMPLE, step.sample)} className="mt-3 font-medium text-sage">
                {speaker.speaking ? 'Playing…' : 'Play it again'}
              </button>
            )}
          </div>
          <div>
            <div className="flex justify-between text-sm text-muted">
              <span>Saving their phrases on this phone</span>
              <span>
                {bank}/{PHRASES.length}
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-line">
              <div className="h-full rounded-full bg-sage transition-[width] duration-500 ease-calm" style={{ width: `${(bank / PHRASES.length) * 100}%` }} />
            </div>
            <p className="mt-2 text-sm text-muted">You can continue. This keeps going in the background.</p>
          </div>
          <button type="button" className={primary} onClick={onDone}>
            Continue
          </button>
        </div>
      )
    }

    case 'error':
      return (
        <div className="space-y-4">
          <div className="rounded-card bg-honey-soft px-5 py-4">
            <p className="text-lg font-medium text-honey">That didn’t work</p>
            <p className="mt-1 text-ink">{step.message}</p>
          </div>
          <button type="button" className={primary} onClick={() => pick('demo')}>
            Use the demo voice instead
          </button>
          <button type="button" className={secondary} onClick={() => setStep({ kind: 'choose' })}>
            Try again
          </button>
        </div>
      )
  }
}

function Preview({
  step,
  name,
  onCreate,
  onBack,
}: {
  step: { url: string; seconds: number }
  name: string
  onCreate: () => void
  onBack: () => void
}) {
  const [consent, setConsent] = useState(false)
  const short = step.seconds < 10
  return (
    <div className="space-y-5">
      <div className="rounded-card bg-surface px-5 py-4 shadow-sm">
        <p className="font-medium">Listen: is this {name} talking?</p>
        <audio controls src={step.url} className="mt-3 w-full" />
        <p className={`mt-2 text-sm ${short ? 'text-honey' : 'text-muted'}`}>
          {Math.round(step.seconds)} seconds
          {short ? '. It works best with at least 10 seconds of them talking alone.' : ', using the first 45 at most.'}
        </p>
      </div>
      <label className="flex items-start gap-3 text-lg">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1.5 size-5 accent-sage" />
        <span>I have permission from them or their legal representative to recreate their voice.</span>
      </label>
      <button type="button" className={primary} disabled={!consent} onClick={onCreate}>
        Create their voice
      </button>
      <button type="button" className={secondary} onClick={onBack}>
        Choose a different clip
      </button>
    </div>
  )
}

function Recorder({ onBlob, onCancel }: { onBlob: (b: Blob) => void; onCancel: () => void }) {
  const [state, setState] = useState<'idle' | 'recording' | 'error'>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState('')
  const rec = useRef<MediaRecorder | null>(null)
  const stream = useRef<MediaStream | null>(null)
  const timer = useRef(0)

  const cleanup = () => {
    window.clearInterval(timer.current)
    stream.current?.getTracks().forEach((t) => t.stop())
    stream.current = null
  }
  useEffect(() => cleanup, [])

  const stop = () => {
    if (rec.current?.state === 'recording') rec.current.stop()
  }

  const start = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.current = s
      const r = new MediaRecorder(s)
      const chunks: Blob[] = []
      r.ondataavailable = (e) => e.data.size && chunks.push(e.data)
      r.onstop = () => {
        cleanup()
        onBlob(new Blob(chunks, { type: r.mimeType }))
      }
      rec.current = r
      r.start()
      const t0 = Date.now()
      setElapsed(0)
      setState('recording')
      timer.current = window.setInterval(() => {
        const sec = (Date.now() - t0) / 1000
        setElapsed(sec)
        if (sec >= RECORD_LIMIT_S) stop()
      }, 250)
    } catch (e) {
      cleanup()
      setError((e as Error).message)
      setState('error')
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-card bg-surface px-5 py-5 shadow-sm">
        <p className="text-sm text-muted">Ask them to read this aloud, in their normal voice:</p>
        <p className="mt-3 font-phrase text-2xl leading-snug">{PASSAGE}</p>
      </div>
      {state === 'error' && <p className="text-honey">Couldn’t use the microphone: {error}</p>}
      {state === 'recording' ? (
        <>
          <div className="flex items-center justify-center gap-3 text-lg" aria-live="polite">
            <span className="size-3 rounded-full bg-sage motion-safe:animate-pulse" />
            {Math.floor(elapsed)}s of {RECORD_LIMIT_S}s
          </div>
          <button type="button" className={primary} disabled={elapsed < 3} onClick={stop}>
            Done
          </button>
        </>
      ) : (
        <>
          <button type="button" className={primary} onClick={() => void start()}>
            Start recording
          </button>
          <button type="button" className={secondary} onClick={onCancel}>
            Back
          </button>
        </>
      )}
    </div>
  )
}

function Busy({ text, sub }: { text: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center gap-4 py-10 text-center" aria-live="polite">
      <span className="size-10 rounded-full border-4 border-sage-soft border-t-sage motion-safe:animate-spin" />
      <p className="font-phrase text-2xl">{text}</p>
      {sub && <p className="text-muted">{sub}</p>}
    </div>
  )
}

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="mt-1 size-6 shrink-0 text-sage" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  )
}
