# Spec 1 — Landing de venta: CURSO BACHATANGO

**Fecha:** 2026-07-09
**Estado:** Diseño aprobado (pendiente revisión de spec)
**Alcance:** UI de la landing de venta standalone. El checkout invitado (pago→cuenta) es un sub-proyecto aparte (Spec 2).

## Objetivo

Página de aterrizaje standalone, orientada a conversión, que vende **un solo curso** (CURSO BACHATANGO, `complete`, pago único €199) a tráfico frío. Todo el diseño empuja hacia un único CTA: comprar el curso.

## Producto (datos reales de la BD)

- **id:** `f89a576f-4a77-40f7-93e9-23e6c820ee92`
- **título:** CURSO BACHATANGO
- **course_type:** `complete` (compra única vía `course_purchases`)
- **price_eur:** 199
- **image_url:** portada en Supabase storage (`thumbnails/course-covers/…png`)
- **lección gratis:** existe una lección `is_free` ("COMUNIDAD") reutilizable como "clase de prueba".

El precio/nombre/imagen se leen **en vivo de la BD** en el Server Component para no duplicar datos ni desincronizar el precio.

## Decisiones de diseño (aprobadas)

1. **Ruta:** `/curso-bachatango` (libre, no auth-gated).
2. **Idioma:** solo español (MVP). No pasa por `dictionaries.ts`; copy en constantes del módulo. i18n futuro fuera de alcance.
3. **Layout:** standalone mínimo. Sin `Header`/`Footer` del sitio. Barra propia (logo + CTA comprar, sticky).
4. **Copy:** redactado por el asistente (placeholder realista, editable). Incluido más abajo.
5. **Sin garantía de devolución** → risk-reversal vía "clase gratis" + señales de confianza. No se inventa money-back.

## Aislamiento del layout (mecanismo)

`Header` y `Footer` se renderizan en `app/layout.tsx` (root, envuelven todo). Next App Router no permite quitar el root layout por ruta. Mecanismo elegido (bajo riesgo, reversible):

- `Header` ya es `'use client'` y usa `usePathname()`. Añadir: `if (pathname === '/curso-bachatango') return null`.
- `Footer` (client) igual, o envolver `<Footer/>` en un componente cliente que lo oculte en esa ruta.
- La landing renderiza su propia barra sticky mínima.

Rechazado: root layouts con route groups `(marketing)`/`(app)` — obliga a duplicar providers (LanguageProvider, fonts, JSON-LD). Refactor grande e innecesario para una landing.

## Arquitectura y flujo de datos

```
app/curso-bachatango/
  page.tsx            Server Component. Fetch course (title, price_eur, image_url).
                      Renderiza secciones. Pasa {courseId, price} a los CTAs.
  page.module.css     Estilos (tokens del sitio: dorado/negro, Playfair+Inter).
  _components/
    LandingHero.tsx        (client si necesita motion) hero + CTA
    LandingSection.tsx     wrapper de sección reutilizable
    StickyBuyBar.tsx       (client) barra CTA sticky con IntersectionObserver
    CourseCtaButton.tsx    (client) botón CTA — ver "CTA" abajo
  copy.ts             constantes de texto (es) — separado para editar fácil
```

- **page.tsx** (Server Component): usa `createClient()` (o admin) para leer la fila del curso. Si no existe o no publicado → `notFound()`.
- Animaciones con el componente existente `Reveal` (motion/react) + `prefers-reduced-motion` ya respetado.
- Iconos: `lucide-react` (ya en uso).

## CTA — comportamiento (seam hacia Spec 2)

Un único componente `CourseCtaButton` centraliza la lógica. En **Spec 1** (interino, sin guest checkout todavía):

- **Usuario logueado** → POST `/api/checkout` con `courseId` (patrón de `BuyCourseButton` actual) → redirect a Stripe.
- **Usuario no logueado** → `/signup?next=/curso-bachatango` (interino).

En **Spec 2** se sustituye SOLO la rama "no logueado" por guest checkout (Stripe recoge email; webhook crea la cuenta). El resto de la landing no cambia. Este componente es la única costura que Spec 2 toca.

> Nota: el estado de auth se pasa desde el Server Component (`getCurrentUser()`) como prop `isAuthed` a los CTAs, para no parpadear.

## Estructura de la página (secciones + copy borrador)

Todas las secciones envueltas en `Reveal`. CTA repetido en hero, oferta y cierre.

