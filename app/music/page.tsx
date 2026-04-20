'use client';

import styles from './page.module.css';
import { useLanguage } from '@/context/LanguageContext';

export default function MusicPage() {
  const { t } = useLanguage();

  const PLAYLIST_EMBED_URL = "https://open.spotify.com/embed/playlist/0ifxajxVxpgIoQe9ymIre5?utm_source=generator&theme=0";

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>{t.music.title}</h1>
      <p className={styles.subtitle}>
        {t.music.desc}
      </p>

      <div className={styles.playlistWrapper}>
        <iframe
          style={{ borderRadius: '12px' }}
          src={PLAYLIST_EMBED_URL}
          width="100%"
          height="100%"
          frameBorder="0"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
        />
      </div>
    </div>
  );
}
