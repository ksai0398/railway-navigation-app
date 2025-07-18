"use client"

// hooks/use-speech-synthesis.ts
import { useState, useEffect, useCallback } from "react"

type Language = "en-US" | "hi-IN"

export function useSpeechSynthesis() {
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])

  useEffect(() => {
    const populateVoices = () => {
      setVoices(window.speechSynthesis.getVoices())
    }

    populateVoices()
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = populateVoices
    }

    return () => {
      window.speechSynthesis.onvoiceschanged = null
    }
  }, [])

  const speak = useCallback(
    (text: string, lang: Language = "en-US") => {
      if (!window.speechSynthesis) {
        console.warn("Speech Synthesis API not supported in this browser.")
        return
      }

      // Cancel any ongoing speech before starting a new one
      // This might cause an 'interrupted' error on the previous utterance, which is expected.
      window.speechSynthesis.cancel()

      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = lang

      // Try to find a suitable voice
      const selectedVoice = voices.find((voice) => voice.lang === lang && voice.localService)
      if (selectedVoice) {
        utterance.voice = selectedVoice
      } else {
        // Fallback to any voice if a local one isn't found
        utterance.voice = voices.find((voice) => voice.lang === lang) || null
      }

      utterance.onstart = () => setIsSpeaking(true)
      utterance.onend = () => setIsSpeaking(false)
      utterance.onerror = (event) => {
        // Only log errors that are not 'interrupted', as 'interrupted' is an expected behavior
        // when a new speech request cancels a previous one.
        if (event.error !== "interrupted") {
          console.error("SpeechSynthesisUtterance.onerror", event, "Error:", event.error)
        } else {
          // Optionally, log a less severe message for expected interruptions
          console.info("SpeechSynthesisUtterance.onerror: Speech interrupted by a new request.")
        }
        setIsSpeaking(false)
      }

      window.speechSynthesis.speak(utterance)
    },
    [voices],
  )

  const cancel = useCallback(() => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel()
      setIsSpeaking(false)
    }
  }, [])

  return { speak, cancel, isSpeaking }
}
