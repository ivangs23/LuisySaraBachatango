'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { dictionaries, Locale } from '@/utils/dictionaries';

type LanguageContextType = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: typeof dictionaries['es'];
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>('es');
  const router = useRouter();

  useEffect(() => {
    // Load preference from localStorage (fallback to cookie)
    const saved = localStorage.getItem('language') as Locale;
    if (saved && ['es', 'en', 'fr', 'de', 'it', 'ja'].includes(saved)) {
      setLocale(saved);
      document.cookie = `locale=${saved}; path=/; max-age=31536000; SameSite=Lax`;
    }
  }, []);

  const changeLocale = (newLocale: Locale) => {
    setLocale(newLocale);
    localStorage.setItem('language', newLocale);
    document.cookie = `locale=${newLocale}; path=/; max-age=31536000; SameSite=Lax`;
    // Re-render server components so getDict() picks up the new cookie
    router.refresh();
  };

  const t = dictionaries[locale];

  return (
    <LanguageContext.Provider value={{ locale, setLocale: changeLocale, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
