# Plan de marketing por fases — octubre 2026

> **Para agentes (Antigravity / Claude):** ejecuta este plan fase a fase y tarea a tarea, en orden. Cada tarea termina en un commit. No empieces una fase sin haber cerrado la anterior y sin que estén resueltas las decisiones que la bloquean (sección «Decisiones»). Lee antes `CLAUDE.md` y `supabase/MIGRATIONS.md`.

**Objetivo:** que el tráfico frío de Meta Ads compre, y que quien no compra en la primera visita deje su email. Hoy (12–23 oct 2026) el 1,4 % de las visitas a `/curso-bachatango` pasa a `/curso-bachatango/comprar`; antes de los anuncios era el 15 %. Quien llega al formulario compra el 36 % de las veces, así que el formulario no es el problema: lo es la landing y la falta de captura.

**Informe del que sale este plan:** «Auditoría de marketing · Luis y Sara Bachatango», versión 2 (23-oct-2026), https://claude.ai/artifact/Msik53u52kygPHu8U2W5dS

**Datos de partida (producción, 23-oct-2026):**

| Dato | Valor |
|---|---|
| Producto | 1 curso, `COURSE_ID` en `utils/courses/landing-course.ts`, 119 €, 28 lecciones, 2 h 12 min |
| Compras pagadas | 28; 8 desde el inicio de los anuncios (9-oct) |
| Precio cobrado desde el 31-ago | 119 € en las 26 ventas; nunca 150 € |
| `courses.compare_at_price_eur` / `spots_left` | 150 / 5 (tachado y plazas en el hero) |
| `newsletter_subscribers` | 4 |
| Compradores sin ninguna lección vista | 4 de 29 |
| `assignments` / `submissions` | 0 / 0 |
| Lección gratis actual | «CUARTO BÁSICO - PASO MADRID CON VOLEA» (`is_free`, `order` 1) |

**Stack:** Next.js 16 (App Router), React 19, Supabase (`@supabase/ssr` + service role), Stripe, Mux, Resend (`utils/email/layout.ts`), Sentry, Vitest 4 + Testing Library, CSS Modules, Vercel (región `cdg1`).

---

## Reglas globales

1. **Línea base de tests.** Antes de la primera tarea ejecuta `npm test` y apunta el número de tests y ficheros en verde. Ninguna tarea puede bajarlo. Al final de cada tarea: `npm test`, `npm run lint`, `npx tsc --noEmit` y `npm run i18n:check` limpios. Al final de cada fase, también `npm run build`.
2. **TDD.** Test que falla → implementación → test que pasa. Tests en `__tests__/` replicando la ruta del fuente; los de componente abren con `// @vitest-environment jsdom` en la primera línea.
3. **Un commit por tarea**, solo con los ficheros de esa tarea. Mensajes en el estilo del repo (`feat(landing): …`, `fix(offer): …`).
4. **Nada se despliega a producción ni se aplica en la base de datos de producción sin confirmación explícita del usuario.** Las tareas llegan hasta el commit en una rama `feat/marketing-<fase>`.
5. **Migraciones:** fichero nuevo `supabase/2026_10_<tema>.sql`, aditivo e idempotente (`if not exists`), con RLS desde el primer momento, y una línea nueva en `supabase/MIGRATIONS.md`. Nunca re-ejecutes `rbac_setup.sql`, `events.sql`, `full_setup.sql` ni `schema.sql`. El código debe seguir funcionando si el deploy llega antes que el SQL (patrón de `selectWithOfferColumns` en `utils/courses/offer.ts`).
6. **Convenciones del repo:** CSS Modules (sin Tailwind ni librerías de UI), mutaciones por Server Actions, lecturas en Server Components, comentarios y textos de usuario en español. El copy del embudo vive en `app/curso-bachatango/copy.ts` (6 idiomas), no en los diccionarios generales.
7. **Precio:** lo que llega a Stripe sale siempre de una lectura fresca de la BD en `app/curso-bachatango/comprar/actions.ts`. Ningún cambio de caché o de copy toca esa ruta.
8. **Consentimiento:** el píxel y la CAPI de Meta solo con consentimiento de marketing (`context/ConsentContext.tsx`, `utils/analytics/meta-capi.ts`). Aceptar y Rechazar mantienen la misma prominencia en el banner (requisito AEPD).
9. **Nada inventado.** No escribas testimonios, cifras, credenciales, resultados de alumnos ni plazos que no estén en este plan o en la BD. Donde falte material, deja el bloque oculto tras un flag o un campo vacío en la BD y anótalo en el PR como `PENDIENTE: <qué falta>`. Las traducciones que generes se marcan en el PR como «para revisión nativa».
10. **Emails comerciales:** siempre con enlace de baja (`utils/newsletter/unsubscribe-token.ts`) y cabecera `List-Unsubscribe`, y solo a quien tenga consentimiento (`newsletter_subscribers.unsubscribed_at is null` o `profiles.marketing_consent`). Los emails de servicio a compradores (acceso, primeros pasos) no necesitan consentimiento comercial, pero no pueden incluir ofertas.

