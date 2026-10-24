// Plays a phrase in the patient's cloned voice: pre-generated /audio/<phrase_id>.mp3
// (scripts/make-audio.mjs). Falls back to the device voice if the file is missing.
// iOS only allows audio after a user gesture, so call unlockAudio() inside a tap handler.
// It unlocks both the shared <audio> element and speechSynthesis; after that, iOS lets
// us play on them later (the voice starts seconds after the tap, once the reading is done).
import { useCallback, useRef, useState } from 'react'

let audio: HTMLAudioElement | null = null
let silence: string | null = null
let speechUnlocked = false

/** 0.1 s of real silence. iOS can refuse a zero-length clip, which leaves the element locked. */
function silentWav() {
  const rate = 8000
  const n = rate / 10
  const v = new DataView(new ArrayBuffer(44 + n))
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)))
  str(0, 'RIFF')
  v.setUint32(4, 36 + n, true)
  str(8, 'WAVE')
  str(12, 'fmt ')
  v.setUint32(16, 16, true)
  v.setUint16(20, 1, true) // PCM
  v.setUint16(22, 1, true) // mono
  v.setUint32(24, rate, true)
  v.setUint32(28, rate, true)
  v.setUint16(32, 1, true)
  v.setUint16(34, 8, true) // 8-bit, where 128 is silence
  str(36, 'data')
  v.setUint32(40, n, true)
  new Uint8Array(v.buffer, 44).fill(128)
  return URL.createObjectURL(new Blob([v.buffer], { type: 'audio/wav' }))
}

export function unlockAudio() {
  audio ??= new Audio()
  silence ??= silentWav()
  audio.src = silence
  audio.play().catch(() => {})
  // iOS ignores speechSynthesis.speak() until it has been called once inside a gesture.
  if (!speechUnlocked && window.speechSynthesis) {
    speechUnlocked = true
    const u = new SpeechSynthesisUtterance(' ')
    u.volume = 0
    window.speechSynthesis.speak(u)
  }
}

/** for the ?debug overlay */
export type VoiceStatus = 'idle' | 'loading clone' | 'clone' | 'device voice' | 'blocked'

export function useSpeaker() {
  const [speaking, setSpeaking] = useState(false)
  const [fallback, setFallback] = useState(false)
  const [status, setStatus] = useState<VoiceStatus>('idle')
  const token = useRef(0)

  const stop = useCallback(() => {
    token.current++
    audio?.pause()
    window.speechSynthesis?.cancel()
    setSpeaking(false)
  }, [])

  const speak = useCallback((phraseId: string, text: string) => {
    stop()
    const mine = ++token.current
    const fallBackToDevice = () => {
      if (mine !== token.current || !window.speechSynthesis) return
      token.current++ // ignore any later error events from the <audio> element
      const u = new SpeechSynthesisUtterance(text)
      u.onstart = () => setSpeaking(true)
      u.onend = () => setSpeaking(false)
      setFallback(true)
      setStatus('device voice')
      window.speechSynthesis.speak(u)
    }
    audio ??= new Audio()
    const a = audio
    a.onplaying = () => {
      if (mine !== token.current) return
      setSpeaking(true)
      setStatus('clone')
    }
    a.onended = () => mine === token.current && setSpeaking(false)
    a.onerror = fallBackToDevice
    a.src = `/audio/${phraseId}.mp3`
    setFallback(false)
    setStatus('loading clone')
    a.play().catch((e: Error) => {
      fallBackToDevice()
      // NotAllowedError: iOS never saw the unlock tap, so the device voice is likely silent too
      if (e.name === 'NotAllowedError') setStatus('blocked')
    })
  }, [stop])

  return { speaking, fallback, status, speak, stop }
}
