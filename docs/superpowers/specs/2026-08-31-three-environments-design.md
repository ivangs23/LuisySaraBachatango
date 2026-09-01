# Tres entornos: local en Docker, `dev` en la nube, producción — diseño

**Fecha:** 2026-08-31
**Estado:** aprobado en conversación, pendiente de plan de implementación

Sustituye al diseño anterior de «proyecto de Supabase para desarrollo», que
contemplaba solo dos entornos. La conversación lo amplió a tres y añadió Docker.

## Problema

Las tres variables de Supabase están dadas de alta en Vercel para **Development,
Preview y Production con el mismo valor**: `npm run dev`, la suite E2E y cada
despliegue de Preview escriben en la base de datos **real**.

Ya se ha notado. La suite E2E metió 23 filas de analítica en producción la
primera vez que se ejecutó; se taponó gateando `/api/landing-event` con
`isDemoMode()`, pero eso arregla un síntoma. Lo que sigue escribiendo en real
desde local y preview: usuarios (`auth.users` tiene 13), compras —`isDemoMode()`
simula el cobro pero la compra **se guarda**— e invitaciones.

El propio código lo avisa (`utils/demo/mode.ts`): *"en modo demo se escriben
datos REALES (usuarios, compras, invitaciones) en la BD Supabase a la que apunte
el entorno"*.

Hay además un problema de credenciales: **`.env.local` contiene hoy la clave de
servicio de producción**, que salta la RLS por completo, para el trabajo del día
a día.

## Cómo queda

```
local   → Docker            supabase start
dev     → Vercel + BD nube  proyecto uhcjzozliqjzxviuxoxa
main    → producción        proyecto jytokoxbsykoyifzbjkd

flujo:  feature → dev → main
```

| Entorno | Base de datos | Pagos | Analítica |
|---|---|---|---|
| local | Docker | simulados (`isDemoMode`) | no se registra |
| `dev` y ramas de Preview | nube dev | simulados | no se registra |
| producción | real | Stripe real | se registra |

**Todas las ramas de Preview** apuntan a la base de datos de desarrollo, no solo
`dev`: que una rama de feature escribiera en producción sería el mismo problema
con otro nombre.

## El beneficio que no se buscaba

Con Docker, `.env.local` pasa a contener las claves del stack local, que son
**públicas y estándar** en toda instalación de Supabase. Deja de haber una
credencial de producción en el disco para el trabajo diario.

Eso vale más que el aislamiento de datos que motivó todo esto.

## Esquema

`supabase/migrations/20260831000000_canonical_schema.sql` — un `supabase db dump`
de producción: 22 tablas, 64 policies, 7 funciones, sin datos.

**Va versionado.** `supabase start` aplica `supabase/migrations/*.sql` sola, así
que si no estuviera en el repo nadie podría levantar el entorno local desde un
clon limpio.

### Por qué no se replican los 69 ficheros sueltos

`MIGRATIONS.md` avisa de que un replay léxico **reabre agujeros ya cerrados**:
`rbac_setup.sql` recrea `Lessons/Courses viewable by everyone using (true)`,
deshaciendo el paywall, y `full_setup.sql` recrea `handle_new_user` sin
`search_path` fijado.

Un entorno construido así probaría contra reglas de seguridad distintas a las
reales sin que nadie se enterase — peor que no tener entorno.

Comprobado sobre el volcado: cero apariciones de
`"Lessons are viewable by everyone"`, y sí está la policy de `lessons` con
`is_admin()`.

## Datos sembrados

`supabase/seed.sql`, que `supabase start` aplica sola:

| Qué | Por qué |
|---|---|
| El curso de la landing, **con su UUID exacto** y `is_published = true` | `COURSE_ID` está hardcodeado en `utils/courses/landing-course.ts`. Sin esa fila, `/curso-bachatango` da 404 y la home pierde el bloque de oferta |
| Sus lecciones, con `mux_playback_id` reales y una `is_free` | `/clase-gratis` y el temario necesitan datos; el token de Mux es el mismo en los tres entornos, así que los vídeos se ven |
| Contenido de landing (cifras, testimonios, FAQ) | Ya existe generador: `scripts/generate-landing-seed.ts` |
| Un usuario admin | Para probar el panel sin depender de producción |

El seed se genera con un script, no se transcribe.

## Servicios que siguen en la nube

Docker levanta Postgres, Auth y Storage. **Mux, Resend y Stripe no.**

- **Mux** — mismo `MUX_TOKEN_ID` en los tres entornos, así que los vídeos
  sembrados se reproducen en local.
- **Stripe** — `isDemoMode()` devuelve true fuera de producción y el cobro está
  simulado. No hacen falta claves de test.
- **Resend** — sin `RESEND_API_KEY` los emails son no-op, que es lo deseable en
  local.

## Coste

- Proyecto de desarrollo en la nube: **0 €/mes** (comprobado en la organización).
- Docker local: **0 €**, pero descarga 2-3 GB de imágenes la primera vez y
  requiere el demonio corriendo.
- Se descartó **rama de Supabase** (0,01344 $/hora ≈ 9,70 $/mes): están pensadas
  para ser efímeras, no para un entorno estable.

## El riesgo principal

La clave de servicio del proyecto de desarrollo es **distinta** a la de
producción. Si se cruzan al configurar Vercel, Preview escribiría en la base de
datos real sin avisar — exactamente lo que este trabajo viene a evitar, pero con
la falsa sensación de estar resuelto.

Por eso el plan incluye una comprobación **posterior** al cambio: escribir una
fila marcada desde un despliegue de Preview y confirmar que aparece en
desarrollo y **no** en producción.

## Flujo de trabajo

`feature → dev → main`. Cambia respecto a las 4 PRs anteriores, que iban
directas a `main`.

Coste asumido: **dos merges por cambio**. A cambio, nada llega a producción sin
haberse visto antes en un despliegue real con una base de datos que se puede
romper sin consecuencias.

Los hotfixes pueden ir directos a `main` y luego retro-mergearse a `dev`, para no
quedar bloqueados por la cola de integración.

## Fuera de alcance

- **CI.** Sigue con credenciales falsas y los 15 tests E2E autenticados siguen
  saltándose. Incluirlo obligaría a guardar secretos en GitHub.
- **Protección de ramas en GitHub.** Es configuración del repositorio, no código.
- **Migrar los 69 ficheros históricos.** Se quedan como registro.

## Errores y reversión

- **Volcado incompleto:** se detecta al aplicarlo, antes de tocar ninguna
  variable. Producción no se toca en ningún paso.
- **Falta el curso sembrado:** `/curso-bachatango` da 404 en `dev`. La
  comprobación posterior lo cubre.
- **Reversión:** volver a poner los valores de producción en Preview y
  Development restaura el estado actual. No hay migración de datos que deshacer.

## Orden

1. `supabase init` y configuración de Docker.
2. `seed.sql` generado.
3. Levantar local y comprobar que la app funciona entera contra Docker.
4. Aplicar el esquema al proyecto de desarrollo en la nube.
5. **Solo entonces** cambiar las variables de Preview y Development en Vercel.
6. Crear la rama `dev` y verificar que su despliegue escribe en desarrollo.

Producción no se toca en ningún punto.
