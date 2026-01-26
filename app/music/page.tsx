'use client';

import styles from './page.module.css';
import { useLanguage } from '@/context/LanguageContext';

export default function MusicPage() {
  const { t } = useLanguage();

  const PLAYLISTS = [
    {
      id: 1,
      title: "Bachatango Essentials",
      embedUrl: "https://open.spotify.com/embed/playlist/37i9dQZF1DX8g4kO4dJ8T6?utm_source=generator&theme=0"
    },
    {
      id: 2,
      title: "Romeo Santos - Propuesta Indecente",
      embedUrl: "https://open.spotify.com/embed/track/5PycBIeabfvX3n9ILG7Vrv?utm_source=generator"
    },
    {
      id: 3,
      title: "Romeo Santos - Eres Mía",
      embedUrl: "https://open.spotify.com/embed/track/2bzE14Yl13d4A68M41sO4f?utm_source=generator" 
    },
    {
      id: 4,
      title: "Romeo Santos - Imitadora",
      embedUrl: "https://open.spotify.com/embed/track/6r46lnXFbE9fr2dvoMQnrF?utm_source=generator" 
    },
    {
      id: 5,
      title: "Tango Argentino",
      embedUrl: "https://open.spotify.com/embed/playlist/37i9dQZF1DWV5s0d3XQcWn?utm_source=generator&theme=0"
    }
  ];

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>{t.music.title}</h1>
      <p className={styles.subtitle}>
        {t.music.desc}
      </p>

      <div className={styles.grid}>
        {PLAYLISTS.map(playlist => (
          <div key={playlist.id} className={styles.card}>
            <div className={styles.iframeWrapper}>
              <iframe 
                style={{borderRadius: '12px'}} 
                src={playlist.embedUrl} 
                width="100%" 
                height="100%" 
                frameBorder="0" 
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" 
                loading="lazy">
              </iframe>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
