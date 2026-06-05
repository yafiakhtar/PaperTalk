"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface VoicePanelProps {
  disabled?: boolean;
}

export function VoicePanel({ disabled }: VoicePanelProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    const SpeechRecognitionCtor =
      typeof window !== "undefined"
        ? window.SpeechRecognition ?? window.webkitSpeechRecognition
        : undefined;

    if (!SpeechRecognitionCtor) return;

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let text = "";
      for (let i = 0; i < event.results.length; i += 1) {
        text += event.results[i][0].transcript;
      }
      setTranscript(text);
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;

    return () => recognition.stop();
  }, []);

  const toggleListening = () => {
    if (disabled) return;

    if (!recognitionRef.current) {
      setTranscript("Speech recognition is not supported in this browser.");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setTranscript("");
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 p-6">
      <Button
        size="lg"
        variant={isListening ? "default" : "outline"}
        className={cn("h-20 w-20 rounded-full", isListening && "animate-pulse")}
        onClick={toggleListening}
        disabled={disabled}
        aria-label={isListening ? "Stop listening" : "Start listening"}
      >
        {isListening ? <MicOff className="h-8 w-8" /> : <Mic className="h-8 w-8" />}
      </Button>

      <p className="text-sm text-muted-foreground">
        {disabled
          ? "Upload a paper to use voice"
          : isListening
            ? "Listening…"
            : "Tap the mic to speak"}
      </p>

      {transcript && (
        <div className="w-full rounded-md border border-border bg-muted p-4 text-sm">
          {transcript}
        </div>
      )}
    </div>
  );
}
