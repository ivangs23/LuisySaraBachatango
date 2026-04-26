'use client';

import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowUpRight,
  Facebook,
  Instagram,
  Music2,
  Youtube,
} from 'lucide-react';

import Reveal from './Reveal';
import styles from './Footer.module.css';
import { useLanguage } from '@/context/LanguageContext';
import { safeSocialUrl } from '@/utils/sanitize';

type FooterClientProps = {
  adminProfile: {
    instagram?: string | null;
    facebook?: string | null;
    tiktok?: string | null;
    youtube?: string | null;
  } | null;
};

export default function FooterClient({ adminProfile }: FooterClientProps) {
  const { t } = useLanguage();

  const instagramUrl = safeSocialUrl(
    adminProfile?.instagram,
    'https://www.instagram.com/luisysarabachatango/'
  );
  const facebookUrl = safeSocialUrl(
    adminProfile?.facebook,
    'https://www.facebook.com/LuisySaraBachatango'
  );
  const tiktokUrl = safeSocialUrl(
    adminProfile?.tiktok,
    'https://www.tiktok.com/@luisysarabachatango'
  );
  const youtubeUrl = safeSocialUrl(
    adminProfile?.youtube,
    'https://www.youtube.com/@LuisySaraBachatango'
  );

  const exploreLinks = [
    { href: '/', label: t.footer.home },
    { href: '/courses', label: t.header.courses },
    { href: '/events', label: t.header.events },
    { href: '/music', label: t.header.music },
    { href: '/blog', label: t.footer.blog },
    { href: '/community', label: t.header.community },
    { href: '/contact', label: t.footer.contact },
    { href: '/sobre-nosotros', label: t.header.about },
  ];

  const legalLinks = [
    { href: '/legal/privacy', label: t.footer.privacy },
    { href: '/legal/terms', label: t.footer.terms },
    { href: '/legal/cookies', label: t.footer.cookies },
    { href: '/legal/notice', label: t.footer.notice },
  ];

  const socials = [
    { href: instagramUrl, label: 'Instagram', Icon: Instagram },
    { href: facebookUrl, label: 'Facebook', Icon: Facebook },
    { href: tiktokUrl, label: 'TikTok', Icon: Music2 },
    { href: youtubeUrl, label: 'YouTube', Icon: Youtube },
  ];

  return (
    <footer className={styles.footer}>
      <span className={styles.footerBg} aria-hidden="true" />
      <span className={styles.footerGrid} aria-hidden="true" />
      <span className={styles.footerCornerTL} aria-hidden="true" />
      <span className={styles.footerCornerTR} aria-hidden="true" />

      {/* ===== Closing block ===== */}
      <Reveal>
        <div className={styles.closing}>
          <div className={styles.closingTitleBlock}>
            <span className={styles.closingEyebrow}>
              <span className={styles.closingEyebrowLine} aria-hidden="true" />
              ÚLTIMO COMPÁS · ANTES DE IRTE
            </span>
            <h2 className={styles.closingTitle}>
              ¿Listo para llevarnos a tu{' '}
              <span className={styles.closingAccent}>ciudad</span>?
            </h2>
          </div>
          <Link href="/contact" className={styles.closingCta}>
            {t.footer.contact}
            <ArrowUpRight size={14} strokeWidth={2.4} aria-hidden="true" />
          </Link>
        </div>
      </Reveal>

      {/* ===== Columns ===== */}
      <div className={styles.container}>
        {/* Brand */}
        <Reveal>
          <div className={`${styles.column} ${styles.brandColumn}`}>
            <div className={styles.brandHeader}>
              <span className={styles.logoMark}>
                <Image
                  src="/logo.png"
                  alt="Luis y Sara Bachatango"
                  fill
                  sizes="56px"
                  style={{
                    objectFit: 'contain',
                    objectPosition: 'center',
                    padding: '4px',
                    transform: 'scale(2)',
                  }}
                />
              </span>
              <span className={styles.brandText}>
                <span className={styles.brandTitle}>Luis &amp; Sara</span>
                <span className={styles.brandSub}>Bachatango</span>
              </span>
            </div>
            <p className={styles.brandDescription}>{t.footer.description}</p>
            <div className={styles.socialLinks}>
              {socials.map(({ href, label, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.socialIcon}
                  aria-label={label}
                >
                  <Icon size={16} strokeWidth={1.8} aria-hidden="true" />
                </a>
              ))}
            </div>
          </div>
        </Reveal>

        {/* Explorar */}
        <Reveal delay={0.05}>
          <div className={styles.column}>
            <div className={styles.columnHeader}>
              <span className={styles.columnEyebrow}>
                <span className={styles.columnEyebrowLine} aria-hidden="true" />
                MAPA
              </span>
              <h3 className={styles.columnTitle}>{t.footer.explore}</h3>
            </div>
            <ul className={styles.linkList}>
              {exploreLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className={styles.link}>
                    {link.label}
                    <ArrowUpRight
                      size={12}
                      strokeWidth={2.4}
                      className={styles.linkArrow}
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>

        {/* Legal */}
        <Reveal delay={0.1}>
          <div className={styles.column}>
            <div className={styles.columnHeader}>
              <span className={styles.columnEyebrow}>
                <span className={styles.columnEyebrowLine} aria-hidden="true" />
                LETRA PEQUEÑA
              </span>
              <h3 className={styles.columnTitle}>{t.footer.legal}</h3>
            </div>
            <ul className={styles.linkList}>
              {legalLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className={styles.link}>
                    {link.label}
                    <ArrowUpRight
                      size={12}
                      strokeWidth={2.4}
                      className={styles.linkArrow}
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>

      {/* ===== Bottom ===== */}
      <div className={styles.bottom}>
        <p className={styles.copyright}>
          &copy; {new Date().getFullYear()}{' '}
          <span className={styles.copyrightHighlight}>
            Luis &amp; Sara Bachatango
          </span>
          . {t.footer.rights}
        </p>
        <span className={styles.bottomMeta}>
          <span className={styles.bottomMetaDot} aria-hidden="true" />
          MADRID · MUNDO
        </span>
      </div>
    </footer>
  );
}
