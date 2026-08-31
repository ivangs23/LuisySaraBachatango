# Editar el contenido de la landing desde el panel — diseño

**Fecha:** 2026-08-13
**Estado:** aprobado en conversación, pendiente de plan de implementación

## Problema

Cambiar una cifra del hero, un testimonio o una pregunta frecuente exige hoy
editar TypeScript, abrir un PR y esperar un despliegue. Son justo las cosas que
más cambian y las que menos necesitan un programador.

Hay además un fallo concreto que esto cierra: las cifras `+25 / +500 / +30`
están **copiadas a mano en tres ficheros** —`components/Hero.tsx`,
`app/sobre-nosotros/AboutClient.tsx` y `app/opengraph-image.tsx`— y ya se
desincronizaron: el hero anunciaba 50 países mientras «Sobre nosotros» decía 30.
Se unificó a mano en agosto de 2026, pero nada impide que vuelva a pasar.

## Alcance

Editable desde el panel:

- **Cifras del hero** — el valor (`+25`), no la etiqueta.
- **Testimonios** — nombre, texto, estrellas, orden, publicado. Solo texto: hoy
  no hay fotos de alumnos, y añadir subida de imágenes sería construir un
  formulario para material que no existe. Añadirla después es una columna
  nullable y un input, sin rehacer nada.
- **Preguntas frecuentes** — pregunta, respuesta, orden, publicado.

Fuera:

- **Copy estructural** (titulares, textos de sección, todo `curso-bachatango/copy.ts`).
  Cambia poco y ahí el chequeo de tipos vale más que la autonomía. Ver «El coste
  que se asume».
- **Fotos en testimonios.**
- **Traducir el copy hardcodeado en JSX** (`CONOCE A TUS PROFES`, `EL MÉTODO`,
  `VOCES DE LA PISTA`). Es trabajo de la fase de i18n del roadmap.

## El coste que se asume

Hoy `Dictionary = typeof es` (`utils/i18n/types.ts`) hace que **TypeScript
obligue** a traducir cada clave nueva a los 6 idiomas: si falta una, no compila.
Esa red saltó media docena de veces mientras se construía la landing.

En cuanto un texto vive en la base de datos, esa garantía desaparece: una
traducción que falte solo se descubre mirando la web.

Por eso el alcance se limita a lo que cambia a menudo. El copy estructural se
queda donde el compilador puede seguir vigilándolo.

Mitigación parcial: la columna `es` es obligatoria por constraint, así que
siempre habrá al menos español, y el resto cae a español. Nunca hay hueco vacío.

## Datos

Tres tablas, cada una con una responsabilidad.

```sql
landing_stats
  key           text primary key   -- 'years' | 'students' | 'countries'
  value         text not null      -- '+25'
  position      int  not null

landing_testimonials
  id            uuid primary key
  name          text not null
  quote         jsonb not null     -- { es, en, fr, de, it, ja }
  stars         int  not null      -- 1..5
  position      int  not null
  is_published  boolean not null default true

landing_faq
  id            uuid primary key
  question      jsonb not null
  answer        jsonb not null
  position      int  not null
  is_published  boolean not null default true
```

`position` y no `order`: `order` es palabra reservada en SQL y `lessons` ya
obliga a escribirla entrecomillada.

Los `jsonb` llevan constraint de español no vacío, copiando `events`:

```sql
check (length(trim(coalesce(quote->>'es', ''))) > 0)
```

Lectura localizada con el mismo helper que `components/EventsClient.tsx:51`:
el idioma pedido si existe y no está vacío, español si no.

RLS: lectura pública de las filas publicadas; escritura solo admin vía
`public.is_admin()` — **no** leyendo `profiles.role` directamente, que es el
patrón que dejó el embudo en 404 durante semanas (ver `supabase/MIGRATIONS.md`).

### El conjunto de cifras es fijo

`landing_stats` tiene exactamente tres filas: `years`, `students`, `countries`.
El panel deja **editar sus valores, no añadir ni borrar**. Una cuarta cifra
necesitaría su etiqueta traducida a seis idiomas en los diccionarios, o sea
código: fingir que se puede añadir desde el panel dejaría una cifra sin nombre.

