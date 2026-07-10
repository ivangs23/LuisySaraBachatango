import styles from '../page.module.css';

interface CourseCtaButtonProps {
  courseId: string;
  label: string;
  className?: string;
}

export default function CourseCtaButton({ courseId, label, className }: CourseCtaButtonProps) {
  return (
    <a href={`/curso-bachatango/comprar?courseId=${courseId}`} className={`${styles.cta} ${className ?? ''}`}>
      {label}
    </a>
  );
}
