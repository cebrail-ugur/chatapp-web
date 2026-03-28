/**
 * ChatApp Ultra - Dil Bağlamı (Language Context)
 * Uluslararası çoklu dil desteği
 */
import React, { createContext, useContext, useState, useCallback } from 'react';
import { type Language, type Translations, getTranslations, detectLanguage, setLanguage as saveLanguage, isRTL } from '@/lib/i18n';

interface LanguageContextType {
  language: Language;
  t: Translations;
  rtl: boolean;
  changeLanguage: (lang: Language) => void;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLang] = useState<Language>(detectLanguage);

  const changeLanguage = useCallback((lang: Language) => {
    setLang(lang);
    saveLanguage(lang);
    document.documentElement.dir = isRTL(lang) ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, []);

  const t = getTranslations(language);
  const rtl = isRTL(language);

  return (
    <LanguageContext.Provider value={{ language, t, rtl, changeLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}