---

## Decisiones que necesita el usuario antes de empezar

El agente no las toma: las pregunta. Entre paréntesis, el valor por defecto si el usuario dice «lo que recomiendes».

| # | Decisión | Bloquea | Por defecto |
|---|---|---|---|
| D1 | ¿Quitar el precio tachado o subir el precio real a 150 € y hacer después una promoción con fechas? | Fase 0 | Quitar el tachado |
| D2 | ¿Garantía voluntaria condicionada («si completas los 4 básicos, envías tu vídeo y no notas mejora, te devolvemos el dinero») o se mantiene «sin devoluciones»? | T4.5 | Mantener sin garantía, pero sin la negrita en el aviso |
| D3 | Cifras oficiales: años, alumnos, países, títulos. Hoy hay `25 / 500 / 30 / 100` en `landing_stats` y «más de 300 alumnos» en la bio | T1.3 | Las que Luis y Sara confirmen; sin confirmar no se cambian |
| D4 | Lecciones: cuál es la clase abierta de la landing y cuáles dos se envían por email | T2.3, T3.2 | Abierta: «INTRODUCCIÓN» o «PRIMER BÁSICO DIAGONAL CON MÚSICA». Por email: «POSTURAS» y «BÁSICO PASEO DIAGONAL» |
| D5 | Bonus de corrección: texto y fecha de fin real (p. ej. «compras hasta el 30-nov») | T4.2 | Sin fecha no se publica el bonus |
| D6 | Comunidad: ¿se activa (grupo de WhatsApp o Telegram) o se quita de la oferta? | T1.3 | Quitarla de la oferta |
| D7 | Nombre exacto del programa de televisión y cadena para el titular | T2.1 | Resuelta: 1.ª edición, Telecinco 2024; Luis ganó (con María Isabel) y Sara fue segunda (con Adrián Lastra). «Ganadores» en plural no es exacto |

## Material que tienen que aportar Luis y Sara

- Testimonios reales con permiso de uso: nombre, ciudad, texto y, si es posible, vídeo de 15–20 s (Fase 1).
- Tráiler de 30–45 s subido a Mux (Fase 2, T2.4).
- Revisión del texto de los emails de las secuencias (Fases 3 y 4).
- Una tarea creada en la lección del primer combo desde el editor de lecciones (Fase 4).

---

## Fase 0 — Hoy, sin código (la hace el usuario en /admin)

- [ ] **0.1** En el formulario del curso: vaciar «precio antes» (`compare_at_price_eur`) según D1, y vaciar «plazas» (`spots_left`). `utils/courses/offer.ts` ya oculta ambos cuando están vacíos.
- [ ] **0.2** En /admin, contenido de la landing: despublicar los testimonios que no sean de alumnos reales.
- [ ] **0.3** Revisar el material impreso que lleva el QR de `docs/marketing/README.md`: anuncia el tachado y las plazas.

**Verificación:** abrir `/curso-bachatango` y `/` en incógnito: no aparecen «Antes 150 €» ni «Quedan 5 plazas».

---

## Fase 1 — Confianza y coherencia

### T1.1 Testimonios de la landing desde la base de datos

