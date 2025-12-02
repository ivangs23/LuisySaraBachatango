import { submitPost } from '../actions'
import styles from '../community.module.css'

export default function CreatePostPage() {
  return (
    <div className={styles.container}>
      <h1 className={styles.title} style={{ marginBottom: '2rem' }}>Crear Nuevo Post</h1>
      
      <form action={submitPost}>
        <div className={styles.formGroup}>
          <label htmlFor="title" className={styles.label}>Título</label>
          <input 
            type="text" 
            id="title" 
            name="title" 
            className={styles.input} 
            required 
            placeholder="¿Cómo mejorar mi postura?"
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="content" className={styles.label}>Contenido</label>
          <textarea 
            id="content" 
            name="content" 
            className={styles.textarea} 
            required 
            placeholder="Escribe tu duda o comentario aquí..."
            rows={10}
          />
        </div>

        <button type="submit" className={styles.submitButton}>Publicar</button>
      </form>
    </div>
  )
}
