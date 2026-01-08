'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { createLesson, updateLesson } from '@/app/courses/actions';
import { Upload } from 'tus-js-client';
import styles from './AddLessonForm.module.css';

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
};

type LessonFormProps = {
  courseId: string;
  initialData?: LessonData;
};

export default function LessonForm({ courseId, initialData }: LessonFormProps) {
  const supabase = createClient();
  
  const [activeTab, setActiveTab] = useState<'url' | 'upload'>(initialData?.video_source || 'url');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  
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

  const [isDirty, setIsDirty] = useState(false);

  // Dirty Check Logic
  useEffect(() => {
    if (!initialData) {
        setIsDirty(true); 
        return;
    }

    const hasChanges = 
        title !== initialData.title ||
        description !== initialData.description ||
        order != initialData.order || // Loose comparison because order state might be string
        (activeTab === 'url' && videoUrl !== initialData.video_url) || 
        (activeTab === 'upload' && !!videoFile) || 
        activeTab !== initialData.video_source || 
        duration != (initialData.duration || '') || 
        isFree !== initialData.is_free ||
        !!thumbnailFile; 

    setIsDirty(hasChanges);
  }, [
    title, description, order, videoUrl, videoFile, activeTab, 
    duration, isFree, thumbnailFile, initialData
  ]);


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

  const uploadVideoWithTus = async (file: File): Promise<string> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('No active session found');

    return new Promise((resolve, reject) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); 
    if (initialData && !isDirty) return;
    if (orderError) return; // Prevent submit if error

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
        const fileExt = thumbnailFile.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${courseId}/${fileName}`;
        const { error: uploadError } = await supabase.storage.from('thumbnails').upload(filePath, thumbnailFile);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('thumbnails').getPublicUrl(filePath);
        finalThumbnailUrl = publicUrl;
      }
      if (finalThumbnailUrl) formData.append('thumbnailUrl', finalThumbnailUrl);

      // 2. Process Video
      let finalVideoUrl = initialData?.video_url || '';
      if (activeTab === 'upload' && videoFile) {
         finalVideoUrl = await uploadVideoWithTus(videoFile);
      } else if (activeTab === 'url') {
         finalVideoUrl = videoUrl;
      }
      formData.append('videoUrl', finalVideoUrl);

      // 3. Server Action
      if (initialData?.id) {
        formData.append('lessonId', initialData.id);
        const result = await updateLesson(formData);
        if (result?.error) throw new Error(result.error);
      } else {
        const result = await createLesson(formData);
        if (result?.error) throw new Error(result.error);
      }

    } catch (error: any) {
      if (error.message === 'NEXT_REDIRECT' || error.message.includes('NEXT_REDIRECT')) return;
      console.error('Submit error:', error);
      alert(`Error: ${error.message || 'Something went wrong'}`);
    } finally {
      setIsUploading(false);
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
          Subir Video
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
          <label htmlFor="videoFile">Archivo de Video</label>
          {initialData?.video_source === 'upload' && !videoFile && (
             <p style={{fontSize: '0.9rem', color: '#888', marginBottom: '0.5rem'}}>
               Video actual: {initialData.video_url} (Selecciona uno nuevo para reemplazarlo)
             </p>
          )}
          <input 
            type="file" 
            id="videoFile" 
            accept="video/*" 
            onChange={handleVideoChange}
            className={styles.input}
            required={activeTab === 'upload' && !initialData?.id} 
          />
          {isUploading && activeTab === 'upload' && (
             <div style={{marginTop: '1rem'}}>
                <div style={{height: '10px', width: '100%',  backgroundColor: '#333', borderRadius: '5px', overflow: 'hidden'}}>
                  <div style={{height: '100%', width: `${uploadProgress}%`, backgroundColor: 'var(--primary)', transition: 'width 0.2s'}}></div>
                </div>
                <p style={{textAlign: 'center', marginTop: '0.5rem'}}>{uploadProgress}% Subido</p>
             </div>
          )}
        </div>
      )}

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
            Procesando...
          </>
        ) : (initialData ? 'Actualizar Lección' : 'Crear Lección')}
      </button>
    </form>
  );
}
