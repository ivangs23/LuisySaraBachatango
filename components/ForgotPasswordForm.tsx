'use client';

import Link from 'next/link';
import { motion } from 'motion/react';
import { Mail, ArrowRight, ArrowLeft } from 'lucide-react';
import styles from '@/app/login/login.module.css';
import { resetPassword } from '@/app/login/actions';

type ForgotPasswordFormProps = {
  labels: {
    email: string;
    submit: string;
    backToLogin: string;
  };
};

export default function ForgotPasswordForm({ labels }: ForgotPasswordFormProps) {
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

      <div className={styles.actions}>
        <motion.button
          type="submit"
          formAction={resetPassword}
          className={styles.buttonPrimary}
          whileTap={{ scale: 0.97 }}
        >
          {labels.submit}
          <ArrowRight size={14} strokeWidth={2.6} aria-hidden="true" />
        </motion.button>

        <div className={styles.secondaryLinks}>
          <Link href="/login" className={styles.buttonSecondary}>
            <ArrowLeft size={13} strokeWidth={2.6} aria-hidden="true" />
            {labels.backToLogin}
          </Link>
        </div>
      </div>
    </form>
  );
}
