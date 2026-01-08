'use client';

import { useState, useEffect } from 'react';
import { createCourse, updateCourse } from '@/app/courses/actions';
import Link from 'next/link';
import styles from './CourseForm.module.css';
import Image from 'next/image';

type CourseData = {
  id?: string;
  title: string;
  description: string;
  year: number;
  month: number;
  image_url?: string;
  is_published: boolean;
};

type CourseFormProps = {
  initialData?: CourseData;
};

export default function CourseForm({ initialData }: CourseFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(initialData?.image_url || null);
  
  // Controlled State
  const [title, setTitle] = useState(initialData?.title || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [year, setYear] = useState(initialData?.year || new Date().getFullYear());
  const [month, setMonth] = useState(initialData?.month || new Date().getMonth() + 1);
  const [isPublished, setIsPublished] = useState(initialData?.is_published ?? true);
  const [imageFile, setImageFile] = useState<File | null>(null);

  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (!initialData) {
        setIsDirty(true); // Always dirty for creates unless we want to block empty Creates
        return;
    }

    const hasChanges = 
        title !== initialData.title ||
        description !== initialData.description ||
        year !== initialData.year ||
        month !== initialData.month ||
        isPublished !== initialData.is_published ||
        imageFile !== null;

    setIsDirty(hasChanges);
  }, [title, description, year, month, isPublished, imageFile, initialData]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const objectUrl = URL.createObjectURL(file);
      setImagePreview(objectUrl);
    }
  };

  const onSubmitWrapper = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (initialData && !isDirty) return;

    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    
    // Explicitly set values if needed, but FormData from form elements works if name attributes match
    // However, for updateCourse we need courseId and imageUrl fallback
    if (initialData) {
        formData.append('courseId', initialData.id!);
        if (initialData.image_url) {
            formData.append('imageUrl', initialData.image_url);
        }
    }
    
    // For controlled checkboxes, we must handle value manually if not in DOM correctly or just rely on default
    // But since we use defaultChecked/checked prop, it's safer to rely on state or ensure input is updated
    
    try {
      const result = initialData 
        ? await updateCourse(formData)
        : await createCourse(formData);

      if (result?.error) {
         alert(`Error: ${result.error}`);
         setIsSubmitting(false);
         return;
      }
    } catch (e: any) {
      if (e.message === 'NEXT_REDIRECT' || e.message?.includes?.('NEXT_REDIRECT') || e.code === 'NEXT_REDIRECT') {
        return; // success
      }
      console.error(e);
      alert(`Error processing course: ${e.message}`);
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmitWrapper} className={styles.form}>
      <div className={styles.group}>
        <label htmlFor="title">Título del Curso</label>
        <input 
            type="text" 
            id="title" 
            name="title" 
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
            name="description" 
            rows={4} 
            className={styles.textarea}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className={styles.row}>
        <div className={styles.group}>
          <label htmlFor="year">Año</label>
          <input 
            type="number" 
            id="year" 
            name="year" 
            required 
            className={styles.input}
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}
          />
        </div>
        <div className={styles.group}>
          <label htmlFor="month">Mes (1-12)</label>
          <select 
            id="month" 
            name="month" 
            className={styles.select}
            value={month}
            onChange={(e) => setMonth(parseInt(e.target.value))}
          >
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>{new Date(0, i).toLocaleString('es-ES', { month: 'long' })}</option>
            ))}
          </select>
        </div>
      </div>

      <div className={styles.group}>
        <label>Imagen de Portada</label>
        <div className={styles.fileInputWrapper}>
          <input type="file" name="image" accept="image/*" onChange={handleImageChange} required={!initialData?.image_url} />
          {imagePreview && (
            <div style={{marginTop: '1rem'}}>
                <img 
                    src={imagePreview} 
                    alt="Preview" 
                    className={styles.preview} 
                />
            </div>
          )}
        </div>
      </div>

      <div className={styles.checkboxGroup}>
        <input 
            type="checkbox" 
            id="isPublished" 
            name="isPublished" 
            checked={isPublished}
            onChange={(e) => setIsPublished(e.target.checked)}
        />
        <label htmlFor="isPublished">Publicar inmediatamente</label>
      </div>

      <div className={styles.actions}>
        <Link href={initialData ? `/courses/${initialData.id}` : "/courses"} className={styles.cancelLink}>
            Cancelar
        </Link>
        <button 
            type="submit" 
            disabled={isSubmitting || (!!initialData && !isDirty)} 
            className={styles.submitButton}
            style={{ opacity: (initialData && !isDirty) ? 0.5 : 1 }}
        >
          {isSubmitting ? (
            <>
              <span className={styles.spinner}></span>
              {initialData ? 'Guardando...' : 'Creando...'}
            </>
          ) : (initialData ? 'Guardar Cambios' : 'Crear Curso')}
        </button>
      </div>
    </form>
  );
}
