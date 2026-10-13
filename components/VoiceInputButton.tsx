"use client";

import { useEffect, useRef, useState } from "react";
import { appendTranscript, speechLocale } from "@/lib/voice";
import type { Language } from "@/lib/types";

type RecognitionResultLike = {
  isFinal: boolean;
  0: { transcript: string };
};

type RecognitionEventLike = {
  results: ArrayLike<RecognitionResultLike>;
};

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: RecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

type Props = {
  value: string;
  onChange: (value: string) => void;
  language: Language;
  className?: string;
  compact?: boolean;
};

export default function VoiceInputButton({ value, onChange, language, className = "", compact = false }: Props) {
  const tr = (en: string, es: string) => language === "en" ? en : es;
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const baseValueRef = useRef("");
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setSupported(Boolean(window.SpeechRecognition || window.webkitSpeechRecognition));
    return () => recognitionRef.current?.abort();
  }, []);

  useEffect(() => {
    if (recognitionRef.current && !listening) recognitionRef.current.lang = speechLocale(language);
  }, [language, listening]);

  function stop() {
    recognitionRef.current?.stop();
  }

  function start() {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setMessage(tr("Voice dictation is not available in this browser.", "El dictado por voz no está disponible en este navegador."));
      return;
    }

    setMessage("");
    baseValueRef.current = value;

    const recognition = new Recognition();
    recognition.lang = speechLocale(language);
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setListening(true);
    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };
    recognition.onerror = (event) => {
      setListening(false);
      recognitionRef.current = null;
      const denied = event.error === "not-allowed" || event.error === "service-not-allowed";
      setMessage(denied
        ? tr("Microphone permission was denied.", "Se rechazó el permiso del micrófono.")
        : tr("I couldn't transcribe that. Try again.", "No pude transcribir eso. Probá de nuevo."));
    };
    recognition.onresult = (event) => {
      let transcript = "";
      for (let index = 0; index < event.results.length; index += 1) {
        transcript += event.results[index][0]?.transcript ?? "";
      }
      onChange(appendTranscript(baseValueRef.current, transcript));
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setListening(false);
      setMessage(tr("The microphone is already in use. Try again.", "El micrófono ya está en uso. Probá de nuevo."));
    }
  }

  if (!supported) return null;

  return (
    <div className={"voiceControl " + (compact ? "compact" : "") + " " + className}>
      <button
        type="button"
        className={"voiceButton " + (listening ? "listening" : "")}
        onClick={listening ? stop : start}
        aria-pressed={listening}
        aria-label={listening ? tr("Stop dictation", "Detener dictado") : tr("Dictate with microphone", "Dictar con micrófono")}
        title={listening ? tr("Stop dictation", "Detener dictado") : tr("Dictate with microphone", "Dictar con micrófono")}
      >
        <span aria-hidden="true">
          {listening ? (
            <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="2" width="6" height="12" rx="3" />
              <path d="M5 10a7 7 0 0 0 14 0" />
              <path d="M12 17v5" />
              <path d="M8 22h8" />
            </svg>
          )}
        </span>
        {!compact ? <b>{listening ? tr("Listening…", "Escuchando…") : tr("Speak", "Hablar")}</b> : null}
      </button>
      {message ? <span className="voiceMessage">{message}</span> : null}
    </div>
  );
}
