'use client';

import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'motion/react';
import {
  BookOpen,
  CheckCircle2,
  CalendarDays,
  Sparkles,
  ShieldCheck,
  LogOut,
  Trash2,
  ArrowUpRight,
} from 'lucide-react';
import Reveal from '@/components/Reveal';
import ProfileForm from '@/components/ProfileForm';
import styles from '@/app/profile/profile.module.css';

type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  instagram: string | null;
  facebook: string | null;
  tiktok: string | null;
  youtube: string | null;
  role?: string | null;
};

type Subscription = {
  id: string;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
} | null;

type Dict = {
  title: string;
  editProfile: string;
  accountInfo: string;
  email: string;
  subscription: string;
  status: string;
  active: string;
  inactive: string;
  activeUntil: string;
  noActiveSubscription: string;
  dangerZone: string;
  undoableWarning: string;
  logout: string;
  deleteAccount: string;
};

type Props = {
  profile: Profile;
  userEmail: string;
  memberSince: string | null;
  subscription: Subscription;
  coursesPurchasedCount: number;
  lessonsCompletedCount: number;
  isAdmin: boolean;
  t: Dict;
  deleteAccountAction: (formData: FormData) => Promise<void>;
};

const MONTHS_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getDate()} ${MONTHS_ES[d.getMonth()]} ${d.getFullYear()}`;
}

function formatMonthYear(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${MONTHS_ES[d.getMonth()]} ${d.getFullYear()}`;
}

