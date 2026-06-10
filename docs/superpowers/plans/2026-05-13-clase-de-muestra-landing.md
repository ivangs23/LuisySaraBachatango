# Landing "Clase de Muestra" — Análisis previo a implementación

> Estado: análisis/brainstorming. NO ejecutar como plan TDD aún — faltan respuestas del owner (sección 9).
> Fecha: 2026-05-13.

## 1. Estado actual del proyecto

| Pieza | Estado |
|---|---|
| CTA "Ver clase de muestra" en Hero (`components/Hero.tsx`) | Existe, apunta a `/courses` (genérico) |
| Flag `lessons.is_free` en BD | Existe; no se expone a anónimos |
| Página de curso para anónimos | `CoursePreviewShell` (audit5 C.5) — info + CTA login |
| Newsletter (captura email) | Tabla `newsletter_subscribers` + `app/actions/newsletter.ts`, solo en footer home |
| Stripe checkout (`/api/checkout`) | Funciona — `STRIPE_CONFIG` tiene price IDs placeholder idénticos para 1m/6m/1y |
| Course types | `membership` (suscripción) o `complete` (compra única) |
| Analítica web | NADA (sin GA4, Meta Pixel, PostHog, Plausible). Sentry solo errores |
| Página dedicada `/clase-de-muestra` | No existe |
| Cookie consent | No existe |

Gap principal: no es la página en sí — es el **funnel completo + tracking**. Sin medir no se optimiza.

## 2. Funnel propuesto

```
[Home/SEO/Ads]
   ↓ click CTA
[/clase-de-muestra]  ← landing nueva (sin login)
   ↓
[Vídeo Mux Player (lección sample, anon)]
   ↓ event listeners (25/50/75/100%)
[CTA mid-scroll → curso completo]
   ↓
[Bloque "qué incluye"] → [Testimonios] → [Garantía] → [CTA final + sticky bar móvil] → [FAQ] → [Email fallback newsletter]
   ↓ click compra
[Signup-first o checkout directo — decidir, ver 9.3]
   ↓
[Stripe Checkout]
   ↓
[Webhook `checkout.session.completed` → course_purchases]
   ↓
[Confirm + onboarding email]
```

Variantes A/B futuras: email-gate-pre-video vs vídeo-libre-CTA-final. MVP: vídeo libre (menos fricción).

## 3. Estructura de `/clase-de-muestra` (orden + función psicológica)

1. **Hero compacto** — promesa concreta + sub-frase ("qué aprenderás en 5 min") + CTA scroll a vídeo. Sin nav distractora.
2. **Vídeo Mux Player** — lección con flag `is_sample=true`. Autoplay-muted opcional.
3. **CTA mid-scroll** — visible tras ~30s reproducción.
4. **Comparativa muestra vs curso completo** — bullets concretos (nº lecciones, duración, idiomas, soporte, comunidad).
5. **Testimonios** — 3 reseñas (reusar `Testimonials`).
6. **Garantía/objection-killer** — cancelas cuando quieras, logos Stripe/Visa.
7. **CTA final + sticky bar móvil** con precio.
8. **FAQ específico** — "¿Necesito experiencia?", "¿Pareja?", "¿Móvil?", "¿Reembolso?".
9. **Email fallback newsletter** — para los que no compran ("3 lecciones gratis por email").

## 4. Decisiones técnicas

### 4.1 ¿Qué lección sirve como muestra?

- (a) Hardcodear `lessonId` en env. Simple, rígido.
- (b) **Recomendado:** flag `lessons.is_sample boolean default false` + UI admin para marcarla. Constraint parcial unique para max 1.
- (c) Reusar `is_free=true` + columna `featured_at timestamptz`.

(b) crea semántica clara y permite cambiar sin redeploy.

### 4.2 Anónimo viendo el vídeo

Variante de Mux JWT: `signPlaybackTokenAnon(playbackId)` con TTL corto (15 min). Solo aplicable a la sample. Mux no distingue anon del player; el JWT firma para ese asset durante 15 min sin importar quién lo use → seguro mientras se restrinja a la sample.

### 4.3 Página ISR

`revalidate: 600` (10 min). El `playback_token` se firma por request (corto), se inyecta como prop al cliente. SEO friendly + rápida.

### 4.4 URL

- Canónica: `/clase-de-muestra` (ES, mejor SEO localizado).
- Alias `/sample-class` opcional. Una sola URL por ahora — locale por cookie como el resto.
- CTA Hero `sampleClass`: `/courses` → `/clase-de-muestra`.

### 4.5 Checkout flow

Stripe Checkout permite invitado. Decisión:

- **Signup-first:** lead capturado aunque abandone pago, cuenta + curso ligados desde inicio.
- **Checkout-direct:** menos fricción, +10-20% conversión típica.

Recomendación inicial: signup-first con un campo (email + password) o magic link tras checkout. Ver webhook `checkout.session.completed` para entender cómo se crea `course_purchase`.

## 5. Tracking / analítica (lo más importante)