### Por qué las etiquetas de las cifras no se mueven

`landing_stats` guarda el valor (`+25`), pero la etiqueta (`AÑOS BAILANDO`)
sigue en los diccionarios. El número cambia; la etiqueta no. Así lo que se edita
a menudo es editable, y lo que casi nunca cambia conserva el chequeo de tipos y
sus seis traducciones.

## Que la landing nunca se rompa

Es el riesgo principal: si una tabla queda vacía o la consulta falla, la landing
no puede quedarse sin testimonios ni sin FAQ.

Dos defensas independientes:

1. **La migración siembra las tablas con los valores actuales**, extraídos de los
   diccionarios y de `Hero.tsx`. El día del despliegue la web se ve exactamente
   igual que antes. El seed se **genera** desde los diccionarios, no se
   transcribe a mano: transcribir 3 testimonios × 6 idiomas invita a erratas.
2. **Los lectores caen a los valores de código** si la consulta falla o no
   devuelve filas. Un fallo de base de datos degrada el contenido, nunca tumba
   la página.

## Lectura en la web pública

Un módulo de servidor, `utils/landing/content.ts`, expone:

```ts
getLandingStats(): Promise<LandingStat[]>
getTestimonials(locale): Promise<Testimonial[]>
getFaqItems(locale): Promise<FaqItem[]>
```

Consumidores: `Hero`, `AboutClient`, `opengraph-image`, `Testimonials`, `FAQ` y
el `FAQPage` JSON-LD de `app/page.tsx` — que pasa a alimentarse de la misma
fuente que el acordeón, así que no pueden divergir.

`Testimonials` y `FAQ` son hoy componentes de cliente que leen `useLanguage()`.
Pasan a recibir su contenido por props desde `app/page.tsx`, que ya es Server
Component. Menos JavaScript al cliente, de paso.

**La OG image también lee de la tabla.** Es la tercera copia de las cifras y la
razón por la que se desincronizaron. Se genera bajo demanda y se cachea, así que
el coste es una consulta por regeneración.

## Panel

`/admin/landing` ya existe con las estadísticas. Se añade `/admin/landing/contenido`
con tres bloques y navegación entre ambas.

Formularios siguiendo `app/events/`:

- Server Actions con `requireAdmin()` al principio.
- El parseo del formulario en `_lib/parse.ts`, porque un módulo `'use server'`
  no puede exportar helpers síncronos.
- Al guardar: `revalidatePath('/')` y `revalidatePath('/admin/landing/contenido')`,
  para que el cambio salga al momento en lugar de esperar los 5 minutos del ISR.

Los seis idiomas se editan en pestañas dentro de cada campo de texto. Solo
español es obligatorio; el resto puede quedarse vacío y caerá a español.

## Errores

- **Consulta fallida en la web pública:** se usan los valores de código. La
  página se ve, con contenido antiguo.
- **Guardado fallido en el panel:** el formulario muestra el error y no pierde lo
  escrito.
- **Sin filas publicadas:** la sección no se renderiza, igual que hoy hace la
  oferta cuando no hay curso. Nunca un bloque vacío con el título colgando.

## Pruebas

- Helper de lectura localizada: devuelve el idioma pedido; cae a español si falta
  o está vacío; nunca devuelve `undefined`.
- Lectores: caen a los valores de código si la consulta falla o no hay filas;
  filtran los no publicados; respetan `position`.
- Acciones de admin: rechazan sin sesión de admin; exigen español no vacío;
  validan `stars` entre 1 y 5; revalidan las rutas al guardar.
- Componentes: `Testimonials` y `FAQ` renderizan lo que reciben por props.
- Que las cifras salgan de una sola fuente: un test comprueba que `Hero`,
  `AboutClient` y la OG image muestran el mismo valor — el fallo que originó
  esto no puede repetirse en silencio.

## Cuando llegue el routing por idioma

Estas tablas ya estarán listas: el `jsonb` por locale es exactamente lo que esa
fase necesita. Lo único que cambiará es de dónde sale el `locale` con el que se
llama a los lectores — hoy de la cookie, entonces de la URL.
