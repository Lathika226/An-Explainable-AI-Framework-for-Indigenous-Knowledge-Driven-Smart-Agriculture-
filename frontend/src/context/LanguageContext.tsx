import React, { createContext, useContext, useState, useEffect } from "react";
import { SUPPORTED_LANGUAGES, LanguageOption, getTranslation } from "../i18n";

export interface LanguageContextType {
  lang: LanguageOption;
  setLanguage: (lang: LanguageOption) => void;
  t: (key: string) => string;
}

export const LanguageContext = createContext<LanguageContextType>({
  lang: SUPPORTED_LANGUAGES[0],
  setLanguage: () => {},
  t: (key: string) => key,
});

export function LanguageProvider({
  initialLanguage,
  onLanguageChange,
  children,
}: {
  initialLanguage?: LanguageOption | null;
  onLanguageChange?: (lang: LanguageOption) => void;
  children: React.ReactNode;
}) {
  const [lang, setLangState] = useState<LanguageOption>(() => {
    if (initialLanguage) return initialLanguage;
    try {
      const saved = localStorage.getItem("agri_app_lang");
      if (saved) {
        const parsed = JSON.parse(saved);
        const match = SUPPORTED_LANGUAGES.find((l) => l.code === parsed.code);
        if (match) return match;
      }
    } catch {}
    return SUPPORTED_LANGUAGES[0]; // Telugu or default
  });

  const setLanguage = (newLang: LanguageOption) => {
    setLangState(newLang);
    try {
      localStorage.setItem("agri_app_lang", JSON.stringify(newLang));
    } catch {}
    if (onLanguageChange) {
      onLanguageChange(newLang);
    }
  };

  const t = (key: string) => getTranslation(lang.code, key);

  return (
    <LanguageContext.Provider value={{ lang, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useAppLanguage() {
  return useContext(LanguageContext);
}
