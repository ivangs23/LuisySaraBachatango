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
import { safeAvatarUrl } from '@/utils/sanitize';
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
  roleMember: string;
  roleAdmin: string;
  rolePremium: string;
  roleAdminFull: string;
  subscriptionActiveBadge: string;
  sinceBadge: string;
  coursesPurchased: string;
  lifetimeAccess: string;
  lessonsCompleted: string;
  globalProgress: string;
  statActive: string;
  statNoPlan: string;
  renewsOn: string;
  noPlanActive: string;
  personalInfo: string;
  yourPlan: string;
  account: string;
  role: string;
  memberSince: string;
  irreversibleActions: string;
  password: string;
  currentPasswordPlaceholder: string;
  viewCourses: string;
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
  months: readonly string[];
  deleteAccountAction: (formData: FormData) => Promise<void>;
};

function formatDate(iso: string | null, months: readonly string[]): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function formatMonthYear(iso: string | null, months: readonly string[]): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
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
  months,
  deleteAccountAction,
}: Props) {
  const displayName = profile.full_name?.trim() || userEmail.split('@')[0];
  const role = (profile.role ?? 'member').toLowerCase();
  const roleLabel =
    role === 'admin' ? t.roleAdmin : role === 'premium' ? t.rolePremium : t.roleMember;
  const isSubscriptionActive =
    !!subscription &&
    (subscription.status === 'active' || subscription.status === 'trialing') &&
    (subscription.current_period_end
      ? new Date(subscription.current_period_end) > new Date()
      : true);
  const subscriptionEndLabel = formatDate(subscription?.current_period_end ?? null, months);
  const memberSinceLabel = formatMonthYear(memberSince, months);
  const initials = getInitials(profile.full_name, userEmail);

  // safeAvatarUrl (no startsWith('http')): un host fuera de remotePatterns hace
  // que <Image> lance en render y rompe la página para ese usuario. Existen
  // avatares externos legacy (ProfileForm tiene modo URL) — devolver null los
  // degrada al fallback de iniciales en vez de crashear (AUDITORIA-2026-07 M8).
  const safeAvatar = safeAvatarUrl(profile.avatar_url);

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
                  {safeAvatar ? (
                    <Image
                      src={safeAvatar}
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
                      {t.subscriptionActiveBadge}
                    </span>
                  )}
                  {memberSinceLabel && (
                    <span className={styles.heroBadge}>
                      <CalendarDays size={12} strokeWidth={2.2} aria-hidden="true" />
                      {t.sinceBadge.replace('{date}', memberSinceLabel)}
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
              <span className={styles.statLabel}>{t.coursesPurchased}</span>
              <p className={styles.statSub}>
                <BookOpen size={11} strokeWidth={2.2} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                {t.lifetimeAccess}
              </p>
            </div>
          </Reveal>
          <Reveal delay={0.12}>
            <div className={styles.statCard}>
              <span className={styles.statValue}>{lessonsCompletedCount}</span>
              <span className={styles.statLabel}>{t.lessonsCompleted}</span>
              <p className={styles.statSub}>
                <CheckCircle2 size={11} strokeWidth={2.2} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                {t.globalProgress}
              </p>
            </div>
          </Reveal>
          <Reveal delay={0.19}>
            <div className={styles.statCard}>
              <span className={styles.statValue}>
                {isSubscriptionActive ? t.statActive : t.statNoPlan}
              </span>
              <span className={styles.statLabel}>{t.subscription}</span>
              <p className={styles.statSub}>
                <Sparkles size={11} strokeWidth={2.2} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                {isSubscriptionActive && subscriptionEndLabel
                  ? t.renewsOn.replace('{date}', subscriptionEndLabel)
                  : t.noPlanActive}
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
              <h2 className={styles.sectionTitle}>{t.personalInfo}</h2>
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
                <h2 className={styles.sectionTitle}>{t.yourPlan}</h2>
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
                <Link href="/courses" className={styles.subCta}>
                  {t.viewCourses}
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
                <h2 className={styles.sectionTitle}>{t.account}</h2>
              </div>

              <div className={styles.infoGrid}>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>{t.email}</span>
                  <span className={styles.infoValue}>{userEmail}</span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>{t.role}</span>
                  <span className={styles.infoValue}>
                    {isAdmin ? t.roleAdminFull : roleLabel}
                  </span>
                </div>
                {memberSinceLabel && (
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>{t.memberSince}</span>
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
              <h2 className={styles.dangerTitle}>{t.irreversibleActions}</h2>
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
                  {t.password}
                  <input
                    type="password"
                    name="password"
                    required
                    autoComplete="current-password"
                    placeholder={t.currentPasswordPlaceholder}
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
