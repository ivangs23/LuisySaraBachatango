'use client';

import styles from './page.module.css';
import { useLanguage } from '@/context/LanguageContext';

export default function ContactPage() {
  const { t } = useLanguage();
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert('Gracias por tu mensaje. Nos pondremos en contacto contigo pronto.');
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>{t.contact.title}</h1>
      <p className={styles.subtitle}>
        {t.contact.desc}
      </p>

      <div className={styles.formWrapper}>
        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label htmlFor="name" className={styles.label}>{t.contact.form.name}</label>
            <input type="text" id="name" className={styles.input} required placeholder={t.contact.form.namePlace} />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="email" className={styles.label}>{t.contact.form.email}</label>
            <input type="email" id="email" className={styles.input} required placeholder="contacto@ejemplo.com" />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="type" className={styles.label}>{t.contact.form.type}</label>
            <select id="type" className={styles.select}>
              <option value="festival">{t.contact.form.types.fest}</option>
              <option value="workshop">{t.contact.form.types.work}</option>
              <option value="show">{t.contact.form.types.show}</option>
              <option value="other">{t.contact.form.types.other}</option>
            </select>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="message" className={styles.label}>{t.contact.form.message}</label>
            <textarea id="message" className={styles.textarea} rows={5} placeholder={t.contact.form.messagePlace} required></textarea>
          </div>

          <button type="submit" className={styles.submitButton}>{t.contact.form.submit}</button>
        </form>
      </div>

      <div className={styles.infoGrid}>
        <div className={styles.infoItem}>
          <h3>Email Directo</h3>
          <p>booking@luisysara.com</p>
        </div>
        <div className={styles.infoItem}>
          <h3>Redes Sociales</h3>
          <p>@luisysaradance</p>
        </div>
      </div>
    </div>
  );
}
