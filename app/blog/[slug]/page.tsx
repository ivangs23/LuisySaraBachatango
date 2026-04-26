import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import styles from './page.module.css';

type Article = {
  slug: string;
  title: string;
  category: string;
  excerpt: string;
  image: string;
  date: string;
  readTime: string;
  content: string[];
};

const ARTICLES: Record<string, Article> = {
  'que-es-bachatango': {
    slug: 'que-es-bachatango',
    title: '¿Qué es realmente el Bachatango?',
    category: 'Historia',
    excerpt: 'Descubre los orígenes de esta fusión controversial y bella. No es solo bachata con pausas, es una conversación entre dos géneros.',
    image: '/about-hero.png',
    date: '2024-01-15',
    readTime: '5 min',
    content: [
      'El Bachatango es mucho más que una tendencia pasajera. Es el resultado de una conversación profunda entre dos géneros que, aparentemente, no tienen nada en común: la bachata dominicana, cálida y sensual, y el tango argentino, elegante y melancólico.',
      'La fusión comenzó a desarrollarse a principios de los años 2000, cuando bailarines europeos —especialmente en España y Portugal— empezaron a experimentar con las estructuras musicales del tango aplicadas al abrazo y los movimientos de la bachata. El resultado fue sorprendente: una danza que conserva la conexión íntima de la bachata pero incorpora la precisión de pisadas, las pausas dramáticas y la expresividad emocional del tango.',
      '¿Qué lo diferencia de la bachata tradicional? Principalmente tres elementos: las pausas. En el bachatango, el silencio entre movimientos tiene tanto valor como el movimiento mismo. La pausa no es una interrupción, sino una intensificación de la conexión entre la pareja. El segundo elemento es la postura: el abrazo tiende a ser más cerrado y el torso más erguido, tomando prestado del tango su arquitectura corporal. El tercero es la intención musical: en lugar de seguir solo el ritmo, el bailarín de bachatango interpreta la melodía, los silencios y las frases musicales.',
      'Desde Luis y Sara, llevamos años perfeccionando esta fusión para crear un lenguaje propio que respeta sus raíces pero tiene identidad propia. No imitamos el tango, dialogamos con él desde la bachata.',
    ],
  },
  'errores-postura': {
    slug: 'errores-postura',
    title: '5 Errores Comunes en la Postura',
    category: 'Técnica',
    excerpt: 'La base de una buena conexión empieza en tu propio eje. Analizamos los fallos más habituales que te impiden fluir con tu pareja.',
    image: '/luis-sara-about.jpg',
    date: '2024-02-10',
    readTime: '7 min',
    content: [
      'La postura es el cimiento invisible del baile. Puedes conocer cientos de figuras, pero si tu postura falla, la conexión con tu pareja nunca será plena. Después de años enseñando, hemos identificado los cinco errores más comunes que bloquean el progreso de los bailarines, independientemente de su nivel.',
      'Error 1: Colapsar los hombros hacia adelante. Este es el error más extendido. Cuando los hombros caen, el pecho se cierra y pierdes capacidad de comunicación con tu pareja. La solución es imaginar que tienes un hilo que tira de la coronilla hacia el techo: el pecho se abre naturalmente.',
      'Error 2: Doblar las rodillas en exceso. Muchos bailarines creen que "bajar el centro de gravedad" significa doblar mucho las rodillas. El resultado es un cuerpo tenso y sin fluidez. Las rodillas deben estar levemente flexionadas, no bloqueadas, pero tampoco exageradamente dobladas.',
      'Error 3: Tensión en los brazos. El brazo que crea el marco con tu pareja debe ser firme pero no rígido. Si está tenso, cada impulso que das o recibes llega distorsionado. Practica sostener el peso de un libro con el brazo extendido: eso es la tensión justa.',
      'Error 4: Mirar al suelo. La vista al frente no es solo una cuestión estética. Cuando miras hacia abajo, rompes tu eje y transfieres ese desequilibrio a tu pareja. Mantén la cabeza neutral, con la mirada al frente o ligeramente inclinada, nunca al suelo.',
      'Error 5: Compensar el peso en un solo pie de forma estática. El peso debe estar siempre en movimiento hacia donde va el siguiente paso. Si te quedas "clavado" en un pie entre movimientos, perderás la fluidez del baile. Practica el balance continuo incluso cuando estás quieto.',
    ],
  },
  'musicalidad-tango-bachata': {
    slug: 'musicalidad-tango-bachata',
    title: 'La Musicalidad en el Tango vs Bachata',
    category: 'Musicalidad',
    excerpt: 'Entender los tiempos fuertes y las melodías es clave. Aprende a diferenciar cuándo pisar con fuerza y cuándo deslizarte.',
    image: '/hero-bg.png',
    date: '2024-03-05',
    readTime: '6 min',
    content: [
      'Uno de los mayores desafíos al aprender Bachatango es entender cómo se interpreta musicalmente. La bachata y el tango tienen lenguajes rítmicos muy distintos, y aprender a navegar entre ambos es lo que separa a un bailarín funcional de uno verdaderamente musical.',
      'La bachata tiene una estructura rítmica muy clara: cuatro tiempos con un acento en el cuarto (el famoso "tap" o golpe de cadera). Este acento es un ancla. El bailarín de bachata sabe siempre dónde está dentro de la frase musical. El tango, en cambio, trabaja con frases musicales más complejas donde el silencio y la anticipación tienen tanto peso como el golpe.',
      'En el bachatango, la clave es aprender a leer la melodía por encima del ritmo. Cuando la melodía sube, el movimiento puede expandirse. Cuando cae, el cuerpo puede contraerse o hacer una pausa. Esto requiere escuchar activamente la música en lugar de simplemente contar tiempos.',
      'Un ejercicio práctico que usamos en nuestras clases: escucha la canción sin bailar. Identifica los momentos de máxima tensión musical y los de reposo. Después, baila exclusivamente respondiendo a esos momentos. No cuentes, siente. Poco a poco, tu cuerpo aprenderá a anticipar la música en lugar de reaccionar a ella.',
      'El bachatango nos invita a ser más compositores que intérpretes. No ejecutamos pasos en tiempo, creamos frases de movimiento que dialogan con la música. Esa es la diferencia que marca el nivel en esta danza.',
    ],
  },
};

