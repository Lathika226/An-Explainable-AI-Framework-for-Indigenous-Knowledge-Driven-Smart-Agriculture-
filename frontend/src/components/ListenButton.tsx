import { Volume2, VolumeX, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useAppLanguage } from "../context/LanguageContext";

type Props = {
  text: string;
  language?: string;
  label?: string;
  className?: string;
};

export default function ListenButton({ text, language, label, className = "" }: Props) {
  const { lang, t } = useAppLanguage();
  const finalLanguage = language || lang.code;
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    return () => {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const toggleSpeak = () => {
    if (!("speechSynthesis" in window)) {
      alert("Text-to-speech is not available in this browser.");
      return;
    }

    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }

    window.speechSynthesis.cancel();

    // Clean plain text without markdown stars or brackets
    const cleanText = text.replace(/[*_#`[\]()]/g, " ").replace(/\s+/g, " ").trim();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = finalLanguage;
    utterance.rate = 0.95; // Slightly measured rate for farmer accessibility

    // Pick best matching voice if available
    const voices = window.speechSynthesis.getVoices();
    const matchingVoice = voices.find((v) => v.lang === finalLanguage || v.lang.startsWith(finalLanguage.split("-")[0]));
    if (matchingVoice) {
      utterance.voice = matchingVoice;
    }

    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  return (
    <button
      onClick={toggleSpeak}
      className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-bold transition shadow-sm ${
        speaking
          ? "bg-amber-500 text-white animate-pulse"
          : "bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100"
      } ${className}`}
      type="button"
      title={speaking ? "Stop Audio" : (label || t("listen_btn"))}
    >
      {speaking ? (
        <>
          <VolumeX size={16} />
          <span>Stop Audio</span>
        </>
      ) : (
        <>
          <Volume2 size={16} />
          <span>{label || t("listen_btn")}</span>
        </>
      )}
    </button>
  );
}