Sin datos no se optimiza.

### Stack propuesto

- **PostHog** (free tier, heatmaps, session replay, funnels visuales, GDPR-friendly). Alt: GA4 + Plausible.
- **Meta Pixel** + Conversions API server-side (iOS 14+) — solo si vais a hacer ads en IG.

### Eventos custom

- `landing_view`
- `sample_video_started` (Mux Player play)
- `sample_video_25 / 50 / 75 / completed`
- `cta_clicked` con prop `position: hero|mid|final|sticky`
- `email_captured`
- `signup_started / signup_completed`
- `checkout_started / checkout_completed`
- `purchase` con `value:<eur>` + `course_id` (para Meta Pixel ROAS)

### Cookie consent

Antes de cargar Pixel/GA4 — banner GDPR. Solución mínima sin lib o `cookieconsent`.

## 6. SEO

- Meta title/description: "Clase de muestra gratis | Aprende Bachatango con Luis y Sara".
- JSON-LD `Course` (curso completo) + `VideoObject` (la sample — Google mostrará thumbnail en SERP).
- `og:video` para preview en Twitter/Meta share.
- `/clase-de-muestra` en sitemap.
- Internal links: Hero, footer, `/courses` ("¿No te decides? Mira la muestra").

## 7. Optimizaciones conversión

- H1 con beneficio, no feature: "Aprende los 3 movimientos que hacen tu Bachata diferente" > "Clase gratis".
- Duración visible: "Vídeo · 7 min".
- Sticky bar móvil precio + CTA — recupera ~15% que llega al final sin scroll-up.
- Loading prioritario vídeo (Mux Player `prefetch`).
- Prueba social cerca de CTA ("+4.000 alumnos en 25 países" — ya está en STATS).
- Sin nav distractora — layout sin menú principal, logo + CTA fijo.

## 8. Trabajo técnico (alcance, no plan TDD)

### Backend / datos

1. Migración: `lessons.is_sample boolean default false` + constraint parcial unique para max 1 con `true`.
2. Util `getSampleLesson()` → lesson sample + course asociado.
3. `signPlaybackTokenAnon(playbackId)` en `utils/mux/server.ts` — variante sin user.
4. Admin: toggle "Marcar como clase de muestra" en `/courses/:cid/:lid/edit`.

### Frontend

5. `app/clase-de-muestra/page.tsx` — server component, ISR 10 min.
6. `SampleHero` (compacto, sin nav).
7. `SampleVideoSection` — cliente, Mux Player + event listeners.
8. `SampleStickyCta` — móvil, sticky bottom.
9. `SampleComparison` — muestra vs completo.
10. `SampleFAQ` — schema.org `FAQPage`.
11. `app/clase-de-muestra/layout.tsx` — layout sin nav superior.
12. Cambiar CTA Hero principal: `/courses` → `/clase-de-muestra`.
13. Decidir signup-first vs checkout-direct (sección 9.3) y ajustar redirect post-checkout para sesión persistente.

### Tracking

14. Provider PostHog en `app/layout.tsx` con respeto consentimiento.
15. `CookieConsent` mínimo (banner + LocalStorage).
16. Eventos custom en cada touchpoint.
17. Server-side Conversions API Meta — `route.ts` que reenvía `purchase` desde webhook Stripe.

### SEO

18. JSON-LD `VideoObject` + sitemap entry + meta tags.
19. Robots NO bloqueando — debe indexar.

### Tests

20. E2E (Playwright): landing renderiza, vídeo carga, CTA navega a checkout/signup.
21. Vitest: `getSampleLesson()` + `signPlaybackTokenAnon()`.

### Operaciones

22. Setear `NEXT_PUBLIC_BASE_URL` en Vercel (pendiente del audit anterior).
23. Crear cuenta PostHog/Plausible/GA4 — proyecto + key.
24. Configurar Meta Conversions API si hay ads.
25. Lighthouse pass landing (target: Perf ≥95, A11y 100, BP 100, SEO ≥90 con dominio propio).

## 9. Preguntas pendientes (decidir antes de codificar)

1. **Curso/precio target** — ¿curso `complete` específico o suscripción `membership`? Define botón final + copy.
2. **Email gate** — ¿exigir email antes del vídeo o vídeo libre? Voto: **libre**.
3. **Signup-first o checkout-direct** — ¿obligar registro antes del Stripe Checkout o invitado?
4. **Herramienta analítica** — PostHog (recomendado) vs GA4+Meta Pixel.
5. **Cookies/GDPR** — banner técnico mínimo vs marketing-grade con categorías.
6. **Lección concreta sample** — ¿ya hay candidata o admin la marca después?
7. **Idiomas** — 6 idiomas como el resto o solo ES+EN MVP.

## 10. Próximo paso

Cuando el owner responda las 7 preguntas → escribir plan TDD ejecutable en `docs/superpowers/plans/YYYY-MM-DD-clase-de-muestra-impl.md` y dispatchar subagentes.
