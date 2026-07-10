'use client';

import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'motion/react';
import { Lock, Eye, EyeOff, ArrowRight, AlertTriangle } from 'lucide-react';
import styles from '@/app/login/login.module.css';
import { updatePassword } from '@/app/reset-password/actions';

type ResetPasswordFormProps = {
  labels: {
    password: string;
    confirmPassword: string;
    submit: string;
    mismatch: string;
    errorPasswordTooShort: string;
    errorUpdateFailed: string;
  };
};

export default function ResetPasswordForm({ labels }: ResetPasswordFormProps) {
  const searchParams = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mismatchError, setMismatchError] = useState(false);

  const errorParam = searchParams.get('error');
  const serverErrorMsg =
    errorParam === 'password_too_short'
      ? labels.errorPasswordTooShort
      : errorParam === 'update_failed'
        ? labels.errorUpdateFailed
        : null;

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    if (password !== confirmPassword) {
      e.preventDefault();
      setMismatchError(true);
      return;
    }
    setMismatchError(false);
  }

  return (
    <form className={styles.form} action={updatePassword} onSubmit={handleSubmit}>
      {mismatchError ? (
        <div className={styles.error} role="alert">
          <AlertTriangle
            size={16}
            strokeWidth={2.2}
            className={styles.alertIcon}
            aria-hidden="true"
          />
          <span>{labels.mismatch}</span>
        </div>
      ) : (
        serverErrorMsg && (
          <div className={styles.error} role="alert">
            <AlertTriangle
              size={16}
              strokeWidth={2.2}
              className={styles.alertIcon}
              aria-hidden="true"
            />
            <span>{serverErrorMsg}</span>
          </div>
        )
      )}

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
            className={`${styles.input} ${styles.inputPassword}`}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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

      <div className={styles.group}>
        <label htmlFor="confirmPassword" className={styles.label}>
          <Lock size={11} strokeWidth={2.4} aria-hidden="true" />
          {labels.confirmPassword}
        </label>
        <div className={styles.inputWrap}>
          <Lock
            size={16}
            strokeWidth={2}
            className={styles.inputIcon}
            aria-hidden="true"
          />
          <input
            id="confirmPassword"
            name="confirmPassword"
            type={showConfirmPassword ? 'text' : 'password'}
            required
            autoComplete="new-password"
            placeholder="••••••••"
            className={`${styles.input} ${styles.inputPassword}`}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          <button
            type="button"
            className={styles.passwordToggle}
            onClick={() => setShowConfirmPassword((v) => !v)}
            aria-label={
              showConfirmPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'
            }
            aria-pressed={showConfirmPassword}
          >
            {showConfirmPassword ? (
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
          className={styles.buttonPrimary}
          whileTap={{ scale: 0.97 }}
        >
          {labels.submit}
          <ArrowRight size={14} strokeWidth={2.6} aria-hidden="true" />
        </motion.button>
      </div>
    </form>
  );
}