export function generateStaticParams() {
  return Object.keys(ARTICLES).map((slug) => ({ slug }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  const article = ARTICLES[slug];

  if (!article) return { title: 'Artículo no encontrado' };

  return {
    title: article.title,
    description: article.excerpt,
    openGraph: {
      title: `${article.title} | Luis y Sara Bachatango`,
      description: article.excerpt,
      url: `/blog/${slug}`,
      type: 'article',
      images: [{ url: article.image, width: 1200, height: 630, alt: article.title }],
    },
    alternates: { canonical: `/blog/${slug}` },
  };
}

export default async function BlogArticlePage(
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const article = ARTICLES[slug];

  if (!article) notFound();

  return (
    <article className={styles.container}>
      <div className={styles.hero}>
        <Image
          src={article.image}
          alt={article.title}
          fill
          style={{ objectFit: 'cover', opacity: 0.4 }}
          priority
        />
        <div className={styles.heroContent}>
          <span className={styles.category}>{article.category}</span>
          <h1 className={styles.title}>{article.title}</h1>
          <div className={styles.meta}>
            <span>
              {new Date(article.date).toLocaleDateString('es-ES', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
            <span>·</span>
            <span>{article.readTime} de lectura</span>
          </div>
        </div>
      </div>

      <div className={styles.content}>
        <Link href="/blog" className={styles.backLink}>← Volver al Blog</Link>
        {article.content.map((paragraph, i) => (
          <p key={i} className={styles.paragraph}>{paragraph}</p>
        ))}
      </div>
    </article>
  );
}
