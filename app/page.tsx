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

// ISR: el precio del curso se relee como mucho cada 5 minutos.
export const revalidate = 300;

export default async function Home() {
  const course = await getLandingCourse();

  return (
    <div className={styles.container}>
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
