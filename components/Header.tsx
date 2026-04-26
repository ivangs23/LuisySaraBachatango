'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import {
  ArrowRight,
  ArrowUpRight,
  LayoutDashboard,
  LogOut,
  UserCircle2,
} from 'lucide-react';
import type { User } from '@supabase/supabase-js';

import styles from './Header.module.css';
import NotificationBell from './NotificationBell';
import LanguageSwitcher from './LanguageSwitcher';
import { useLanguage } from '@/context/LanguageContext';
import { useClickOutside } from '@/hooks/useClickOutside';
import { safeAvatarUrl } from '@/utils/sanitize';

type Profile = {
  full_name?: string | null;
  avatar_url?: string | null;
} | null;

type HeaderProps = {
  user: User | null;
  profile: Profile;
};

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

export default function Header({ user, profile }: HeaderProps) {
  const { t } = useLanguage();
  const pathname = usePathname();

  const [scrolled, setScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useClickOutside(dropdownRef, () => {
    if (isDropdownOpen) setIsDropdownOpen(false);
  });

  // Sticky scroll state
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (isMenuOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [isMenuOpen]);

  const NAV_LINKS = [
    { href: '/courses', label: t.header.courses },
    { href: '/events', label: t.header.events },
    { href: '/music', label: t.header.music },
    { href: '/community', label: t.header.community },
    { href: '/sobre-nosotros', label: t.header.about },
  ] as const;

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname?.startsWith(`${href}/`);
  };

  const avatarSrc = safeAvatarUrl(profile?.avatar_url);
  const initial =
    profile?.full_name?.[0]?.toUpperCase() ??
    user?.email?.[0]?.toUpperCase() ??
    '·';
  const displayName =
    profile?.full_name?.trim() || user?.email?.split('@')[0] || 'Bailarín';

  return (
    <>
      <header
        className={`${styles.header} ${scrolled ? styles.headerScrolled : ''}`}
      >
        {/* Logo */}
        <Link href="/" className={styles.logoLink} aria-label="Inicio">
          <span className={styles.logoMark}>
            <Image
              src="/logo.png"
              alt="Luis y Sara Bachatango"
              fill
              sizes="46px"
              style={{
                objectFit: 'contain',
                objectPosition: 'center',
                padding: '4px',
                transform: 'scale(2)',
              }}
              priority
            />
          </span>
          <span className={styles.logoText}>
            <span className={styles.logoTitle}>Luis &amp; Sara</span>
            <span className={styles.logoSub}>Bachatango</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className={styles.nav} aria-label="Navegación principal">
          <LayoutGroup id="header-nav">
            <div className={styles.navLinks}>
              {NAV_LINKS.map((link) => {
                const active = isActive(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`${styles.navLink} ${
                      active ? styles.navLinkActive : ''
                    }`}
                    aria-current={active ? 'page' : undefined}
                  >
                    {active && (
                      <motion.span
                        layoutId="header-nav-indicator"
                        className={styles.navLinkIndicator}
                        aria-hidden="true"
                        transition={{
                          type: 'spring',
                          bounce: 0.2,
                          duration: 0.5,
                        }}
                      />
                    )}
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </LayoutGroup>

          <div className={styles.actions}>
            <span className={styles.languageDesktop}>
              <LanguageSwitcher />
            </span>

            {user && (
              <>
                <span className={styles.divider} aria-hidden="true" />
                <div className={styles.bellWrapper}>
                  <NotificationBell />
                </div>
              </>
            )}

            {user ? (
              <div className={styles.userMenu} ref={dropdownRef}>
                <button
                  type="button"
                  className={styles.avatarButton}
                  onClick={() => setIsDropdownOpen((v) => !v)}
                  aria-expanded={isDropdownOpen}
                  aria-haspopup="menu"
                  aria-label={t.header.profile}
                >
                  {avatarSrc ? (
                    <Image
                      src={avatarSrc}
                      alt={displayName}
                      width={40}
                      height={40}
                      className={styles.avatar}
                    />
                  ) : (
                    <span className={styles.avatarPlaceholder} aria-hidden="true">
                      {initial}
                    </span>
                  )}
                </button>

                <AnimatePresence>
                  {isDropdownOpen && (
                    <motion.div
                      role="menu"
                      className={styles.dropdown}
                      initial={{ opacity: 0, y: -8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.98 }}
                      transition={{ duration: 0.22, ease: EASE_OUT_EXPO }}
                    >
                      <div className={styles.dropdownHeader}>
                        <span className={styles.dropdownEyebrow}>
                          SESIÓN ABIERTA
                        </span>
                        <span className={styles.dropdownName}>
                          {displayName}
                        </span>
                      </div>

                      <Link
                        href="/dashboard"
                        className={styles.dropdownItem}
                        role="menuitem"
                        onClick={() => setIsDropdownOpen(false)}
                      >
                        <LayoutDashboard size={14} strokeWidth={1.8} />
                        {t.header.dashboard}
                      </Link>
                      <Link
                        href="/profile"
                        className={styles.dropdownItem}
                        role="menuitem"
                        onClick={() => setIsDropdownOpen(false)}
                      >
                        <UserCircle2 size={14} strokeWidth={1.8} />
                        {t.header.profile}
                      </Link>

                      <span className={styles.dropdownDivider} aria-hidden="true" />

                      <form
                        action="/auth/signout"
                        method="post"
                        className={styles.signoutForm}
                      >
                        <button
                          type="submit"
                          className={`${styles.dropdownItem} ${styles.dropdownItemDanger}`}
                          role="menuitem"
                        >
                          <LogOut size={14} strokeWidth={1.8} />
                          {t.header.logout}
                        </button>
                      </form>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <Link href="/login" className={styles.cta}>
                {t.header.login}
                <ArrowRight size={13} strokeWidth={2.4} aria-hidden="true" />
              </Link>
            )}
          </div>
        </nav>

        {/* Hamburger (mobile) */}
        <button
          type="button"
          className={styles.hamburger}
          onClick={() => setIsMenuOpen((v) => !v)}
          aria-expanded={isMenuOpen}
          aria-controls="mobile-drawer"
          aria-label={isMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
          data-open={isMenuOpen}
        >
          <span className={styles.hamburgerInner} aria-hidden="true">
            <span className={styles.bar} />
            <span className={styles.bar} />
            <span className={styles.bar} />
          </span>
        </button>
      </header>

      {/* Mobile drawer */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            id="mobile-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Menú principal"
            className={`${styles.mobileDrawer} ${styles.mobileDrawerOpen}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE_OUT_EXPO }}
          >
            <span className={styles.mobileDrawerBg} aria-hidden="true" />
            <span className={styles.mobileDrawerGrid} aria-hidden="true" />
            <span className={styles.mobileDrawerCornerTL} aria-hidden="true" />
            <span className={styles.mobileDrawerCornerBR} aria-hidden="true" />

            <span className={styles.mobileEyebrow}>
              <span className={styles.mobileEyebrowLine} aria-hidden="true" />
              MENÚ · NAVEGACIÓN
            </span>

            <div className={styles.mobileLinks}>
              {NAV_LINKS.map((link, i) => {
                const active = isActive(link.href);
                return (
                  <motion.div
                    key={link.href}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      duration: 0.45,
                      delay: 0.04 + i * 0.05,
                      ease: EASE_OUT_EXPO,
                    }}
                  >
                    <Link
                      href={link.href}
                      className={`${styles.mobileLink} ${
                        active ? styles.mobileLinkActive : ''
                      }`}
                      onClick={() => setIsMenuOpen(false)}
                      aria-current={active ? 'page' : undefined}
                    >
                      <span>{link.label}</span>
                      <ArrowUpRight
                        size={18}
                        strokeWidth={1.8}
                        className={styles.mobileLinkArrow}
                        aria-hidden="true"
                      />
                    </Link>
                  </motion.div>
                );
              })}

              {user && (
                <>
                  <motion.div
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      duration: 0.45,
                      delay: 0.04 + NAV_LINKS.length * 0.05,
                      ease: EASE_OUT_EXPO,
                    }}
                  >
                    <Link
                      href="/dashboard"
                      className={`${styles.mobileLink} ${
                        isActive('/dashboard') ? styles.mobileLinkActive : ''
                      }`}
                      onClick={() => setIsMenuOpen(false)}
                    >
                      <span>{t.header.dashboard}</span>
                      <ArrowUpRight
                        size={18}
                        strokeWidth={1.8}
                        className={styles.mobileLinkArrow}
                        aria-hidden="true"
                      />
                    </Link>
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      duration: 0.45,
                      delay: 0.04 + (NAV_LINKS.length + 1) * 0.05,
                      ease: EASE_OUT_EXPO,
                    }}
                  >
                    <Link
                      href="/profile"
                      className={`${styles.mobileLink} ${
                        isActive('/profile') ? styles.mobileLinkActive : ''
                      }`}
                      onClick={() => setIsMenuOpen(false)}
                    >
                      <span>{t.header.profile}</span>
                      <ArrowUpRight
                        size={18}
                        strokeWidth={1.8}
                        className={styles.mobileLinkArrow}
                        aria-hidden="true"
                      />
                    </Link>
                  </motion.div>
                </>
              )}
            </div>

            <div className={styles.mobileFooter}>
              <div className={styles.mobileLanguage}>
                <LanguageSwitcher />
              </div>
              {user ? (
                <form action="/auth/signout" method="post">
                  <button
                    type="submit"
                    className={styles.mobileCta}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <LogOut size={13} strokeWidth={2.4} aria-hidden="true" />
                    {t.header.logout}
                  </button>
                </form>
              ) : (
                <Link
                  href="/login"
                  className={styles.mobileCta}
                  onClick={() => setIsMenuOpen(false)}
                >
                  {t.header.login}
                  <ArrowRight
                    size={13}
                    strokeWidth={2.4}
                    aria-hidden="true"
                  />
                </Link>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
