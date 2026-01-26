'use client';

import { useState, useRef, useEffect } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import styles from './LanguageSwitcher.module.css';
import { Locale } from '@/utils/dictionaries';

const LANGUAGES: { code: Locale; name: string; flag: string }[] = [
  { code: 'es', name: 'Español', flag: 'es' },
  { code: 'en', name: 'English', flag: 'gb' },
  { code: 'fr', name: 'Français', flag: 'fr' },
  { code: 'de', name: 'Deutsch', flag: 'de' },
  { code: 'it', name: 'Italiano', flag: 'it' },
  { code: 'ja', name: '日本語', flag: 'jp' }
];

export default function LanguageSwitcher() {
  const { locale, setLocale } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentLang = LANGUAGES.find(l => l.code === locale) || LANGUAGES[0];

  const handleSelect = (code: Locale) => {
    setLocale(code);
    setIsOpen(false);
  };

  return (
    <div className={styles.container} ref={containerRef}>
      <button 
        className={`${styles.trigger} ${isOpen ? styles.open : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Select Language"
      >
        <img 
          src={`https://flagcdn.com/w40/${currentLang.flag}.png`}
          srcSet={`https://flagcdn.com/w80/${currentLang.flag}.png 2x`} 
          alt={currentLang.name} 
          className={styles.flag}
          width="20"
          height="15"
        />
        <span className={styles.arrow}>▼</span>
      </button>

      {isOpen && (
        <div className={styles.dropdown}>
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              className={`${styles.option} ${locale === lang.code ? styles.active : ''}`}
              onClick={() => handleSelect(lang.code)}
            >
               <img 
                src={`https://flagcdn.com/w40/${lang.flag}.png`}
                srcSet={`https://flagcdn.com/w80/${lang.flag}.png 2x`}
                alt={lang.name} 
                className={styles.flag}
                width="20"
                height="15"
              />
              {lang.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
