'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import { Mail, Lock, User, Eye, EyeOff, ArrowRight } from 'lucide-react';
import styles from '@/app/login/login.module.css';
import { signup } from '@/app/login/actions';

type SignupFormProps = {
  labels: {
    email: string;
    fullName: string;
    fullNamePlaceholder: string;
    password: string;
    submit: string;
    hasAccount: string;
    forgotPassword: string;
    or: string;
  };
};

export default function SignupForm({ labels }: SignupFormProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form className={styles.form}>
      <div className={styles.group}>
        <label htmlFor="fullName" className={styles.label}>
          <User size={11} strokeWidth={2.4} aria-hidden="true" />
          {labels.fullName}
        </label>
        <div className={styles.inputWrap}>
          <User
            size={16}
            strokeWidth={2}
            className={styles.inputIcon}
            aria-hidden="true"
          />
          <input
            id="fullName"
            name="fullName"
            type="text"
            required
            autoComplete="name"
            placeholder={labels.fullNamePlaceholder}
            className={styles.input}
          />
        </div>
      </div>

      <div className={styles.group}>
        <label htmlFor="email" className={styles.label}>
          <Mail size={11} strokeWidth={2.4} aria-hidden="true" />
          {labels.email}
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
            placeholder="tu@email.com"
            className={styles.input}
          />
        </div>
      </div>

      <div className={styles.group}>
        <label htmlFor="password" className={styles.label}>
          <Lock size={11} strokeWidth={2.4} aria-hidden="true" />
          {labels.password}
        </label>
        <div className={styles.inputWrap}>
          <Lock
            size={16}
            strokeWidth={2}
            className={styles.inputIcon}
            aria-hidden="true"
          />
          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            required
            autoComplete="new-password"
            placeholder="••••••••"
            minLength={6}
            className={`${styles.input} ${styles.inputPassword}`}
          />
          <button
            type="button"
            className={styles.passwordToggle}
            onClick={() => setShowPassword((v) => !v)}
            aria-label={
              showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'
            }
            aria-pressed={showPassword}
          >
            {showPassword ? (
              <EyeOff size={15} strokeWidth={2.2} />
            ) : (
              <Eye size={15} strokeWidth={2.2} />
            )}
          </button>
        </div>
      </div>

      <div className={styles.actions}>
        <motion.button
          type="submit"
          formAction={signup}
          className={styles.buttonPrimary}
          whileTap={{ scale: 0.97 }}
        >
          {labels.submit}
          <ArrowRight size={14} strokeWidth={2.6} aria-hidden="true" />
        </motion.button>

        <div className={styles.divider}>
          <span className={styles.dividerLine} aria-hidden="true" />
          <span className={styles.dividerLabel}>{labels.or}</span>
          <span className={styles.dividerLine} aria-hidden="true" />
        </div>

        <div className={styles.secondaryLinks}>
          <Link href="/login" className={styles.buttonSecondary}>
            {labels.hasAccount}
          </Link>
          <Link href="/forgot-password" className={styles.linkSubtle}>
            {labels.forgotPassword}
          </Link>
        </div>
      </div>
    </form>
  );
}
