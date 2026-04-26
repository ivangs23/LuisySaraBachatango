'use client';

import styles from "./page.module.css";
import Hero from "@/components/Hero";
import AboutSection from "@/components/AboutSection";
import Features from "@/components/Features";
import Testimonials from "@/components/Testimonials";
import FAQ from "@/components/FAQ";
import Newsletter from "@/components/Newsletter";
import InstagramGallery from "@/components/InstagramGallery";

export default function Home() {
  return (
    <div className={styles.container}>
      {/* Hero cinemático con vídeo de fondo y animaciones de entrada */}
      <Hero />

      {/* Quiénes somos — bloque cinemático con parallax */}
      <AboutSection />

      {/* Features (con anchor para el scroll-indicator del hero) */}
      <div id="features">
        <Features />
      </div>

      {/* Testimonials */}
      <Testimonials />

      {/* Gallery */}
      <InstagramGallery />

      {/* FAQ */}
      <FAQ />

      {/* Newsletter */}
      <Newsletter />
    </div>
  );
}