1. **Barra sticky** — logo "Luis y Sara" + botón "Comprar · €199". Aparece al pasar el hero (IntersectionObserver).

2. **Hero** (full-bleed, portada como fondo con overlay oscuro)
   - H1: *"Baila bachatango como nunca imaginaste"*
   - Sub: *"El método completo de Luis y Sara para dominar la técnica, la conexión y la musicalidad — a tu ritmo, desde casa."*
   - CTA primario: *"Empieza ahora · €199"* + microcopy: *"Pago único · Acceso de por vida · Pago seguro con Stripe"*
   - CTA secundario texto: *"Prueba una clase gratis"* → ancla a sección clase gratis.

3. **Dolor → promesa**
   - *"¿Te trabas con las figuras? ¿No conectas con tu pareja? ¿Sientes que no marcas el tiempo?"* → *"Este curso te lleva de la frustración a bailar con seguridad y estilo."*

4. **Qué aprendes** (grid de 4–6 tarjetas con icono)
   - Técnica y postura · Conexión en pareja · Musicalidad y tiempo · Figuras y combinaciones · Estilo propio · Progresión paso a paso.

5. **El método Luis y Sara** (diferenciador)
   - Enfoque progresivo, desglose de cada movimiento, práctica guiada. Por qué funciona.

6. **Quiénes son Luis y Sara** (bio + credibilidad internacional, foto `luis-sara-about.jpg` existente).

7. **Testimonios** (prueba social — 3 tarjetas, estilo del `Testimonials` existente; placeholder editable).

8. **Empieza sin riesgo** (sustituye "garantía")
   - *"Prueba una clase gratis antes de decidir."* → CTA a la lección `is_free`. Señales: pago seguro Stripe · acceso de por vida · comunidad.

9. **Oferta + precio** (bloque destacado)
   - *"CURSO BACHATANGO completo"* · lista de qué incluye · **€199 pago único** · *"acceso de por vida"* · CTA "Comprar ahora".

10. **FAQ** (objeciones — estilo `FAQ` existente)
    - ¿Necesito pareja? · ¿Qué nivel? · ¿En qué dispositivos? · ¿Cuánto dura el acceso? · ¿Es seguro el pago? · ¿Puedo empezar sin experiencia?

11. **CTA final** (cierre a pantalla) — titular motivador + botón comprar.

## Estilos

- Tokens existentes (`app/globals.css`): fondo `#050505`, dorado `--primary #c0a062`, rojo `--secondary #8a1c1c`, Playfair Display (títulos) + Inter (cuerpo), escalas de spacing/radius/tipografía ya definidas.
- CSS Modules (sin Tailwind). Reutilizar patrones de `Hero.module.css`/`page.module.css`.
- Responsive: mobile-first, `--page-max 1280px`, `--page-pad`.

## SEO / metadata

- `export const metadata` en `page.tsx`: title/description específicos de venta, OpenGraph con la portada del curso, `alternates.canonical` a `/curso-bachatango`.
- JSON-LD `Product` + `Offer` (precio 199 EUR, availability) para rich results.
- Añadir la ruta a `app/sitemap.ts`.

## Accesibilidad

- Contraste dorado/negro validado (texto sobre fondo oscuro).
- CTAs son `<button>`/`<a>` reales, focus ring existente (`--focus-ring`).
- `Reveal` respeta `prefers-reduced-motion`.
- Hero: overlay suficiente para legibilidad; alt en imágenes.

## Testing

- Unit (Vitest): `CourseCtaButton` — rama logueado (llama `/api/checkout`) vs no logueado (redirige a `/signup?next=`). Mock fetch.
- Unit: `page.tsx` fetch → `notFound()` si curso ausente/no publicado.
- Render: secciones presentes, CTA con precio de la BD.
- Manual: verificar que `Header`/`Footer` NO aparecen en `/curso-bachatango` y SÍ en el resto.

## Fuera de alcance (Spec 1)

- Guest checkout / creación de cuenta post-pago → **Spec 2**.
- i18n multi-idioma.
- Garantía money-back.
- A/B testing, analytics de conversión (posible Spec 3).
- Cambios en el `/api/checkout` o webhook.

## Supuestos

- El copy es placeholder editable; Luis y Sara ajustarán textos/bio/testimonios reales.
- La lección `is_free` "COMUNIDAD" sirve como "clase gratis" (o se marcará otra `is_free` más representativa).
- La landing convive con el sitio; no reemplaza `/courses` ni la home.
