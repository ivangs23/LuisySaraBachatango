'use client';

import { useState, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import { createLesson } from '@/app/courses/actions';
import styles from './AddLessonForm.module.css';

type AddLessonFormProps = {
  courseId: string;
};

export default function AddLessonForm({ courseId }: AddLessonFormProps) {
  const [activeTab, setActiveTab] = useState<'url' | 'upload'>('url');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);

  const supabase = createClient();

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

  const handleSubmit = async (formData: FormData) => {
    setIsUploading(true);
    setUploadProgress(0);

    try {
      // 1. Upload Thumbnail (if present)
      let thumbnailUrl = '';
      if (thumbnailFile) {
        const fileExt = thumbnailFile.name.split('.').pop();
        const fileName = `${crypto.randomUUID()}.${fileExt}`;
        const filePath = `${courseId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('thumbnails')
          .upload(filePath, thumbnailFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('thumbnails')
          .getPublicUrl(filePath);

        thumbnailUrl = publicUrl;
      }

      // 2. Upload Video (if 'upload' tab)
      let videoUrl = formData.get('videoUrl') as string;
      if (activeTab === 'upload' && videoFile) {
        const fileExt = videoFile.name.split('.').pop();
        const fileName = `${crypto.randomUUID()}.${fileExt}`;
        const filePath = `${courseId}/${fileName}`;

        // Note: Supabase JS client doesn't expose upload progress easily in v2 without TUS or custom xhr
        // For simplicity, we'll just await the upload. For large files, TUS is recommended.
        const { error: uploadError } = await supabase.storage
          .from('course-content')
          .upload(filePath, videoFile);

        if (uploadError) throw uploadError;

        // Get signed URL or public URL depending on bucket privacy
        // Course content is private, so we might store the path and generate signed URLs on read
        // OR store a signed URL with long expiration (not ideal)
        // For now, let's store the path and handle retrieval in the Lesson page
        // Actually, let's assume we store the full path or ID. 
        // Let's store the path prefixed with 'storage://' to distinguish from HTTP URLs
        videoUrl = `storage://${filePath}`;
      }

      // 3. Append extra data to FormData
      if (thumbnailUrl) {
        formData.append('thumbnailUrl', thumbnailUrl);
      }
      formData.append('videoSource', activeTab);
      if (activeTab === 'upload') {
        formData.set('videoUrl', videoUrl); // Override with storage path
      }
      
      // 4. Call Server Action
      await createLesson(formData);

    } catch (error) {
      console.error('Upload error:', error);
      alert('Error uploading lesson. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <form action={handleSubmit} className={styles.form}>
      <input type="hidden" name="courseId" value={courseId} />

      <div className={styles.group}>
        <label htmlFor="title">Título de la Lección</label>
        <input type="text" id="title" name="title" required className={styles.input} />
      </div>

      <div className={styles.group}>
        <label htmlFor="description">Descripción</label>
        <textarea id="description" name="description" rows={4} className={styles.textarea} />
      </div>

      <div className={styles.group}>
        <label>Thumbnail</label>
        <div className={styles.dropzone}>
          <input type="file" accept="image/*" onChange={handleThumbnailChange} />
          {thumbnailPreview ? (
            // eslint-disable-next-line @next/next/no-img-element -- blob URL from URL.createObjectURL(); incompatible with next/image loader
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
            name="videoUrl" 
            placeholder="https://www.youtube.com/embed/..."
            className={styles.input}
            required={activeTab === 'url'}
          />
        </div>
      ) : (
        <div className={styles.group}>
          <label htmlFor="videoFile">Archivo de Video</label>
          <input 
            type="file" 
            id="videoFile" 
            accept="video/*" 
            onChange={handleVideoChange}
            className={styles.input}
            required={activeTab === 'upload'}
          />
        </div>
      )}

      <div className={styles.row}>
        <div className={styles.group}>
          <label htmlFor="duration">Duración (segundos)</label>
          <input type="number" id="duration" name="duration" className={styles.input} />
        </div>
        <div className={`${styles.group} ${styles.checkbox}`}>
          <label>
            <input type="checkbox" name="isFree" />
            Vista Previa Gratuita
          </label>
        </div>
      </div>

      <div className={styles.group}>
        <label htmlFor="order">Orden</label>
        <input type="number" id="order" name="order" defaultValue={1} required className={styles.input} />
      </div>

      <button type="submit" className={styles.submitButton} disabled={isUploading}>
        {isUploading ? 'Subiendo...' : 'Guardar Lección'}
      </button>
    </form>
  );
}
