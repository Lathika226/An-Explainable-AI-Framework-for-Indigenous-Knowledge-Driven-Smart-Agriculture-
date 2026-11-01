import { Mic, MicOff, Loader2 } from "lucide-react";
import { useState, useRef } from "react";
import { useAppLanguage } from "../context/LanguageContext";

type Props = {
  language?: string;
  onText: (text: string) => void;
  size?: "sm" | "md" | "lg";
  label?: string;
  className?: string;
};

export default function VoiceInput({ language, onText, size = "md", label, className = "" }: Props) {
  const { lang, t } = useAppLanguage();
  const finalLanguage = language || lang.code;
  const [listening, setListening] = useState(false);
  const [interimText, setInterimText] = useState("");
  const recognitionRef = useRef<any>(null);

  const start = () => {
    if (listening && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      setListening(false);
      return;
    }

    const Recognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!Recognition) {
      alert("Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.");
      return;
    }

    try {
      const recognition = new Recognition();
      recognitionRef.current = recognition;
      recognition.lang = finalLanguage;
      recognition.interimResults = true;
      recognition.continuous = false;

      recognition.onstart = () => {
        setListening(true);
        setInterimText("");
      };

      recognition.onresult = (event: any) => {
        let currentInterim = "";
        let finalResult = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalResult += transcript;
          } else {
            currentInterim += transcript;
          }
        }

        if (currentInterim) {
          setInterimText(currentInterim);
        }

        if (finalResult) {
          onText(finalResult.trim());
          setInterimText("");
        }
      };

      recognition.onerror = (e: any) => {
        console.warn("Speech recognition error:", e);
        setListening(false);
        setInterimText("");
      };

      recognition.onend = () => {
        setListening(false);
        setInterimText("");
      };

      recognition.start();
    } catch (err) {
      console.error("Failed to start speech recognition:", err);
      setListening(false);
    }
  };

  const sizeClasses = {
    sm: "p-2 text-sm",
    md: "p-3 text-base",
    lg: "p-4 text-lg",
  };

  const iconSizes = {
    sm: 16,
    md: 20,
    lg: 24,
  };

  return (
    <div className="inline-flex flex-col items-center">
      <button
        type="button"
        onClick={start}
        className={`relative inline-flex items-center justify-center gap-2 rounded-2xl font-bold transition-all shadow-sm ${
          sizeClasses[size]
        } ${
          listening
            ? "bg-red-500 text-white animate-pulse shadow-red-200 ring-4 ring-red-200"
            : "bg-agri-50 text-agri-700 hover:bg-agri-100 border border-agri-200"
        } ${className}`}
        title={listening ? t("mic_listening") : t("mic_click")}
        aria-label={label || t("mic_click")}
      >
        {listening ? (
          <>
            <MicOff size={iconSizes[size]} className="animate-bounce" />
            {label && <span>{t("mic_listening")}</span>}
          </>
        ) : (
          <>
            <Mic size={iconSizes[size]} />
            {label && <span>{label}</span>}
          </>
        )}
      </button>

      {interimText && (
        <span className="mt-1 text-xs text-agri-700 font-medium animate-pulse">
          "{interimText}..."
        </span>
      )}
    </div>
  );
}