La landing de los anuncios pinta tres testimonios escritos en `copy.ts` (Madrid, Valencia, Sevilla); la home lee `landing_testimonials`. Unificarlo.

**Files:**
- Modify: `app/curso-bachatango/page.tsx` (añadir `getTestimonials(locale)` al `Promise.all`)
- Modify: `app/curso-bachatango/_components/LandingSections.tsx` (recibir `testimonials` por props; **no renderizar la sección si la lista está vacía**)
- Modify: `app/curso-bachatango/copy.ts` (eliminar `testimonials.items` en los 6 idiomas; dejar solo `title`)
- Modify: `utils/landing/content.ts` y `utils/landing/fallbacks.ts`: `getTestimonials` devuelve `[]` si no hay filas publicadas o si falla la BD. Los testimonios de relleno de `FALLBACK_TESTIMONIALS` desaparecen: un error de BD nunca debe enseñar testimonios inventados.
- Modify: `components/Testimonials.tsx` (home): tampoco se pinta con lista vacía.
- Test: `__tests__/components/landing-sections-testimonials.test.tsx`, `__tests__/unit/landing-content.test.ts` (crearlo si no existe)

**Aceptación:** con 0 filas publicadas no aparece la sección en ninguna de las dos páginas; con filas publicadas, la landing muestra las mismas que la home, en el idioma de la cookie.

### T1.2 Escasez y rebajas que no se puedan activar por error

**Files:**
- Modify: `components/CourseForm.tsx`: texto de ayuda bajo «precio antes»: «Solo si es el precio más bajo que habéis cobrado en los últimos 30 días»; y bajo «plazas»: «Solo si hay un límite real de alumnos».
- Modify: `utils/courses/offer.ts`: sin cambios de lógica salvo que el usuario lo pida.
- Test: el existente de `CourseForm` (añadir aserción de los textos de ayuda).

**Aceptación:** el admin ve la advertencia junto a ambos campos.

### T1.3 Un solo relato: FAQ, oferta, cifras y textos fijos

**Files:**
- Modify: `app/curso-bachatango/copy.ts`, los 6 idiomas:
  - FAQ «¿Qué nivel necesito?»: una única respuesta coherente con la FAQ de la home (`landing_faq`: «No hace falta… si ya bailas bachata o tango partirás con ventaja»). Eliminar la pregunta duplicada «¿Puedo empezar sin experiencia?».
  - Añadir FAQ «¿Cuánto dura?» con los datos que ya calcula `utils/courses/curriculum.ts` (módulos, lecciones, duración), interpolados igual que `learn.summary`.
  - Añadir FAQ «¿Me sirve si ya bailo bachata?».
  - `offer.includes`: «28 lecciones en vídeo HD», «Cada combinación explicada y después bailada con música», «Acceso de por vida, en móvil y ordenador», «Certificado al completar el curso». Quitar «actualizaciones» y, según D6, «Comunidad privada de alumnos» y «Comunidad de bailarines» (también en `freeClass.trust` y en la lista `trust` de `app/curso-bachatango/comprar/page.tsx`).
  - Nueva clave `faqTitle`: sustituye el «Preguntas frecuentes» escrito a mano en `LandingSections.tsx`.
- Modify (según D3): filas de `landing_stats` (desde /admin, no por código) y `about.bio4` en los 6 diccionarios de `utils/i18n/dictionaries/`.
- Test: `__tests__/components/landing-faq.test.tsx` (ampliar), test nuevo que recorra los 6 idiomas de `copy.ts` y falle si aparece «actualizaciones/updates» o si hay dos preguntas sobre nivel.

### T1.4 Enlaces a redes del pie de página

`components/Footer.tsx` toma Instagram/TikTok/YouTube/Facebook del último perfil actualizado que tenga Instagram, sea de quien sea.

**Files:**
- Create: `utils/brand/social.ts` con las URLs oficiales como constantes (pedir las URLs al usuario si no están en `utils/legal` o en el diccionario).
- Modify: `components/Footer.tsx` y `components/FooterClient.tsx`: dejar de consultar `profiles`.
- Test: `__tests__/components/footer-social.test.tsx` — el pie no hace ninguna consulta a `profiles` y pinta las constantes.

