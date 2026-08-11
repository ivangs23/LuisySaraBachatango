'use client';

import { useEffect } from 'react';
import { useConsent } from '@/context/ConsentContext';
import { useLanguage } from '@/context/LanguageContext';
import styles from './InstagramGallery.module.css';

// Reemplaza estos enlaces con los de tus publicaciones reales de Instagram
const POST_URLS = [
  "https://www.instagram.com/p/DHBozg5IaNB/",
  "https://www.instagram.com/p/DFaFP82tusq/",
  "https://www.instagram.com/p/C_N0Vy9I9aJ/"
];

export default function InstagramGallery() {
  const { t } = useLanguage();
  const { state, hydrated, reopen } = useConsent();
  const allowed = hydrated && state?.marketing === true;

  useEffect(() => {
    // embed.js de Meta deja cookies de terceros: solo se carga con la
    // categoría `marketing` concedida.
    if (!allowed) return;

    const script = document.createElement('script');
    script.src = 'https://www.instagram.com/embed.js';
    script.async = true;
    document.body.appendChild(script);

    // Instagram inyecta los iframes sin atributo title, lo que rompe la
    // comprobación `frame-title` de Lighthouse.
    const observer = new MutationObserver(() => {
      document
        .querySelectorAll<HTMLIFrameElement>('iframe.instagram-media-rendered, iframe.instagram-media')
        .forEach((iframe) => {
          if (!iframe.title) iframe.title = 'Instagram';
        });
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      if (script.parentNode) script.parentNode.removeChild(script);
    };
  }, [allowed]);

  return (
    <section className={styles.gallery}>
      <h2 className={styles.title}>
        <span>Instagram</span>
        <a
          href="https://www.instagram.com/luisysaradance/"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'var(--primary)', textDecoration: 'none' }}
        >
          @luisysaradance
        </a>
      </h2>

      {allowed ? (
        <div className={styles.embedGrid}>
          {POST_URLS.map((url, i) => (
            <div key={i} className={styles.embedContainer}>
              <blockquote
                className="instagram-media"
                data-instgrm-permalink={url}
                data-instgrm-version="14"
                style={{
                  background: '#FFF',
                  border: '0',
                  borderRadius: '3px',
                  boxShadow: '0 0 1px 0 rgba(0,0,0,0.5),0 1px 10px 0 rgba(0,0,0,0.15)',
                  margin: '1px',
                  maxWidth: '540px',
                  minWidth: '326px',
                  padding: '0',
                  width: '100%'
                }}
              >
              </blockquote>
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.blocked}>
          <p className={styles.blockedText}>{t.consent.embedBlocked}</p>
          <button type="button" className={styles.blockedCta} onClick={reopen}>
            {t.consent.enableEmbed}
          </button>
        </div>
      )}
    </section>
  );
}
