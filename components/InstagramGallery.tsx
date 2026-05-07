'use client';

import { useEffect } from 'react';
import styles from './InstagramGallery.module.css';

// Remplaza estos enlaces con los de tus publicaciones reales de Instagram
const POST_URLS = [
  "https://www.instagram.com/p/DHBozg5IaNB/", 
  "https://www.instagram.com/p/DFaFP82tusq/", 
  "https://www.instagram.com/p/C_N0Vy9I9aJ/"  
];

export default function InstagramGallery() {
  
  useEffect(() => {
    const script = document.createElement('script');
    script.src = "//www.instagram.com/embed.js";
    script.async = true;
    document.body.appendChild(script);

    // Instagram's embed.js injects iframes without a title attribute, which
    // breaks the Lighthouse `frame-title` accessibility check.
    const observer = new MutationObserver(() => {
      document.querySelectorAll<HTMLIFrameElement>('iframe.instagram-media-rendered, iframe.instagram-media').forEach((iframe) => {
        if (!iframe.title) iframe.title = 'Publicación de Instagram';
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      if (script.parentNode) script.parentNode.removeChild(script);
    }
  }, []);

  return (
    <section className={styles.gallery}>
      <h2 className={styles.title}>
        <span>Síguenos en Instagram</span>
        <a 
          href="https://www.instagram.com/luisysaradance/" 
          target="_blank" 
          rel="noopener noreferrer"
          style={{color: 'var(--primary)', textDecoration: 'none'}}
        >
          @luisysaradance
        </a>
      </h2>
      
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
    </section>
  );
}