### T1.5 Página de gracias

**Files:**
- Modify: `app/gracias/page.tsx` (rama pagada): un solo mensaje — «Te hemos enviado un email para crear tu contraseña. Cuando entres, empieza por la lección 1.» — y el enlace de «¿Olvidaste tu contraseña?» como plan B. No tocar `PurchaseTracking` ni la rama demo.
- Test: `__tests__/api/gracias.test.ts` (ampliar).

**Cierre de fase 1:** `npm run build`, PR `feat/marketing-fase-1`, captura de la landing en móvil (390 px) en el PR.

---

## Fase 2 — Landing para tráfico frío

### T2.1 Hero con autoridad y concreción

**Files:**
- Modify: `app/curso-bachatango/copy.ts`, 6 idiomas:
  - `hero.h1` (español, opción A del informe, con el nombre confirmado en D7): «Aprende bachatango con los finalistas de Bailando con las Estrellas».
  - `hero.sub`: «{modules} módulos, {lessons} lecciones en vídeo, {duration}. Aprendes el rol de leader y el de follower, así que puedes empezar sin pareja.» — interpolado con los mismos datos que `learn.summary`.
  - Nueva sección `authority: { title, body }` con este texto en español (traducir el resto): «Luis y Sara bailan juntos desde 2002, cuando tenían 9 años. Luis ganó la primera edición de Bailando con las Estrellas (Telecinco, 2024) y Sara llegó a la final. Son campeones internacionales de bailes de salón. Han bailado junto a Il Divo, Gente de Zona y Diego Torres, y en galas como los Premios Platino. Sara es licenciada en Pedagogía de la Danza y Luis es Juez Nacional de Baile Deportivo. Desde 2020 dirigen su propia escuela.» Sustituye a `bio`.
  - `finalCta.title`: «Empieza hoy con la lección 1».
- Modify: `app/curso-bachatango/_components/LandingHero.tsx` (sub interpolado), `LandingSections.tsx` (bloque `authority` en lugar de `bio`).
- Modify: `metadata` de `app/curso-bachatango/page.tsx`: description y OG alineados con el nuevo titular.
- Test: `__tests__/components/landing-hero.test.tsx` (ampliar: el sub contiene los números del temario; si el temario es `null`, cae a un sub sin números).

### T2.2 Orden de secciones para un desconocido

Nuevo orden en `LandingSections.tsx`: autoridad → testimonios (si hay) → clase gratis → temario → método → oferta → FAQ → CTA final. El bloque `pain` se elimina (o se reduce a una línea dentro del hero; preguntar).

**Test:** snapshot de orden de los `h2` en `__tests__/components/landing-sections-order.test.tsx`.

### T2.3 Clase gratis: mejor lección, más arriba y medida

**Files:**
- BD (lo hace el usuario en el editor de lecciones, según D4): marcar `is_free` en la lección elegida y desmarcar «CUARTO BÁSICO - PASO MADRID CON VOLEA». `utils/courses/free-lesson.ts` ya coge la `is_free` de menor `order`; la caché se invalida por la etiqueta `landing-free-lesson`.
- Modify: `utils/analytics/tracked-paths.ts`: añadir la ruta virtual `'/curso-bachatango/clase-play'` a `TRACKED_PATHS` (no a `FUNNEL_STEPS`). Documentarla en el comentario como evento, no página.
- Modify: `app/curso-bachatango/_components/LandingFreeClass.tsx`: en el primer `play` del `MuxPlayer`, un beacon a `/api/landing-event` con esa ruta, igual que hace `components/LandingAnalytics.tsx` (sin cookies, una vez por carga).
- Modify: panel de `/admin/landing`: mostrar «Reproducciones de la clase gratis».
- Test: `__tests__/unit/tracked-paths.test.ts` (crearlo si no existe; la ruta nueva se acepta y no es paso del embudo), test de componente del beacon (una sola llamada aunque haya varios `play`).

### T2.4 Tráiler en el hero (bloqueada hasta tener el vídeo en Mux)

