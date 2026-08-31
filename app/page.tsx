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
import { buildFaqJsonLd } from "@/utils/seo/faq-jsonld";
import { safeJsonLd } from "@/utils/jsonld";
import { getLandingStats, getTestimonials, getFaqItems } from "@/utils/landing/content";
import { getCurrentLocale } from "@/utils/i18n/get-locale";

// ISR: el precio del curso se relee como mucho cada 5 minutos.
export const revalidate = 300;

export default async function Home() {
  const locale = await getCurrentLocale();
  const [course, stats, testimonials, faqItems] = await Promise.all([
    getLandingCourse(),
    getLandingStats(),
    getTestimonials(locale),
    getFaqItems(locale),
  ]);

  // Se alimenta de los mismos items que renderiza <FAQ />, así que el marcado
  // no puede divergir de lo que el visitante ve en pantalla.
  const faqJsonLd = buildFaqJsonLd(
    faqItems.map((f) => ({ q: f.question, a: f.answer })),
  );

  return (
    <div className={styles.container}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(faqJsonLd) }}
      />
      {/* Hero cinemático con imagen de fondo y animaciones de entrada */}
      <Hero stats={stats} />

      {/* Quiénes somos — bloque cinemático con parallax */}
      <AboutSection />

      {/* Features (con anchor para el scroll-indicator del hero) */}
      <div id="features">
        <Features />
      </div>

      {/* Testimonials */}
      <Testimonials items={testimonials} />

      {/* Oferta — solo si el curso existe y está publicado */}
      {course && <HomeOffer price={course.price_eur} />}

      {/* Gallery */}
      <InstagramGallery />

      {/* FAQ */}
      <FAQ items={faqItems} />

      {/* Newsletter */}
      <Newsletter />
    </div>
  );
}
