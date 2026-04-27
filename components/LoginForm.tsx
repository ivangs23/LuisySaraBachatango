'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import { Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import styles from '@/app/login/login.module.css';
import { login } from '@/app/login/actions';

type LoginFormProps = {
  labels: {
    email: string;
    password: string;
    submit: string;
    noAccount: string;
    forgotPassword: string;
    or: string;
  };
};

export default function LoginForm({ labels }: LoginFormProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form className={styles.form}>
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
            autoComplete="current-password"
            placeholder="••••••••"
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
          formAction={login}
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
          <Link href="/signup" className={styles.buttonSecondary}>
            {labels.noAccount}
          </Link>
          <Link href="/forgot-password" className={styles.linkSubtle}>
            {labels.forgotPassword}
          </Link>
        </div>
      </div>
    </form>
  );
}