**Files:**
- Create: `supabase/2026_10_course_trailer.sql`: `alter table courses add column if not exists trailer_playback_id text;`
- Modify: `components/CourseForm.tsx`: campo «Playback ID del tráiler».
- Modify: `LandingHero.tsx`: si hay `trailer_playback_id`, vídeo en bucle, silenciado, `playsInline`, cargado **después** del evento `load`, con la portada actual como póster. La imagen sigue siendo el elemento LCP. Con `prefers-reduced-motion`, solo póster. Firma con `utils/mux/public-token.ts` como la clase gratis.
- Test: con y sin `trailer_playback_id`; con reduced motion.
- **Verificación:** Lighthouse móvil sobre la preview: el LCP no empeora respecto a `docs/lighthouse-2026-10-results.md`.

**Cierre de fase 2:** PR `feat/marketing-fase-2`. Tras desplegar (con OK del usuario), comparar semana contra semana en /admin/landing la tasa landing → formulario.

---

## Fase 3 — Captura de leads y secuencia de nutrición

### T3.1 Formulario «dos clases más por email»

**Files:**
- Create: `app/actions/free-classes.ts` — Server Action `requestFreeClasses(formData)`: email + casilla de consentimiento obligatoria («Quiero recibir las clases y emails de Luis y Sara. Puedo darme de baja cuando quiera.») + aviso de privacidad (`components/FormPrivacyNotice.tsx`). Reutiliza el upsert de `app/actions/newsletter.ts` con `consent_source: 'clase_gratis'`, `consent_ip`, `consent_at`. Rate limit igual que la newsletter. Registra `'/curso-bachatango/lead'` en `landing_events` (añadir la ruta virtual a `TRACKED_PATHS`).
- Create: `components/FreeClassesForm.tsx` (cliente, `useFormStatus`, mensajes de error mapeados como en `LandingCheckoutForm.tsx`).
- Modify: `LandingSections.tsx`: el formulario va justo debajo del vídeo de la clase gratis. Copy en `copy.ts` (6 idiomas): título «¿Te ha gustado? Te mandamos dos clases más», botón «Quiero las dos clases».
- Modify: `app/curso-bachatango/_components/StickyBuyBar.tsx`: segundo enlace discreto «Clase gratis por email» que hace scroll al formulario.
- Píxel: evento `Lead` con consentimiento de marketing, y por CAPI desde la acción reutilizando `utils/analytics/meta-capi.ts` (mismo `event_id` en los dos para deduplicar).
- Test: `__tests__/actions/free-classes.test.ts` (email inválido, sin consentimiento, rate limit, re-suscripción tras baja, evento registrado), test de componente.

### T3.2 Página privada con las clases extra

**Files:**
- Create: `utils/newsletter/free-classes-token.ts`: HMAC del email con `NEWSLETTER_UNSUBSCRIBE_SECRET` (mismo patrón y comparación en tiempo constante que `unsubscribe-token.ts`).
- Create: `utils/courses/extra-free-lessons.ts`: IDs de las dos lecciones de D4 como constantes; las lee con service role filtrando por esos IDs y `mux_status = 'ready'`.
- Create: `app/clase-gratis/mas/page.tsx`: `?e=<email>&t=<token>`; token inválido → `notFound()`. Pinta las dos lecciones con tokens públicos firmados por render (`utils/mux/public-token.ts`, nunca cacheados) y un CTA al curso. `robots: noindex`. Ruta sin cabecera (añadir a `utils/nav/chromeless-routes.ts`).
- Test: token válido, inválido, email manipulado; la página no se indexa.

### T3.3 Motor de secuencias de email

**Files:**
- Create: `supabase/2026_10_email_sends.sql`:
  ```sql
  create table if not exists public.email_sends (
    id uuid primary key default gen_random_uuid(),
    email text not null,
    sequence text not null,
    step int not null,
    sent_at timestamptz not null default now(),
    unique (email, sequence, step)
  );
  alter table public.email_sends enable row level security;
  -- sin policies: solo service role
  ```
