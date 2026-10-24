// Plays a phrase in the patient's cloned voice: pre-generated /audio/<phrase_id>.mp3
// (scripts/make-audio.mjs). Falls back to the device voice if the file is missing.
// iOS only allows audio after a user gesture, so call unlockAudio() inside a tap handler.
import { useCallback, useRef, useState } from 'react'

const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA='
let audio: HTMLAudioElement | null = null

export function unlockAudio() {
  audio ??= new Audio()
  audio.src = SILENT_WAV
  audio.play().catch(() => {})
}

export function useSpeaker() {
  const [speaking, setSpeaking] = useState(false)
  const [fallback, setFallback] = useState(false)
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
    const useDeviceVoice = () => {
      if (mine !== token.current || !window.speechSynthesis) return
      token.current++ // ignore any later error events from the <audio> element
      const u = new SpeechSynthesisUtterance(text)
      u.onstart = () => setSpeaking(true)
      u.onend = () => setSpeaking(false)
      setFallback(true)
      window.speechSynthesis.speak(u)
    }
    audio ??= new Audio()
    const a = audio
    a.onplaying = () => mine === token.current && setSpeaking(true)
    a.onended = () => mine === token.current && setSpeaking(false)
    a.onerror = useDeviceVoice
    a.src = `/audio/${phraseId}.mp3`
    setFallback(false)
    a.play().catch(useDeviceVoice)
  }, [stop])

  return { speaking, fallback, speak, stop }
}
