'use client';

import { useState, useEffect, useRef } from 'react';
import { LayoutGroup, motion } from 'motion/react';
import {
  User,
  Image as ImageIcon,
  Instagram,
  Facebook,
  Music2,
  Youtube,
  Save,
} from 'lucide-react';
import { updateProfile } from '@/app/profile/actions';
import styles from '@/app/profile/profile.module.css';

// Mapeo de códigos devueltos por updateProfile a mensajes en español
const ERROR_MESSAGES: Record<string, string> = {
  invalid_type:
    'Tipo de archivo no permitido. Solo se aceptan imágenes (JPG, PNG, WebP, GIF).',
  too_large: 'El archivo es demasiado grande. El tamaño máximo es 5MB.',
  invalid_image: 'El archivo no es una imagen válida.',
  upload_failed: 'Error al subir el avatar. Inténtalo de nuevo.',
  update_failed: 'No se pudieron guardar los cambios. Inténtalo de nuevo.',
};

const GENERIC_ERROR =
  'No se pudieron guardar los cambios. Revisa el tamaño/formato del avatar (máx. 5MB) e inténtalo de nuevo.';

type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  instagram: string | null;
  facebook: string | null;
  tiktok: string | null;
  youtube: string | null;
};

export default function ProfileForm({ profile }: { profile: Profile }) {
  const initialMode: 'url' | 'upload' =
    profile.avatar_url?.startsWith('http') &&
    !profile.avatar_url.includes('supabase')
      ? 'url'
      : 'upload';

  const [avatarMode, setAvatarMode] = useState<'url' | 'upload'>(initialMode);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    profile.avatar_url || null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // URL de blob activa para la preview del avatar — se revoca al reemplazarla
  // y al desmontar, para no fugar object URLs.
  const objectUrlRef = useRef<string | null>(null);

  const [fullName, setFullName] = useState(profile.full_name || '');
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url || '');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [instagram, setInstagram] = useState(profile.instagram || '');
  const [facebook, setFacebook] = useState(profile.facebook || '');
  const [tiktok, setTikTok] = useState(profile.tiktok || '');
  const [youtube, setYoutube] = useState(profile.youtube || '');

  useEffect(() => {
    const isAvatarChanged =
      (avatarMode === 'upload' && !!avatarFile) ||
      (avatarMode === 'url' && avatarUrl !== (profile.avatar_url || ''));

    const hasChanges =
      fullName !== (profile.full_name || '') ||
      instagram !== (profile.instagram || '') ||
      facebook !== (profile.facebook || '') ||
      tiktok !== (profile.tiktok || '') ||
      youtube !== (profile.youtube || '') ||
      isAvatarChanged;

    setIsDirty(hasChanges);
  }, [
    fullName,
    instagram,
    facebook,
    tiktok,
    youtube,
    avatarMode,
    avatarUrl,
    avatarFile,
    profile,
  ]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, []);

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
      const objectUrl = URL.createObjectURL(file);
      objectUrlRef.current = objectUrl;
      setAvatarPreview(objectUrl);
    }
  };

  const handleAvatarUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAvatarUrl(e.target.value);
    setAvatarPreview(e.target.value);
  };

  const handleSubmit = async (formData: FormData) => {
    setIsSubmitting(true);
    setSubmitError(null);
    formData.append('avatarMode', avatarMode);

    try {
      const res = await updateProfile(formData);
      if ('error' in res) {
        setSubmitError(ERROR_MESSAGES[res.error] ?? GENERIC_ERROR);
      } else {
        setIsDirty(false);
      }
    } catch (e) {
      // En prod los errores lanzados por Server Actions llegan enmascarados;
      // mostramos un mensaje genérico visible en lugar de fallar en silencio.
      console.error(e);
      setSubmitError(GENERIC_ERROR);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form action={handleSubmit} className={styles.form}>
      {/* Nombre */}
      <div className={styles.formGroup}>
        <label htmlFor="fullName" className={styles.formLabel}>
          <User size={12} strokeWidth={2.4} aria-hidden="true" />
          Nombre completo
        </label>
        <input
          id="fullName"
          name="fullName"
          type="text"
          className={styles.formInput}
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Tu nombre"
        />
      </div>

      {/* Avatar */}
      <div className={styles.formGroup}>
        <span className={styles.formLabel}>
          <ImageIcon size={12} strokeWidth={2.4} aria-hidden="true" />
          Avatar
        </span>

        <LayoutGroup id="avatar-mode-tabs">
          <div className={styles.avatarModes} role="tablist" aria-label="Modo de avatar">
            <button
              type="button"
              role="tab"
              aria-selected={avatarMode === 'upload'}
              onClick={() => setAvatarMode('upload')}
              className={`${styles.avatarModeBtn} ${
                avatarMode === 'upload' ? styles.avatarModeActive : ''
              }`}
            >
              {avatarMode === 'upload' && (
                <motion.span
                  layoutId="avatar-mode-indicator"
                  className={styles.avatarModeIndicator}
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                />
              )}
              <span style={{ position: 'relative', zIndex: 1 }}>Subir foto</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={avatarMode === 'url'}
              onClick={() => setAvatarMode('url')}
              className={`${styles.avatarModeBtn} ${
                avatarMode === 'url' ? styles.avatarModeActive : ''
              }`}
            >
              {avatarMode === 'url' && (
                <motion.span
                  layoutId="avatar-mode-indicator"
                  className={styles.avatarModeIndicator}
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                />
              )}
              <span style={{ position: 'relative', zIndex: 1 }}>URL externa</span>
            </button>
          </div>
        </LayoutGroup>

        {avatarMode === 'upload' ? (
          <div className={styles.avatarUploadDrop}>
            <input
              type="file"
              name="avatarFile"
              accept="image/*"
              onChange={handleAvatarFileChange}
              className={styles.avatarUploadInput}
            />
          </div>
        ) : (
          <input
            id="avatarUrl"
            name="avatarUrl"
            type="url"
            className={styles.formInput}
            value={avatarUrl}
            onChange={handleAvatarUrlChange}
            placeholder="https://example.com/avatar.jpg"
          />
        )}

        {avatarPreview && avatarPreview.startsWith('http') && (
          <div className={styles.avatarPreview}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={avatarPreview}
              alt="Vista previa del avatar"
              className={styles.avatarPreviewImg}
            />
          </div>
        )}
        {avatarPreview && avatarPreview.startsWith('blob:') && (
          <div className={styles.avatarPreview}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={avatarPreview}
              alt="Vista previa del avatar"
              className={styles.avatarPreviewImg}
            />
          </div>
        )}
      </div>

      {/* Divider redes */}
      <div className={styles.formDivider}>
        <span className={styles.formDividerLine} aria-hidden="true" />
        <span className={styles.formDividerLabel}>Redes sociales</span>
        <span className={styles.formDividerLine} aria-hidden="true" />
      </div>

      <div className={styles.formGroup}>
        <label htmlFor="instagram" className={styles.formLabel}>
          <Instagram size={12} strokeWidth={2.4} aria-hidden="true" />
          Instagram
        </label>
        <input
          id="instagram"
          name="instagram"
          type="url"
          className={styles.formInput}
          value={instagram}
          onChange={(e) => setInstagram(e.target.value)}
          placeholder="https://instagram.com/tu_usuario"
        />
      </div>

      <div className={styles.formGroup}>
        <label htmlFor="facebook" className={styles.formLabel}>
          <Facebook size={12} strokeWidth={2.4} aria-hidden="true" />
          Facebook
        </label>
        <input
          id="facebook"
          name="facebook"
          type="url"
          className={styles.formInput}
          value={facebook}
          onChange={(e) => setFacebook(e.target.value)}
          placeholder="https://facebook.com/tu_usuario"
        />
      </div>

      <div className={styles.formGroup}>
        <label htmlFor="tiktok" className={styles.formLabel}>
          <Music2 size={12} strokeWidth={2.4} aria-hidden="true" />
          TikTok
        </label>
        <input
          id="tiktok"
          name="tiktok"
          type="url"
          className={styles.formInput}
          value={tiktok}
          onChange={(e) => setTikTok(e.target.value)}
          placeholder="https://tiktok.com/@tu_usuario"
        />
      </div>

      <div className={styles.formGroup}>
        <label htmlFor="youtube" className={styles.formLabel}>
          <Youtube size={12} strokeWidth={2.4} aria-hidden="true" />
          YouTube
        </label>
        <input
          id="youtube"
          name="youtube"
          type="url"
          className={styles.formInput}
          value={youtube}
          onChange={(e) => setYoutube(e.target.value)}
          placeholder="https://youtube.com/@tu_canal"
        />
      </div>

      {submitError && (
        <p role="alert" className={styles.formError}>
          {submitError}
        </p>
      )}

      <motion.button
        type="submit"
        disabled={!isDirty || isSubmitting}
        className={styles.formSubmit}
        whileTap={!isDirty || isSubmitting ? undefined : { scale: 0.97 }}
      >
        {isSubmitting ? (
          <>
            <span className={styles.spinner} aria-hidden="true" />
            Guardando...
          </>
        ) : (
          <>
            <Save size={14} strokeWidth={2.4} aria-hidden="true" />
            Guardar cambios
          </>
        )}
      </motion.button>
    </form>
  );
}