- Create: `utils/email/sequences/types.ts` (paso = `{ step, delayDays, subject, preheader, titulo, parrafos, boton, condicion? }`), `utils/email/sequences/nutricion.ts` con los 6 emails de la tabla de abajo.
- Create: `app/api/cron/lifecycle-emails/route.ts`: mismo control de `CRON_SECRET` que `app/api/cron/purge-pending/route.ts`. Para cada suscriptor activo con `consent_source = 'clase_gratis'`: calcula el siguiente paso por días desde `consent_at`; sale de la secuencia si ya compró (`profiles.email` + `course_purchases`) o se dio de baja. Inserta en `email_sends` **antes** de enviar (el `unique` evita duplicados si el cron se solapa); si el envío falla, borra la fila y lo registra en Sentry. Tope de 200 envíos por ejecución.
- Modify: `vercel.json`: añadir `{ "path": "/api/cron/lifecycle-emails", "schedule": "0 8 * * *" }` (las 10:00 en Madrid en horario de verano) y actualizar `__tests__/config/vercel-region.test.ts`, que hoy fija la lista de crons.
- Reutiliza `renderEmail`, `renderTexto` y `enviar` de `utils/email/layout.ts` y el pie de baja de `newsletter-welcome.ts`.
- Test: `__tests__/api/lifecycle-emails.test.ts` (sin secreto → 401; no repite paso; respeta baja; sale al comprar; tope por ejecución).

**Secuencia de nutrición** (borradores; el texto final lo revisan Luis y Sara antes de activar el cron en producción):

| Paso | Día | Asunto | Trabajo |
|---|---|---|---|
| 1 | 0 (inmediato, desde la acción) | Tus dos clases de bachatango | Enlace a `/clase-gratis/mas` |
| 2 | 2 | El detalle que cambia tu abrazo | Un consejo que se pueda probar en 5 minutos |
| 3 | 4 | Bailamos juntos desde los 9 años | Historia y credenciales |
| 4 | 7 | `PENDIENTE: caso real de alumno` | Testimonio real; si no lo hay, se salta el paso |
| 5 | 10 | ¿Y si no tengo pareja? | La objeción más frecuente |
| 6 | 14 | El curso completo, 28 lecciones | Oferta (con el bonus de T4.2 si está vigente) |

**Cierre de fase 3:** probar el flujo completo en preview con un email real (formulario → email 1 → página de clases → baja → re-suscripción). PR `feat/marketing-fase-3`.

---

## Fase 4 — Después de la compra

### T4.1 Onboarding de compradores

**Files:**
- Create: `utils/email/sequences/onboarding.ts`, enganchado al mismo cron. Origen: `course_purchases` no demo + `lesson_progress`.

| Paso | Disparo | Asunto | Trabajo |
|---|---|---|---|
| 1 | 1 día tras la compra sin ninguna lección vista | Tu primera clase te espera | Botón a la lección 1 |
| 2 | Día 3 | El básico que lo cambia todo | Victoria rápida con música |
| 3 | Día 7 | Grábate 20 segundos | Enlace a la tarea de corrección (si existe) |
| 4 | 14 días sin progreso nuevo | Te quedaste en {lección} | Enlace directo a la siguiente lección |

Son emails de servicio: sin ofertas. Se detienen al completar el curso (`course_completions`).
- Test: cada disparo, y que no se envía a quien ya ha avanzado.

### T4.2 Bonus de corrección con fecha real (bloqueada por D5)

**Files:**
- Create: `supabase/2026_10_course_bonus.sql`: `courses.bonus_text text`, `courses.bonus_ends_at timestamptz`.
- Modify: `components/CourseForm.tsx` (dos campos), `utils/courses/offer.ts` (`bonus` en `CourseOffer`, solo si `bonus_ends_at` es futuro; seguir el patrón de columnas opcionales de `selectWithOfferColumns`), `LandingHero.tsx`, sección de oferta y `comprar/page.tsx` (mostrar el bonus y su fecha de fin; nada de cuenta atrás animada).
- Humano: crear la tarea en la lección del primer combo desde el editor (`createAssignment` en `app/courses/actions.ts` ya existe). La entrega acepta un enlace (YouTube oculto, Drive); subir ficheros queda fuera de este plan.
- Test: el bonus desaparece solo después de `bonus_ends_at` (con reloj falso).

