'use client';

import Link from 'next/link';
import styles from './Header.module.css';
import NotificationBell from './NotificationBell';
import { useState, useRef } from 'react';
import { useClickOutside } from '@/hooks/useClickOutside';

import Image from 'next/image';
import { User } from '@supabase/supabase-js';
import { useLanguage } from '@/context/LanguageContext';
import LanguageSwitcher from './LanguageSwitcher';

type HeaderProps = {
  user: User | null;
  profile: any | null;
};

export default function Header({ user, profile }: HeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { t } = useLanguage();

  useClickOutside(dropdownRef, () => {
    if (isDropdownOpen) setIsDropdownOpen(false);
  });

  return (
    <header className={styles.header}>
      <div className={styles.logo}>
        <Link href="/">
          <div style={{ backgroundColor: 'white', borderRadius: '50%', padding: '0', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '52px', height: '50px', overflow: 'hidden' }}>
            <Image src="/logo.png" alt="Luis y Sara Bachatango" width={60} height={60} style={{ objectFit: 'contain', transform: 'scale(1.60)', transformOrigin: 'center', objectPosition: 'center' }} />
          </div>
        </Link>
      </div>
      
      <button 
        className={styles.hamburger} 
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        aria-label="Toggle menu"
      >
        <span className={`${styles.bar} ${isMenuOpen ? styles.barOpen : ''}`}></span>
        <span className={`${styles.bar} ${isMenuOpen ? styles.barOpen : ''}`}></span>
        <span className={`${styles.bar} ${isMenuOpen ? styles.barOpen : ''}`}></span>
      </button>

      <nav className={`${styles.nav} ${isMenuOpen ? styles.navOpen : ''}`}>
        <Link href="/courses" onClick={() => setIsMenuOpen(false)}>{t.header.courses}</Link>
        <Link href="/events" onClick={() => setIsMenuOpen(false)}>{t.header.events}</Link>
        <Link href="/music" onClick={() => setIsMenuOpen(false)}>{t.header.music}</Link>
        <Link href="/community" onClick={() => setIsMenuOpen(false)}>{t.header.community}</Link>
        <Link href="/sobre-nosotros" onClick={() => setIsMenuOpen(false)}>{t.header.about}</Link>
        
        <div style={{ marginLeft: '0.5rem', marginRight: '0.5rem' }}>
          <LanguageSwitcher />
        </div>

        <div className={styles.bellWrapper}>
          <NotificationBell />
        </div>
        
        {user ? (
          <div className={styles.userMenu} ref={dropdownRef}>
            <button 
              className={styles.avatarButton} 
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              aria-expanded={isDropdownOpen}
              aria-haspopup="true"
            >
              {profile?.avatar_url ? (
                <Image 
                  src={profile.avatar_url} 
                  alt={profile.full_name || 'User'} 
                  width={40} 
                  height={40} 
                  className={styles.avatar}
                />
              ) : (
                <div className={styles.avatarPlaceholder}>
                  {profile?.full_name ? profile.full_name[0].toUpperCase() : user.email?.[0].toUpperCase()}
                </div>
              )}
            </button>

            {isDropdownOpen && (
              <div className={styles.dropdown}>
                <Link href="/dashboard" className={styles.dropdownItem} onClick={() => setIsDropdownOpen(false)}>
                  Dashboard
                </Link>
                <Link href="/profile" className={styles.dropdownItem} onClick={() => setIsDropdownOpen(false)}>
                  {t.header.profile}
                </Link>
                <form action="/auth/signout" method="post">
                  <button type="submit" className={styles.dropdownItem} style={{ width: '100%', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer' }}>
                    Cerrar Sesión
                  </button>
                </form>
              </div>
            )}
          </div>
        ) : (
          <Link href="/login" className={styles.cta} onClick={() => setIsMenuOpen(false)}>{t.header.login}</Link>
        )}
      </nav>
    </header>
  );
}