function getInitials(name: string | null, email: string): string {
  const source = name?.trim() || email;
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function ProfileView({
  profile,
  userEmail,
  memberSince,
  subscription,
  coursesPurchasedCount,
  lessonsCompletedCount,
  isAdmin,
  t,
  deleteAccountAction,
}: Props) {
  const displayName = profile.full_name?.trim() || userEmail.split('@')[0];
  const role = (profile.role ?? 'member').toLowerCase();
  const roleLabel =
    role === 'admin' ? 'ADMIN' : role === 'premium' ? 'PREMIUM' : 'MIEMBRO';
  const isSubscriptionActive =
    !!subscription &&
    (subscription.status === 'active' || subscription.status === 'trialing') &&
    (subscription.current_period_end
      ? new Date(subscription.current_period_end) > new Date()
      : true);
  const subscriptionEndLabel = formatDate(subscription?.current_period_end ?? null);
  const memberSinceLabel = formatMonthYear(memberSince);
  const initials = getInitials(profile.full_name, userEmail);

  const hasValidAvatar =
    profile.avatar_url && profile.avatar_url.startsWith('http');

  return (
    <div className={styles.container}>
      {/* ============== HERO ============== */}
      <section className={styles.hero}>
        <div className={styles.heroBg} aria-hidden="true" />

        <div className={styles.heroInner}>
          <Reveal direction="left" distance={20}>
            <span className={styles.eyebrow}>
              <span className={styles.eyebrowLine} aria-hidden="true" />
              {t.title.toUpperCase()}
            </span>
          </Reveal>

          <div className={styles.heroMain}>
            <Reveal direction="up" distance={16}>
              <div className={styles.avatarWrap}>
                <span className={styles.avatarHalo} aria-hidden="true" />
                <div className={styles.avatarRing}>
                  {hasValidAvatar ? (
                    <Image
                      src={profile.avatar_url!}
                      alt={displayName}
                      width={160}
                      height={160}
                      className={styles.avatar}
                    />
                  ) : (
                    <div className={styles.avatarFallback} aria-hidden="true">
                      {initials}
                    </div>
                  )}
                </div>
              </div>
            </Reveal>

            <div className={styles.heroBody}>
              <Reveal delay={0.06}>
                <h1 className={styles.heroName}>{displayName}</h1>
              </Reveal>
              <Reveal delay={0.12}>
                <p className={styles.heroEmail}>{userEmail}</p>
              </Reveal>

              <Reveal delay={0.18}>
                <div className={styles.heroBadges}>
                  <span
                    className={`${styles.heroBadge} ${
                      role !== 'member' ? styles.heroBadgePrimary : ''
                    }`}
                  >
                    <ShieldCheck size={12} strokeWidth={2.5} aria-hidden="true" />
                    {roleLabel}
                  </span>
                  {isSubscriptionActive && (
                    <span className={styles.heroBadgeAccess}>
                      <Sparkles size={12} strokeWidth={2.5} aria-hidden="true" />
                      Suscripción activa
                    </span>
                  )}
                  {memberSinceLabel && (
                    <span className={styles.heroBadge}>
                      <CalendarDays size={12} strokeWidth={2.2} aria-hidden="true" />
                      Desde {memberSinceLabel}
                    </span>
                  )}
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* ============== STATS ============== */}
      <section className={styles.statsSection}>
        <div className={styles.statsGrid}>
          <Reveal delay={0.05}>
            <div className={styles.statCard}>
              <span className={styles.statValue}>{coursesPurchasedCount}</span>
              <span className={styles.statLabel}>Cursos comprados</span>
              <p className={styles.statSub}>
                <BookOpen size={11} strokeWidth={2.2} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                Acceso vitalicio
              </p>
            </div>
          </Reveal>
          <Reveal delay={0.12}>
            <div className={styles.statCard}>
              <span className={styles.statValue}>{lessonsCompletedCount}</span>
              <span className={styles.statLabel}>Lecciones completadas</span>
              <p className={styles.statSub}>
                <CheckCircle2 size={11} strokeWidth={2.2} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                Progreso global
              </p>
            </div>
          </Reveal>
          <Reveal delay={0.19}>
            <div className={styles.statCard}>
              <span className={styles.statValue}>
                {isSubscriptionActive ? 'Activa' : 'Sin plan'}
              </span>
              <span className={styles.statLabel}>Suscripción</span>
              <p className={styles.statSub}>
                <Sparkles size={11} strokeWidth={2.2} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                {isSubscriptionActive && subscriptionEndLabel
                  ? `Renueva el ${subscriptionEndLabel}`
                  : 'No hay plan activo'}
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ============== MAIN ============== */}
      <div className={styles.main}>
        {/* --- Edit profile (form) --- */}
        <Reveal>
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionEyebrow}>
                <span className={styles.sectionEyebrowLine} aria-hidden="true" />
                {t.editProfile.toUpperCase()}
              </span>
              <h2 className={styles.sectionTitle}>Tu información personal</h2>
            </div>
            <ProfileForm profile={profile} />
          </div>
        </Reveal>

        {/* --- Side stack --- */}
        <div className={styles.sideStack}>
          <Reveal delay={0.08}>
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionEyebrow}>
                  <span className={styles.sectionEyebrowLine} aria-hidden="true" />
                  {t.subscription.toUpperCase()}
                </span>
                <h2 className={styles.sectionTitle}>Tu plan</h2>
              </div>

              <div className={styles.subscriptionStatus}>
                <span
                  className={`${styles.subDot} ${
                    isSubscriptionActive ? styles.subDotActive : styles.subDotInactive
                  }`}
                  aria-hidden="true"
                />
                <span>
                  {t.status}:{' '}
                  <strong>{isSubscriptionActive ? t.active : t.inactive}</strong>
                </span>
              </div>

              {isSubscriptionActive && subscriptionEndLabel ? (
                <p className={styles.subDetail}>
                  {t.activeUntil}{' '}
                  <span className={styles.subPeriod}>{subscriptionEndLabel}</span>.
                </p>
              ) : (
                <p className={styles.subDetail}>{t.noActiveSubscription}</p>
              )}

              {!isSubscriptionActive && (
                <Link href="/pricing" className={styles.subCta}>
                  Ver planes
                  <ArrowUpRight size={14} strokeWidth={2.4} />
                </Link>
              )}
            </div>
          </Reveal>

          <Reveal delay={0.16}>
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionEyebrow}>
                  <span className={styles.sectionEyebrowLine} aria-hidden="true" />
                  {t.accountInfo.toUpperCase()}
                </span>
                <h2 className={styles.sectionTitle}>Cuenta</h2>
              </div>

              <div className={styles.infoGrid}>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>{t.email}</span>
                  <span className={styles.infoValue}>{userEmail}</span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Rol</span>
                  <span className={styles.infoValue}>
                    {isAdmin ? 'Administrador' : roleLabel}
                  </span>
                </div>
                {memberSinceLabel && (
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Miembro desde</span>
                    <span className={styles.infoValue}>{memberSinceLabel}</span>
                  </div>
                )}
              </div>
            </div>
          </Reveal>
        </div>
      </div>

      {/* ============== DANGER ZONE ============== */}
      <Reveal delay={0.1}>
        <section className={styles.dangerSection}>
          <div className={styles.dangerCard}>
            <div className={styles.dangerHeader}>
              <span className={styles.dangerEyebrow}>
                <span className={styles.dangerEyebrowLine} aria-hidden="true" />
                {t.dangerZone.toUpperCase()}
              </span>
              <h2 className={styles.dangerTitle}>Acciones irreversibles</h2>
            </div>
            <p className={styles.dangerSub}>{t.undoableWarning}</p>

            <div className={styles.dangerActions}>
              <form action="/auth/signout" method="post">
                <motion.button
                  type="submit"
                  className={styles.logoutButton}
                  whileTap={{ scale: 0.97 }}
                >
                  <LogOut size={14} strokeWidth={2.3} aria-hidden="true" />
                  {t.logout}
                </motion.button>
              </form>

              <form action={deleteAccountAction} className={styles.deleteForm}>
                <label className={styles.deletePasswordLabel}>
                  Contraseña
                  <input
                    type="password"
                    name="password"
                    required
                    autoComplete="current-password"
                    placeholder="Tu contraseña actual"
                    className={styles.deletePasswordInput}
                  />
                </label>
                <motion.button
                  type="submit"
                  className={styles.deleteButton}
                  whileTap={{ scale: 0.97 }}
                >
                  <Trash2 size={14} strokeWidth={2.3} aria-hidden="true" />
                  {t.deleteAccount}
                </motion.button>
              </form>
            </div>
          </div>
        </section>
      </Reveal>
    </div>
  );
}
