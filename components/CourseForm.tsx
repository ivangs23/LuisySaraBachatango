'use client';

import { useState, useMemo } from 'react';
import { createCourse, updateCourse } from '@/app/courses/actions';
import Link from 'next/link';
import styles from './CourseForm.module.css';

const CATEGORIES = [
  { value: 'bachatango', label: 'BachaTango' },
  { value: 'bachata',    label: 'Bachata' },
  { value: 'tango',      label: 'Tango' },
  { value: 'chachacha',  label: 'Chachachá' },
  { value: 'otro',       label: 'Otro' },
];

type CourseData = {
  id?: string;
  title: string;
  description: string;
  year: number | null;
  month: number | null;
  image_url?: string;
  is_published: boolean;
  course_type: 'membership' | 'complete';
  category?: string | null;
  price_eur?: number | null;
  stripe_price_id?: string | null;
};

type CourseFormProps = {
  initialData?: CourseData;
};

export default function CourseForm({ initialData }: CourseFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(initialData?.image_url || null);

  const [courseType, setCourseType] = useState<'membership' | 'complete'>(initialData?.course_type || 'membership');
  const [title, setTitle] = useState(initialData?.title || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [year, setYear] = useState<number | ''>(initialData?.year ?? new Date().getFullYear());
  const [month, setMonth] = useState<number | ''>(initialData?.month ?? new Date().getMonth() + 1);
  const [category, setCategory] = useState(initialData?.category || 'bachatango');
  const [priceEur, setPriceEur] = useState<number | ''>(initialData?.price_eur ?? '');
  const [isPublished, setIsPublished] = useState(initialData?.is_published ?? true);
  const [imageFile, setImageFile] = useState<File | null>(null);

  const isDirty = useMemo(() => {
    if (!initialData) return true;
    return (
      courseType !== initialData.course_type ||
      title !== initialData.title ||
      description !== initialData.description ||
      year !== (initialData.year ?? '') ||
      month !== (initialData.month ?? '') ||
      category !== (initialData.category ?? '') ||
      priceEur !== (initialData.price_eur ?? '') ||
      isPublished !== initialData.is_published ||
      imageFile !== null
    );
  }, [courseType, title, description, year, month, category, priceEur, isPublished, imageFile, initialData]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const onSubmitWrapper = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (initialData && !isDirty) return;
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);
    formData.set('courseType', courseType);
    formData.set('category', courseType === 'complete' ? category : '');
    formData.set('priceEur', priceEur !== '' ? String(priceEur) : '');
    // Membership-only fields
    if (courseType === 'membership') {
      formData.set('year', year !== '' ? String(year) : '');
      formData.set('month', month !== '' ? String(month) : '');
    } else {
      formData.delete('year');
      formData.delete('month');
    }

    if (initialData) {
      formData.append('courseId', initialData.id!);
      if (initialData.image_url) formData.append('imageUrl', initialData.image_url);
    }

    try {
      const result = initialData ? await updateCourse(formData) : await createCourse(formData);
      if (result?.error) {
        alert(`Error: ${result.error}`);
        setIsSubmitting(false);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '';
      if (msg === 'NEXT_REDIRECT' || msg.includes('NEXT_REDIRECT')) return;
      console.error(e);
      alert(`Error: ${msg}`);
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmitWrapper} className={styles.form}>

      {/* Course type toggle */}
      <div className={styles.group}>
        <label>Tipo de Curso</label>
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem' }}>
          {(['membership', 'complete'] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setCourseType(type)}
              style={{
                flex: 1,
                padding: '0.65rem',
                borderRadius: 'var(--radius-sm)',
                border: `2px solid ${courseType === type ? 'var(--primary)' : 'var(--border)'}`,
                background: courseType === type ? 'rgba(var(--primary-rgb, 180,140,60), 0.12)' : 'var(--bg-main)',
                color: courseType === type ? 'var(--primary)' : 'var(--text-muted)',
                fontWeight: courseType === type ? 700 : 400,
                cursor: 'pointer',
                fontSize: '0.95rem',
              }}
            >
              {type === 'membership' ? '📅 Membresía mensual' : '🎬 Curso completo'}
            </button>
          ))}
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
          {courseType === 'membership'
            ? '4 clases por mes. El acceso se habilita por mes pagado.'
            : 'Precio fijo único. Acceso permanente por categoría (bachata, tango…)'}
        </p>
      </div>

      <div className={styles.group}>
        <label htmlFor="title">Título del Curso</label>
        <input type="text" id="title" name="title" required className={styles.input}
          value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>

      <div className={styles.group}>
        <label htmlFor="description">Descripción</label>
        <textarea id="description" name="description" rows={4} className={styles.textarea}
          value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>

      {/* Membership-only: month and year */}
      {courseType === 'membership' && (
        <div className={styles.row}>
          <div className={styles.group}>
            <label htmlFor="year">Año</label>
            <input type="number" id="year" name="year" required className={styles.input}
              value={year} onChange={(e) => setYear(e.target.value ? parseInt(e.target.value) : '')} />
          </div>
          <div className={styles.group}>
            <label htmlFor="month">Mes</label>
            <select id="month" name="month" className={styles.select}
              value={month} onChange={(e) => setMonth(parseInt(e.target.value))}>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {new Date(0, i).toLocaleString('es-ES', { month: 'long' })}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Complete-only: category */}
      {courseType === 'complete' && (
        <div className={styles.group}>
          <label htmlFor="category">Categoría</label>
          <select id="category" name="category" className={styles.select}
            value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Price */}
      <div className={styles.group}>
        <label htmlFor="priceEur">Precio (€)</label>
        <input type="number" id="priceEur" name="priceEur" min="0" className={styles.input}
          placeholder="Ej: 19"
          value={priceEur} onChange={(e) => setPriceEur(e.target.value ? parseInt(e.target.value) : '')} />
      </div>

      <div className={styles.group}>
        <label>Imagen de Portada</label>
        <div className={styles.fileInputWrapper}>
          <input type="file" name="image" accept="image/*" onChange={handleImageChange}
            required={!initialData?.image_url} />
          {imagePreview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imagePreview} alt="Preview" className={styles.preview} />
          )}
        </div>
      </div>

      <div className={styles.checkboxGroup}>
        <input type="checkbox" id="isPublished" name="isPublished"
          checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} />
        <label htmlFor="isPublished">Publicar inmediatamente</label>
      </div>

      <div className={styles.actions}>
        <Link href={initialData ? `/courses/${initialData.id}` : '/courses'} className={styles.cancelLink}>
          Cancelar
        </Link>
        <button type="submit" disabled={isSubmitting || (!!initialData && !isDirty)}
          className={styles.submitButton} style={{ opacity: (initialData && !isDirty) ? 0.5 : 1 }}>
          {isSubmitting ? (
            <><span className={styles.spinner} />{initialData ? 'Guardando...' : 'Creando...'}</>
          ) : (initialData ? 'Guardar Cambios' : 'Crear Curso')}
        </button>
      </div>
    </form>
  );
}
