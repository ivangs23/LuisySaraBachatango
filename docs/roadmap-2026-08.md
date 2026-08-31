# Roadmap — agosto 2026

Qué hacer después de la remediación de la landing (PR #3), en qué orden y por qué.
Este documento es el *spec* del que cuelga
`docs/superpowers/plans/2026-08-13-post-landing.md`.

## Dónde estamos

PR #3 abierta, CI en verde, mergeable. Cierra el embudo de venta, la clase
gratis, el consentimiento de cookies, la analítica y una caída de producción
que llevaba semanas (`/curso-bachatango` en 404 para visitantes anónimos).

Lo que **no** cubre y sigue vivo:

| Origen | Pendiente |
|---|---|
| Auditoría junio (A1) | Load test del flujo autenticado de lección — nunca ejecutado |
| Auditoría junio (A2) | Cuota de conexiones Realtime de Supabase sin verificar |
| Auditoría junio (M1) | El cliente descarga los 6 diccionarios |
| PR #3 | Policy de `course_purchases` sigue leyendo `profiles.role` |
| PR #3 | Routing por locale + hreflang |
| PR #3 | Copy editorial hardcodeado en español |
| Auditoría landing | Temario, garantía, credenciales, eventos y blog ausentes de la venta |
| Auditoría landing | Testimonios sin foto ni vídeo |

Ya resuelto y que **no hay que replanificar**: M2 (`verifyStripeSession` sí valida
la propiedad de la sesión, comprobado en `app/profile/actions.ts:20`).

## Principio que ordena el resto

**Enviar primero, medir después, y decidir lo caro con datos.** La analítica se
acaba de instalar y todavía no ha recogido nada. El trabajo más caro del backlog
—routing por locale— se beneficia de saber de qué países e idiomas llega el
tráfico, aunque ya esté decidido que se hace.

Corolario: entre tanto, solo trabajo que **no dependa de datos ni de material
nuevo**. Hay bastante.

---

## Fase 0 — Enviar (bloquea todo lo demás)

Sin esto, la analítica no recoge y el resto se decide a ciegas.

1. Mergear PR #3.
2. Dar de alta en Vercel (producción):
   - `NEWSLETTER_UNSUBSCRIBE_SECRET` — sin ella el email de bienvenida no sale
   - `NEXT_PUBLIC_GA_MEASUREMENT_ID`
   - `NEXT_PUBLIC_META_PIXEL_ID`
3. Verificar tras el deploy: `npx tsx scripts/check-public-surface.ts` debe dar
   **8/8**. Hoy da 4 fallos contra producción, y son exactamente lo que la PR
   entrega.
4. Comprobar a mano lo que ninguna automatización cubre: suscribirse con una
   dirección real, recibir el email, seguir el enlace de baja, resuscribirse.

## Fase 1 — Lo que ya es ejecutable

Nada aquí espera datos ni material. Detalle paso a paso en
`docs/superpowers/plans/2026-08-13-post-landing.md`.

### 1a. Temario real en la página de venta

Hoy `/curso-bachatango` vende con seis viñetas genéricas
(`app/curso-bachatango/copy.ts`, bloque `learn`) que valdrían para cualquier
curso de baile: *"Técnica y postura"*, *"Estilo propio"*…

El temario de verdad ya está en la base de datos y cuenta una historia:

```
INTRODUCCIÓN → POSTURAS → 4 BÁSICOS → 5 COMBOS → BALANCE → DEMOSTRACIÓN FINAL
14 módulos · 28 vídeos · todos listos en Mux
```

Lo específico prueba que el curso existe; lo genérico no prueba nada. Este es el
cambio de mayor valor por unidad de esfuerzo del backlog, y **no necesita
material nuevo**.

### 1b. Duraciones desde Mux

Ninguna de las 28 lecciones tiene `duration`, y el temario gana mucho si puede
decir "14 módulos, 3 h 20 min". Mux ya conoce la duración de cada asset; solo
hay que traerla y guardarla.

### 1c. Policy de `course_purchases`

Sigue leyendo `profiles.role` directamente. Hoy no rompe nada porque
`lessons` dejó de depender de ella, pero es exactamente el patrón que tumbó el
embudo en julio. Requiere ver su definición viva antes de tocarla.

### 1d. Cambiar la clase de muestra

`/clase-gratis` sirve **COMUNIDAD** (módulo 2), la única marcada `is_free`. Como
carta de presentación de un curso de bachatango es floja: no enseña a bailar.
Candidatas mejores, por orden: **INTRODUCCIÓN** (módulo 1), **POSTURAS**
(módulo 3) o **BÁSICO PASEO DIAGONAL** (módulo 4, con 3 sublecciones).

No es trabajo de código: se marca `is_free` en el admin y la ruta la coge sola.
Si se marca más de una, gana la de menor `order`.

## Fase 2 — Medir (7 días desde el deploy)

Dejar correr. Después, mirar:

- **Idioma y país del tráfico** → afina el alcance de la Fase 3.
- **Embudo**: `/` → `/curso-bachatango` → `/curso-bachatango/comprar` → `/gracias`.
  Dónde se cae dice qué sección falta de verdad, en lugar de adivinarlo.
- **`/clase-gratis`**: ¿cuántos la ven y cuántos compran después? Valida o
  desmonta toda la Fase 3 de la PR anterior.
- **Altas de newsletter** y cuántas abren el email de bienvenida.

## Fase 3 — Internacionalización

Confirmado como mercado real, así que se hace. Va después de medir solo para
saber **qué idiomas priorizar**, no para decidir si merece la pena.

Alcance: routing `/[locale]/…`, middleware, `hreflang` recíproco, canonical por
idioma, sitemap por idioma, redirecciones desde las URLs actuales, y mover a los
diccionarios el copy editorial hardcodeado (`AboutSection`, `Features`,
`Testimonials`, `InstagramGallery`) más `curso-bachatango/copy.ts`.

**Merece su propio plan**: toca middleware y todas las rutas, y mezclarlo con lo
anterior haría imposible revisar nada. Escribirlo al llegar a esta fase.

## Fase 4 — Robustez

Sin urgencia mientras el tráfico sea el actual, pero es lo que queda de junio.

- **A1**: `loadtest/scenarios/lesson-flow.js`, 500 VUs, criterio p95 < 2500 ms
  contra un Preview. Es la ruta más cara del sistema y nunca se ha medido.
- **A2**: Supabase → Settings → Realtime. `NotificationBell` abre un canal por
  usuario logueado; confirmar que la cuota de pico supera los 1500.
- **M1**: carga dinámica del diccionario por locale en cliente. Ojo: la Fase 3
  cambia por completo cómo se resuelve el locale, así que **hacerlo después**,
  no antes.

## Aparcado — necesita material que hoy no existe

Disponible ahora: el curso completo con información y fotos. No hay testimonios
reales, ni hero apaisado, ni showreel.

| Pendiente | Qué desbloquea | Qué hace falta |
|---|---|---|
| Testimonios reales | Prueba social creíble; hoy son 3 nombres inventados con 5 estrellas fijas | Nombre, foto o vídeo, con permiso |
| Hero apaisado ≥2560 px | LCP de 5,4 s → objetivo 2,5 s. `next/image` no puede inventar píxeles sobre un 1080×1920 vertical | Una foto horizontal |
| Garantía / devolución | Quita riesgo al comprador; hoy lo asume entero | Decisión de negocio, no código |
| Credenciales en la home | Premios Platino, Bailando con las Estrellas, Il Divo — hoy enterrados en `/sobre-nosotros` | Solo decidir cómo presentarlo |
| Showreel | El hero es una foto fija | Un clip |

## Decisiones abiertas

1. **¿30 o 50 países?** Unificado en 30 (hero, `/sobre-nosotros` y OG image) a la
   espera de confirmación. Se eligió el menor: inflar una cifra cuesta
   credibilidad, bajarla no.
2. **Qué lección es la clase de muestra** (ver 1d).
3. **URLs reales de Facebook y TikTok** para `sameAs`. YouTube da 404 y se quitó;
   las otras dos responden 200 tras muro de login, que no prueba que sean vuestras.
