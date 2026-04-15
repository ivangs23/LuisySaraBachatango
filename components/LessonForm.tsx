'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { createLesson, updateLesson } from '@/app/courses/actions';
import { Upload } from 'tus-js-client';
import styles from './AddLessonForm.module.css';
import { Plus, Trash2, FileAudio, Captions } from 'lucide-react';

// Shared types (should ideally be imported from a centralized types file)
export interface VideoTrack {
  language: string
  label: string
  url: string
}

export interface SubtitleTrack {
  language: string
  label: string
  url: string
}

export interface MediaConfig {
  tracks: VideoTrack[]
  subtitles: SubtitleTrack[]
}

type LessonData = {
  id?: string;
  title: string;
  description: string;
  video_url: string;
  video_source: 'url' | 'upload';
  thumbnail_url?: string;
  duration?: number | null;
  is_free?: boolean;
  order: number;
  media_config?: MediaConfig; // New field
};

type LessonFormProps = {
  courseId: string;
  initialData?: LessonData;
};

// Language options
const LANGUAGES = [
  { code: 'es', label: 'Español' },
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'it', label: 'Italiano' },
  { code: 'ja', label: '日本語' }
];

export default function LessonForm({ courseId, initialData }: LessonFormProps) {
  const supabase = createClient();
  
  const [activeTab, setActiveTab] = useState<'url' | 'upload'>(initialData?.video_source || 'url');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [currentUploadLabel, setCurrentUploadLabel] = useState<string>('');
  
  // Controlled Inputs
  const [title, setTitle] = useState(initialData?.title || '');
  const [description, setDescription] = useState(initialData?.description || '');
  
  // Order with validation
  const [order, setOrder] = useState<number | string>(initialData?.order ?? 1);
  const [orderError, setOrderError] = useState<string | null>(null);

  const [videoUrl, setVideoUrl] = useState(initialData?.video_url || '');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [duration, setDuration] = useState<number | string>(initialData?.duration || '');
  const [isFree, setIsFree] = useState(initialData?.is_free || false);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(initialData?.thumbnail_url || null);

  // Multi-language State
  // We manage the "staging" state where files might not be uploaded yet
  type StagedVideoTrack = {
    id: string; // temp id
    language: string;
    label: string;
    url: string;
    file: File | null;
  };

  type StagedSubtitleTrack = {
    id: string;
    language: string;
    label: string;
    url: string;
    file: File | null;
  };

  // Convert initial media_config to staged format
  const [tracks, setTracks] = useState<StagedVideoTrack[]>(() => 
    initialData?.media_config?.tracks?.map(t => ({ ...t, id: crypto.randomUUID(), file: null })) || []
  );
  
  const [subtitles, setSubtitles] = useState<StagedSubtitleTrack[]>(() => 
    initialData?.media_config?.subtitles?.map(t => ({ ...t, id: crypto.randomUUID(), file: null })) || []
  );

  const [isDirty, setIsDirty] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);

  // Dirty Check Logic — only mark dirty after initial mount when values actually change
  useEffect(() => {
    if (!hasMounted) {
      setHasMounted(true);
      return;
    }
    setIsDirty(true);
  }, [
    title, description, order, videoUrl, videoFile, activeTab,
    duration, isFree, thumbnailFile, tracks, subtitles
  ]); // eslint-disable-line react-hooks/exhaustive-deps


  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setThumbnailFile(file);
      const objectUrl = URL.createObjectURL(file);
      setThumbnailPreview(objectUrl);
    }
  };

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setVideoFile(file);
    }
  };

  const handleOrderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setOrder(val);
    
    if (val === '' || isNaN(parseInt(val))) {
      setOrderError('El orden debe ser un número válido');
    } else {
      setOrderError(null);
    }
  };

  // --- Track Management ---
  const addTrack = () => {
    setTracks([...tracks, { 
      id: crypto.randomUUID(), 
      language: 'en', 
      label: 'English', 
      url: '', 
      file: null 
    }]);
  };

  const removeTrack = (id: string) => {
    setTracks(tracks.filter(t => t.id !== id));
  };

  const updateTrack = (id: string, field: keyof StagedVideoTrack, value: string | File | null) => {
    setTracks(tracks.map(t => {
      if (t.id === id) {
        if (field === 'language') {
           // Auto-update label if using default format
           const langLabel = LANGUAGES.find(l => l.code === value)?.label || value;
           return { ...t, language: value, label: langLabel };
        }
        return { ...t, [field]: value };
      }
      return t;
    }));
  };

  // --- Subtitle Management ---
  const addSubtitle = () => {
    setSubtitles([...subtitles, { 
      id: crypto.randomUUID(), 
      language: 'es', 
      label: 'Español', 
      url: '', 
      file: null 
    }]);
  };

  const removeSubtitle = (id: string) => {
    setSubtitles(subtitles.filter(t => t.id !== id));
  };

  const updateSubtitle = (id: string, field: keyof StagedSubtitleTrack, value: string | File | null) => {
    setSubtitles(subtitles.map(t => {
      if (t.id === id) {
        if (field === 'language') {
           const langLabel = LANGUAGES.find(l => l.code === value)?.label || value;
           return { ...t, language: value, label: langLabel };
        }
        return { ...t, [field]: value };
      }
      return t;
    }));
  };


  const uploadVideoWithTus = async (file: File): Promise<string> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('No active session found');

    return new Promise((resolve, reject) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `${courseId}/${fileName}`;
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

      if (!supabaseUrl) {
         reject(new Error('Missing Supabase URL'));
         return;
      }
      
      const uploadEndpoint = `${supabaseUrl}/storage/v1/upload/resumable`;

      const upload = new Upload(file, {
        endpoint: uploadEndpoint,
        retryDelays: [0, 3000, 5000, 10000, 20000],
        headers: {
          authorization: `Bearer ${session.access_token}`,
          'x-upsert': 'true',
        },
        metadata: {
          bucketName: 'course-content',
          objectName: filePath,
          contentType: file.type,
          cacheControl: '3600',
        },
        onError: function (error) {
          console.error('TUS upload failed:', error);
          reject(error);
        },
        onProgress: function (bytesUploaded, bytesTotal) {
          const percentage = ((bytesUploaded / bytesTotal) * 100).toFixed(2);
          setUploadProgress(parseFloat(percentage));
        },
        onSuccess: function () {
          resolve(`storage://${filePath}`);
        },
      });

      upload.findPreviousUploads().then((previousUploads) => {
        if (previousUploads.length) {
          upload.resumeFromPreviousUpload(previousUploads[0]);
        }
        upload.start();
      });
    });
  };

  const uploadFileStandard = async (file: File, bucket: string): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const filePath = `${courseId}/${fileName}`;
    
    const { error: uploadError } = await supabase.storage.from(bucket).upload(filePath, file);
    if (uploadError) throw uploadError;
    
    // For VTT in 'course-content' or a new 'subtitles' bucket? 
    // Usually 'course-content' is fine but 'thumbnails' is public.
    // Subtitles should be public/signed. Let's assume 'course-content' and use Signed URL generator in display or Public bucket.
    // Ideally create a public 'subtitles' bucket. For now sticking with 'course-content' implies we need signed URLs.
    // BUT `LessonVideoPlayer` expects a URL. If it's `storage://` logic handles it.
    
    return `storage://${filePath}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); 
    if (orderError) return;

    setIsUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('courseId', courseId);
    formData.append('title', title);
    formData.append('description', description);
    formData.append('order', order.toString());
    formData.append('duration', duration.toString());
    if (isFree) formData.append('isFree', 'on');
    formData.append('videoSource', activeTab);

    try {
      // 1. Upload Thumbnail
      let finalThumbnailUrl = initialData?.thumbnail_url || '';
      if (thumbnailFile) {
        setCurrentUploadLabel('Subiendo Thumbnail...');
        // Using 'thumbnails' public bucket logic from original code
        const fileExt = thumbnailFile.name.split('.').pop();
        const fileName = `${crypto.randomUUID()}.${fileExt}`;
        const filePath = `${courseId}/${fileName}`;
        const { error: uploadError } = await supabase.storage.from('thumbnails').upload(filePath, thumbnailFile);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('thumbnails').getPublicUrl(filePath);
        finalThumbnailUrl = publicUrl;
      }
      if (finalThumbnailUrl) formData.append('thumbnailUrl', finalThumbnailUrl);

      // 2. Process Main Video
      let finalVideoUrl = initialData?.video_url || '';
      if (activeTab === 'upload' && videoFile) {
         setCurrentUploadLabel('Subiendo Video Principal...');
         finalVideoUrl = await uploadVideoWithTus(videoFile);
      } else if (activeTab === 'url') {
         finalVideoUrl = videoUrl;
      }
      formData.append('videoUrl', finalVideoUrl);

      // 3. Process Multi-language Tracks
      const finalTracks: VideoTrack[] = [];
      for (const t of tracks) {
        let tUrl = t.url;
        if (t.file) {
          setCurrentUploadLabel(`Subiendo Audio (${t.label})...`);
          tUrl = await uploadVideoWithTus(t.file);
        }
        if (tUrl) {
           finalTracks.push({ language: t.language, label: t.label, url: tUrl });
        }
      }

      // 4. Process Subtitles
      const finalSubtitles: SubtitleTrack[] = [];
      for (const s of subtitles) {
        let sUrl = s.url;
        if (s.file) {
          setCurrentUploadLabel(`Subiendo Subtítulos (${s.label})...`);
          // Use TUS or Standard? Subtitles are small. Standard upload to course-content
          sUrl = await uploadFileStandard(s.file, 'course-content');
        }
        if (sUrl) {
          finalSubtitles.push({ language: s.language, label: s.label, url: sUrl });
        }
      }

      const mediaConfig: MediaConfig = {
        tracks: finalTracks,
        subtitles: finalSubtitles
      };
      formData.append('mediaConfig', JSON.stringify(mediaConfig));

      // 5. Server Action
      setCurrentUploadLabel('Guardando cambios...');
      if (initialData?.id) {
        formData.append('lessonId', initialData.id);
        const result = await updateLesson(formData);
        if (result?.error) throw new Error(result.error);
      } else {
        const result = await createLesson(formData);
        if (result?.error) throw new Error(result.error);
      }

    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Something went wrong';
      if (message === 'NEXT_REDIRECT' || message.includes('NEXT_REDIRECT')) return;
      console.error('Submit error:', error);
      alert(`Error: ${message}`);
    } finally {
      setIsUploading(false);
      setCurrentUploadLabel('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <div className={styles.group}>
        <label htmlFor="title">Título de la Lección</label>
        <input 
          type="text" 
          id="title" 
          required 
          className={styles.input} 
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <div className={styles.group}>
        <label htmlFor="description">Descripción</label>
        <textarea 
          id="description" 
          rows={4} 
          className={styles.textarea} 
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className={styles.group}>
        <label>Thumbnail</label>
        <div className={styles.dropzone}>
          <input type="file" accept="image/*" onChange={handleThumbnailChange} />
          {thumbnailPreview ? (
            <img src={thumbnailPreview} alt="Preview" className={styles.preview} />
          ) : (
            <p>Arrastra una imagen o haz clic para seleccionar</p>
          )}
        </div>
      </div>

      <div className={styles.tabs}>
        <button 
          type="button" 
          className={`${styles.tab} ${activeTab === 'url' ? styles.active : ''}`}
          onClick={() => setActiveTab('url')}
        >
          URL Externa
        </button>
        <button 
          type="button" 
          className={`${styles.tab} ${activeTab === 'upload' ? styles.active : ''}`}
          onClick={() => setActiveTab('upload')}
        >
          Subir Video Principal
        </button>
      </div>

      {activeTab === 'url' ? (
        <div className={styles.group}>
          <label htmlFor="videoUrl">URL del Video (Embed)</label>
          <input 
            type="url" 
            id="videoUrl" 
            placeholder="https://www.youtube.com/embed/..."
            className={styles.input}
            required={activeTab === 'url'}
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
          />
        </div>
      ) : (
        <div className={styles.group}>
          <label htmlFor="videoFile">Archivo de Video Principal</label>
          
          {initialData?.video_source === 'upload' && initialData.video_url && !videoFile && (
             <div style={{ 
               marginBottom: '0.75rem', 
               padding: '0.75rem', 
               backgroundColor: 'rgba(76, 175, 80, 0.1)', 
               border: '1px solid rgba(76, 175, 80, 0.3)', 
               borderRadius: '4px',
               display: 'flex',
               alignItems: 'center',
               gap: '0.5rem',
               color: '#fff'
             }}>
               <div style={{ color: '#4CAF50' }}>✓</div>
               <div style={{ fontSize: '0.9rem', flex: 1 }}>
                 <strong>Video Actual Seleccionado:</strong>
                 <div style={{ fontSize: '0.8rem', opacity: 0.8, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                   {initialData.video_url.split('/').pop()}
                 </div>
               </div>
             </div>
          )}

          <input 
            type="file" 
            id="videoFile" 
            accept="video/*" 
            onChange={handleVideoChange}
            className={styles.input}
            required={activeTab === 'upload' && !initialData?.id} 
          />
        </div>
      )}

      {/* --- Multi-language & Subtitles Sections --- */}
      <div style={{ marginTop: '2rem', borderTop: '1px solid #333', paddingTop: '1.5rem' }}>
        <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileAudio size={18} /> Pistas de Audio Adicionales
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
           {tracks.map((track) => (
             <div key={track.id} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr 40px', gap: '0.5rem', alignItems: 'center', background: '#333', padding: '0.5rem', borderRadius: '4px' }}>
               <select 
                 className={styles.input} 
                 value={track.language}
                 onChange={(e) => updateTrack(track.id, 'language', e.target.value)}
                 style={{ marginBottom: 0 }}
               >
                 {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
               </select>
               <input 
                 type="text" 
                 placeholder="Ej. Español Latino"
                 className={styles.input}
                 value={track.label}
                 onChange={(e) => updateTrack(track.id, 'label', e.target.value)}
                 style={{ marginBottom: 0 }}
               />
               <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <input 
                    type="file" 
                    accept="video/*"
                    onChange={(e) => updateTrack(track.id, 'file', e.target.files?.[0])}
                    style={{ fontSize: '0.8rem', color: '#ccc' }}
                  />
                  {!track.file && track.url && (
                    <div style={{ fontSize: '0.7rem', color: '#4CAF50', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span>✓</span> Archivo actual: {track.url.split('/').pop()}
                    </div>
                  )}
               </div>
               <button type="button" onClick={() => removeTrack(track.id)} style={{ background: 'none', border: 'none', color: '#ff6b6b', cursor: 'pointer' }}>
                 <Trash2 size={18} />
               </button>
             </div>
           ))}
           <button 
             type="button" 
             onClick={addTrack}
             style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', alignSelf: 'start' }}
           >
             <Plus size={16} /> Añadir Pista de Audio
           </button>
        </div>
      </div>

      <div style={{ marginTop: '2rem', borderTop: '1px solid #333', paddingTop: '1.5rem', marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
           <Captions size={18} /> Subtítulos
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
           {subtitles.map((sub) => (
             <div key={sub.id} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr 40px', gap: '0.5rem', alignItems: 'center', background: '#333', padding: '0.5rem', borderRadius: '4px' }}>
               <select 
                 className={styles.input} 
                 value={sub.language}
                 onChange={(e) => updateSubtitle(sub.id, 'language', e.target.value)}
                 style={{ marginBottom: 0 }}
               >
                 {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
               </select>
               <input 
                 type="text" 
                 placeholder="Etiqueta"
                 className={styles.input}
                 value={sub.label}
                 onChange={(e) => updateSubtitle(sub.id, 'label', e.target.value)}
                 style={{ marginBottom: 0 }}
               />
               <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <input 
                    type="file" 
                    accept=".vtt"
                    onChange={(e) => updateSubtitle(sub.id, 'file', e.target.files?.[0])}
                    style={{ fontSize: '0.8rem', color: '#ccc' }}
                  />
                   {!sub.file && sub.url && (
                    <div style={{ fontSize: '0.7rem', color: '#4CAF50', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span>✓</span> Archivo actual: {sub.url.split('/').pop()}
                    </div>
                  )}
               </div>
               <button type="button" onClick={() => removeSubtitle(sub.id)} style={{ background: 'none', border: 'none', color: '#ff6b6b', cursor: 'pointer' }}>
                 <Trash2 size={18} />
               </button>
             </div>
           ))}
           <button 
             type="button" 
             onClick={addSubtitle}
             style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', alignSelf: 'start' }}
           >
             <Plus size={16} /> Añadir Subtítulo (.vtt)
           </button>
        </div>
      </div>


      <div className={styles.row}>
        <div className={styles.group}>
          <label htmlFor="duration">Duración (segundos)</label>
          <input 
            type="number" 
            id="duration" 
            className={styles.input} 
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
          />
        </div>
        <div className={`${styles.group} ${styles.checkbox}`}>
          <label>
            <input 
              type="checkbox" 
              name="isFree" 
              checked={isFree}
              onChange={(e) => setIsFree(e.target.checked)}
            />
            Vista Previa Gratuita
          </label>
        </div>
      </div>

      <div className={styles.group}>
        <label htmlFor="order">Orden</label>
        {orderError && (
            <span style={{ color: '#ff6b6b', fontSize: '0.85rem', marginBottom: '0.25rem', display: 'block' }}>
                {orderError}
            </span>
        )}
        <input 
          type="number" 
          id="order" 
          required 
          className={styles.input} 
          value={order}
          onChange={handleOrderChange}
          style={orderError ? { borderColor: '#ff6b6b' } : {}}
        />
      </div>

      <button 
        type="submit" 
        className={styles.submitButton} 
        disabled={isUploading || (!!initialData && !isDirty) || !!orderError}
        style={{ opacity: (initialData && !isDirty) || !!orderError ? 0.5 : 1 }}
      >
        {isUploading ? (
          <>
            <span className={styles.spinner}></span>
            {currentUploadLabel || 'Procesando...'}
            {uploadProgress > 0 && ` (${uploadProgress}%)`}
          </>
        ) : (initialData ? 'Actualizar Lección' : 'Crear Lección')}
      </button>
    </form>
  );
}
