'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import {
  User,
  Mail,
  Tag,
  MessageSquare,
  Send,
  Instagram,
  Facebook,
  ArrowUpRight,
  CheckCircle2,
} from 'lucide-react';
import Reveal from '@/components/Reveal';
import styles from './page.module.css';
import { useLanguage } from '@/context/LanguageContext';

const EMAIL = 'booking@luisysara.com';
const INSTAGRAM = 'https://instagram.com/luisysaradance';
const FACEBOOK = 'https://facebook.com/luisysaradance';

export default function ContactPage() {
  const { t } = useLanguage();
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    // Simulamos un envío para que la UX no sea instantánea
    await new Promise((r) => setTimeout(r, 600));
    setSubmitting(false);
    setSubmitted(true);
    (e.currentTarget as HTMLFormElement).reset();
  };

  return (
    <div className={styles.container}>
      {/* ===== Hero ===== */}
      <section className={styles.hero}>
        <div className={styles.heroBg} aria-hidden="true" />
        <div className={styles.heroGrid} aria-hidden="true" />
        <span className={styles.heroCornerTL} aria-hidden="true" />
        <span className={styles.heroCornerTR} aria-hidden="true" />

        <div className={styles.heroInner}>
          <Reveal>
            <span className={styles.eyebrow}>
              <span className={styles.eyebrowLine} aria-hidden="true" />
              CONTRATACIONES · BOOKING
              <span className={styles.eyebrowLine} aria-hidden="true" />
            </span>
          </Reveal>

          <Reveal delay={0.05}>
            <h1 className={styles.title}>
              {t.contact.title.split(' ').slice(0, -1).join(' ')}{' '}
              <span className={styles.titleAccent}>
                {t.contact.title.split(' ').slice(-1)[0] ?? ''}
              </span>
            </h1>
          </Reveal>

          <Reveal delay={0.1}>
            <p className={styles.subtitle}>{t.contact.desc}</p>
          </Reveal>
        </div>
      </section>

      {/* ===== Body ===== */}
      <div className={styles.body}>
        {/* Info column */}
        <div className={styles.infoColumn}>
          <Reveal direction="left" distance={20}>
            <div className={styles.infoHeader}>
              <span className={styles.infoEyebrow}>
                <span className={styles.infoEyebrowLine} aria-hidden="true" />
                CANALES DIRECTOS
              </span>
              <h2 className={styles.infoTitle}>Hablemos sin filtros</h2>
            </div>
          </Reveal>

          <Reveal direction="left" delay={0.05}>
            <div className={styles.contactCards}>
              <a
                className={styles.contactCard}
                href={`mailto:${EMAIL}`}
              >
                <span className={styles.contactIcon} aria-hidden="true">
                  <Mail size={18} strokeWidth={1.8} />
                </span>
                <span className={styles.contactBody}>
                  <span className={styles.contactLabel}>EMAIL DIRECTO</span>
                  <span className={styles.contactValue}>{EMAIL}</span>
                </span>
                <span className={styles.contactArrow} aria-hidden="true">
                  <ArrowUpRight size={15} strokeWidth={2.4} />
                </span>
              </a>

              <a
                className={styles.contactCard}
                href={INSTAGRAM}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className={styles.contactIcon} aria-hidden="true">
                  <Instagram size={18} strokeWidth={1.8} />
                </span>
                <span className={styles.contactBody}>
                  <span className={styles.contactLabel}>INSTAGRAM</span>
                  <span className={styles.contactValue}>@luisysaradance</span>
                </span>
                <span className={styles.contactArrow} aria-hidden="true">
                  <ArrowUpRight size={15} strokeWidth={2.4} />
                </span>
              </a>

              <a
                className={styles.contactCard}
                href={FACEBOOK}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className={styles.contactIcon} aria-hidden="true">
                  <Facebook size={18} strokeWidth={1.8} />
                </span>
                <span className={styles.contactBody}>
                  <span className={styles.contactLabel}>FACEBOOK</span>
                  <span className={styles.contactValue}>luisysaradance</span>
                </span>
                <span className={styles.contactArrow} aria-hidden="true">
                  <ArrowUpRight size={15} strokeWidth={2.4} />
                </span>
              </a>
            </div>
          </Reveal>

          <Reveal direction="left" delay={0.12}>
            <div className={styles.asideCard}>
              <div className={styles.asideHalo} aria-hidden="true" />
              <p className={styles.asideQuote}>
                &ldquo;Cada festival es una conversación nueva. Cuéntanos la
                tuya y diseñemos algo a medida.&rdquo;
              </p>
              <span className={styles.asideAuthor}>LUIS Y SARA</span>
            </div>
          </Reveal>
        </div>

        {/* Form column */}
        <Reveal direction="right" distance={20}>
          <div className={styles.formCard}>
            <div className={styles.formHeader}>
              <span className={styles.formEyebrow}>
                <span className={styles.formEyebrowLine} aria-hidden="true" />
                FORMULARIO DE BOOKING
              </span>
              <h2 className={styles.formTitle}>
                Cuéntanos tu{' '}
                <span className={styles.formTitleAccent}>propuesta</span>
              </h2>
            </div>

            {submitted ? (
              <motion.div
                className={styles.success}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                role="status"
              >
                <div className={styles.successHalo} aria-hidden="true" />
                <span className={styles.successIcon} aria-hidden="true">
                  <CheckCircle2 size={26} strokeWidth={1.8} />
                </span>
                <h3 className={styles.successTitle}>
                  ¡Mensaje recibido!
                </h3>
                <p className={styles.successText}>
                  Gracias por escribirnos. Revisamos cada solicitud
                  personalmente y te responderemos en las próximas 48 horas
                  laborables.
                </p>
                <button
                  type="button"
                  className={styles.resetButton}
                  onClick={() => setSubmitted(false)}
                >
                  Enviar otro mensaje
                </button>
              </motion.div>
            ) : (
              <form className={styles.form} onSubmit={handleSubmit}>
                <div className={styles.formGroup}>
                  <label htmlFor="name" className={styles.label}>
                    <User size={11} strokeWidth={2.4} aria-hidden="true" />
                    {t.contact.form.name}
                  </label>
                  <div className={styles.inputWrap}>
                    <User
                      size={16}
                      strokeWidth={2}
                      className={styles.inputIcon}
                      aria-hidden="true"
                    />
                    <input
                      id="name"
                      name="name"
                      type="text"
                      required
                      autoComplete="name"
                      placeholder={t.contact.form.namePlace}
                      className={styles.input}
                    />
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="email" className={styles.label}>
                    <Mail size={11} strokeWidth={2.4} aria-hidden="true" />
                    {t.contact.form.email}
                  </label>
                  <div className={styles.inputWrap}>
                    <Mail
                      size={16}
                      strokeWidth={2}
                      className={styles.inputIcon}
                      aria-hidden="true"
                    />
                    <input
                      id="email"
                      name="email"
                      type="email"
                      required
                      autoComplete="email"
                      placeholder="contacto@ejemplo.com"
                      className={styles.input}
                    />
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="type" className={styles.label}>
                    <Tag size={11} strokeWidth={2.4} aria-hidden="true" />
                    {t.contact.form.type}
                  </label>
                  <div className={styles.inputWrap}>
                    <Tag
                      size={16}
                      strokeWidth={2}
                      className={styles.inputIcon}
                      aria-hidden="true"
                    />
                    <select id="type" name="type" className={styles.select} defaultValue="festival">
                      <option value="festival">{t.contact.form.types.fest}</option>
                      <option value="workshop">{t.contact.form.types.work}</option>
                      <option value="show">{t.contact.form.types.show}</option>
                      <option value="other">{t.contact.form.types.other}</option>
                    </select>
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="message" className={styles.label}>
                    <MessageSquare size={11} strokeWidth={2.4} aria-hidden="true" />
                    {t.contact.form.message}
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    required
                    placeholder={t.contact.form.messagePlace}
                    className={styles.textarea}
                    rows={6}
                  />
                </div>

                <motion.button
                  type="submit"
                  className={styles.submitButton}
                  whileTap={{ scale: 0.97 }}
                  disabled={submitting}
                >
                  <Send size={13} strokeWidth={2.4} aria-hidden="true" />
                  {submitting ? 'Enviando…' : t.contact.form.submit}
                </motion.button>
              </form>
            )}
          </div>
        </Reveal>
      </div>
    </div>
  );
}