### T4.3 Petición de testimonio al completar

**Files:**
- Create: `supabase/2026_10_testimonial_submissions.sql`: columnas `user_id uuid`, `video_url text`, `consent_at timestamptz`, `source text` en `landing_testimonials` (nullable; las filas entran con `is_published = false`).
- Create: formulario en `app/courses/[courseId]/certificado/page.tsx`: texto, ciudad, enlace de vídeo opcional y casilla «Autorizo a Luis y Sara a publicar mi opinión con mi nombre y ciudad». Server Action que inserta sin publicar.
- Modify: `components/admin/LandingContentForms.tsx`: lista de testimonios pendientes con botón «Publicar».
- Email: paso en el cron al detectar una fila nueva en `course_completions`, con enlace a esa página.
- Test: un alumno no puede publicar; solo el admin.

### T4.4 Aviso «sin devoluciones» (según D2)

**Files:** `app/curso-bachatango/comprar/page.tsx`. Sin garantía: quitar `<strong>` y acortar el párrafo, la casilla legal de `LandingCheckoutForm.tsx` no se toca. Con garantía: texto de la garantía en `copy.ts` y en `app/legal/terms`, y procedimiento de devolución documentado para el admin (Stripe → reembolso; `charge.refunded` ya revoca el acceso, ver `supabase/2026_07_fix1_refunds.sql`).

**Cierre de fase 4:** PR `feat/marketing-fase-4`.

---

## Fase 5 — Embudo completo en todos los idiomas

La landing está en 6 idiomas, pero `/curso-bachatango/comprar`, `LandingCheckoutForm.tsx`, `/gracias` y los emails están solo en español. 4 de los 8 compradores con país conocido son de Italia.

**Files:**
- Modify: `app/curso-bachatango/copy.ts` (nuevo bloque `checkout` y `thanks`), `comprar/page.tsx`, `LandingCheckoutForm.tsx` (incluidos `ERROR_MESSAGES` y el texto legal de la casilla de ejecución inmediata), `app/gracias/page.tsx`, `components/FreeClassesForm.tsx`.
- Emails: el idioma se guarda al suscribirse (`newsletter_subscribers.locale`, migración `supabase/2026_10_subscriber_locale.sql`) y al comprar; las secuencias tienen variantes por idioma, empezando por `it` y `en`.
- Stripe Checkout: pasar `locale` en `stripe.checkout.sessions.create`.
- Test: el formulario renderiza en los 6 idiomas; `i18n:check` en verde.

---

## Fase 6 — Contenido (opcional, cuando lo decida el usuario)

- Mover el blog (`app/blog/[slug]/page.tsx`, 3 artículos fijos de 2024) a Markdown en el repo o a una tabla, con fecha real, `Article` en JSON-LD y entrada automática en `app/sitemap.ts`.
- Plantilla de artículo con clip del curso incrustado y el formulario de T3.1 como CTA.
- Temas propuestos (hipótesis sin datos de volumen): qué es el bachatango y en qué se diferencia de la bachata sensual; pasos básicos, uno por artículo; musicalidad tango dentro de la bachata; practicar sin pareja.

---

## KPIs que debe poder leer el usuario al terminar

Todo desde `/admin/landing` salvo el coste por venta.

| KPI | Hoy (12–23 oct) | Objetivo a 4 semanas |
|---|---|---|
| Landing → formulario | 1,4 % | 4 % |
| Formulario → compra | 36 % | Mantener |
| Reproducciones de la clase gratis / visitas a la landing | Sin medir | Medir (T2.3) |
| Landing → email capturado | 0 % | 3 % |
| Email capturado → compra en 30 días | Sin datos | Medir |
| Compradores que empiezan en 7 días | 8 de 11 en octubre | 10 de 11 |
| Entregas de corrección | 0 | 1 de cada 3 compradores |
| Coste por venta (gasto de Meta / compras) | Sin datos | Menor que 119 € menos IVA y comisiones |
