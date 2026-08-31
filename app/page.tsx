import styles from "./page.module.css";
import Hero from "@/components/Hero";
import AboutSection from "@/components/AboutSection";
import Features from "@/components/Features";
import Testimonials from "@/components/Testimonials";
import HomeOffer from "@/components/HomeOffer";
import FAQ from "@/components/FAQ";
import Newsletter from "@/components/Newsletter";
import InstagramGallery from "@/components/InstagramGallery";
import { getLandingCourse } from "@/utils/courses/landing-course";
import { getDict } from "@/utils/get-dict";
import { buildFaqJsonLd } from "@/utils/seo/faq-jsonld";
import { safeJsonLd } from "@/utils/jsonld";

// ISR: el precio del curso se relee como mucho cada 5 minutos.
export const revalidate = 300;

export default async function Home() {
  const [course, dict] = await Promise.all([getLandingCourse(), getDict()]);

  // Se alimenta del mismo diccionario que renderiza <FAQ />, así que el
  // marcado nunca puede divergir de lo que el visitante ve en pantalla.
  const faqJsonLd = buildFaqJsonLd([
    { q: dict.faq.q1.q, a: dict.faq.q1.a },
    { q: dict.faq.q2.q, a: dict.faq.q2.a },
    { q: dict.faq.q3.q, a: dict.faq.q3.a },
  ]);

  return (
    <div className={styles.container}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(faqJsonLd) }}
      />
      {/* Hero cinemático con imagen de fondo y animaciones de entrada */}
      <Hero />

      {/* Quiénes somos — bloque cinemático con parallax */}
      <AboutSection />

      {/* Features (con anchor para el scroll-indicator del hero) */}
      <div id="features">
        <Features />
      </div>

      {/* Testimonials */}
      <Testimonials />

      {/* Oferta — solo si el curso existe y está publicado */}
      {course && <HomeOffer price={course.price_eur} />}

      {/* Gallery */}
      <InstagramGallery />

      {/* FAQ */}
      <FAQ />

      {/* Newsletter */}
      <Newsletter />
    </div>
  );
}
