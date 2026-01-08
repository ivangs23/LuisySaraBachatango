'use client';

import { useState, useEffect } from 'react';
import { updateProfile } from '@/app/profile/actions';
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
};

export default function ProfileForm({ profile }: { profile: Profile }) {
  const [avatarMode, setAvatarMode] = useState<'url' | 'upload'>(profile.avatar_url?.startsWith('http') && !profile.avatar_url.includes('supabase') ? 'url' : 'upload');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(profile.avatar_url || null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Controlled inputs
  const [fullName, setFullName] = useState(profile.full_name || '');
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url || '');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [instagram, setInstagram] = useState(profile.instagram || '');
  const [facebook, setFacebook] = useState(profile.facebook || '');
  const [tiktok, setTikTok] = useState(profile.tiktok || '');
  const [youtube, setYoutube] = useState(profile.youtube || '');

  // Dirty check
  useEffect(() => {
    // Determine if effective avatar has changed
    // If upload mode and a file is selected -> dirty
    // If url mode and url != initial -> dirty
    // If mode changed (e.g. was url, now upload but no file?) - actually if mode changes and we have a new input, yes.
    
    // Simplification: Check if any field differs from initial
    const isAvatarChanged = 
        (avatarMode === 'upload' && !!avatarFile) ||
        (avatarMode === 'url' && avatarUrl !== (profile.avatar_url || ''));

    // Special case: if initial was URL and we switch to upload without file -> not dirty relative to image content till file selected,
    // BUT if we want to enforce re-uploading, maybe not.
    // Let's stick to simple field comparison.
    
    const hasChanges = 
        fullName !== (profile.full_name || '') ||
        instagram !== (profile.instagram || '') ||
        facebook !== (profile.facebook || '') ||
        tiktok !== (profile.tiktok || '') ||
        youtube !== (profile.youtube || '') ||
        isAvatarChanged;

    setIsDirty(hasChanges);
  }, [fullName, instagram, facebook, tiktok, youtube, avatarMode, avatarUrl, avatarFile, profile]);


  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      const objectUrl = URL.createObjectURL(file);
      setAvatarPreview(objectUrl);
    }
  };

  const handleAvatarUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAvatarUrl(e.target.value);
    setAvatarPreview(e.target.value);
  };

  const handleSubmit = async (formData: FormData) => {
    // Prevent default form action behavior if we want custom handling, 
    // but here we are using `action={handleSubmit}` which in Next.js with Server Actions behaves like a form handler.
    // However, since we need to prevent submission if not dirty (though disabled button handles UI),
    // and we want to control the formData being sent (specifically appending state values if not in inputs).
    // Note: Inputs with `name` attribute are automatically in formData.
    // Since we use controlled inputs, we just need to ensure they have `name` and `value`.
    
    setIsSubmitting(true);
    // Append the active mode so server knows whether to look for file or url
    formData.append('avatarMode', avatarMode);
    
    // If we have a file in state but inputs might not handle it perfectly in all browsers if controlled? 
    // File inputs are uncontrolled by definition in React. `defaultValue` or no value.
    // We rely on the input ref/name for the file. 
    
    try {
        await updateProfile(formData);
        // On success, we should probably reset dirty state or re-init with new profile.
        // But since this is a server action that revalidates path, the page component will re-render
        // with new `profile` prop, causing this component to re-mount or update.
        // We might want to wait for that.
        setIsDirty(false); // Optimistic until re-render
    } catch (e) {
        console.error(e);
        // Error handling if needed, or rely on server action global error boundary
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <form action={handleSubmit} className={styles.form}>
      <div className={styles.group}>
        <label htmlFor="fullName">Nombre Completo</label>
        <input 
          id="fullName" 
          name="fullName" 
          type="text" 
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Tu nombre"
        />
      </div>

      <div className={styles.group}>
        <label>Avatar</label>
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem' }}>
          <button 
            type="button" 
            onClick={() => setAvatarMode('upload')}
            style={{ 
                padding: '0.5rem 1rem', 
                borderRadius: '4px', 
                border: 'none', 
                backgroundColor: avatarMode === 'upload' ? 'var(--primary)' : 'rgba(255,255,255,0.1)',
                color: 'white',
                cursor: 'pointer'
            }}
          >
            Subir Foto
          </button>
          <button 
            type="button" 
            onClick={() => setAvatarMode('url')}
             style={{ 
                padding: '0.5rem 1rem', 
                borderRadius: '4px', 
                border: 'none', 
                backgroundColor: avatarMode === 'url' ? 'var(--primary)' : 'rgba(255,255,255,0.1)',
                color: 'white',
                cursor: 'pointer'
            }}
          >
            URL Externa
          </button>
        </div>

        {avatarMode === 'upload' ? (
           <div style={{ border: '2px dashed rgba(255,255,255,0.2)', padding: '1rem', borderRadius: '8px', textAlign: 'center' }}>
             <input 
               type="file" 
               name="avatarFile"
               accept="image/*" 
               onChange={handleAvatarFileChange}
               style={{ width: '100%', marginBottom: '1rem' }}
             />
           </div>
        ) : (
           <input 
             id="avatarUrl" 
             name="avatarUrl" 
             type="url" 
             value={avatarUrl}
             onChange={handleAvatarUrlChange}
             placeholder="https://example.com/avatar.jpg"
           />
        )}
        
        {avatarPreview && (
            <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                <img 
                    src={avatarPreview} 
                    alt="Avatar Preview" 
                    style={{ width: '100px', height: '100px', borderRadius: '50%', objectFit: 'cover', border: '2px solid white' }} 
                />
            </div>
        )}
      </div>

      <h3 className={styles.subHeader} style={{ marginTop: '2rem', marginBottom: '1rem', color: 'var(--text-main)' }}>Redes Sociales</h3>
      
      <div className={styles.group}>
        <label htmlFor="instagram">Instagram</label>
        <input 
          id="instagram" 
          name="instagram" 
          type="url" 
          value={instagram}
          onChange={(e) => setInstagram(e.target.value)}
          placeholder="https://instagram.com/tu_usuario"
        />
      </div>
      
      <div className={styles.group}>
        <label htmlFor="facebook">Facebook</label>
        <input 
          id="facebook" 
          name="facebook" 
          type="url" 
          value={facebook}
          onChange={(e) => setFacebook(e.target.value)}
          placeholder="https://facebook.com/tu_usuario"
        />
      </div>

      <div className={styles.group}>
        <label htmlFor="tiktok">TikTok</label>
        <input 
          id="tiktok" 
          name="tiktok" 
          type="url" 
          value={tiktok}
          onChange={(e) => setTikTok(e.target.value)}
          placeholder="https://tiktok.com/@tu_usuario"
        />
      </div>

      <div className={styles.group}>
        <label htmlFor="youtube">YouTube</label>
        <input 
          id="youtube" 
          name="youtube" 
          type="url" 
          value={youtube}
          onChange={(e) => setYoutube(e.target.value)}
          placeholder="https://youtube.com/@tu_canal"
        />
      </div>

      <button 
        type="submit" 
        disabled={!isDirty || isSubmitting} 
        className={styles.buttonPrimary}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '150px' }}
      >
        {isSubmitting ? (
          <>
            <span className={styles.spinner}></span>
            Guardando...
          </>
        ) : 'Guardar Cambios'}
      </button>
    </form>
  );
}
