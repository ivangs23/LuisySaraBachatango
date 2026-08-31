# Proyecto de Supabase para desarrollo — diseño

**Fecha:** 2026-08-31
**Estado:** aprobado en conversación, pendiente de plan de implementación

## Problema

Las tres variables de Supabase están dadas de alta en Vercel para **Development,
Preview y Production con el mismo valor**. Es decir: `npm run dev`, la suite E2E
y cada despliegue de Preview escriben en la base de datos **real**.

Ya se ha notado. La suite E2E metió 23 filas de analítica en producción la
primera vez que se ejecutó; se taponó gateando `/api/landing-event` con
`isDemoMode()`, pero eso arregla un síntoma. Lo que sigue escribiendo en real
desde local y preview:

- **Usuarios** — cada alta de prueba crea una fila en `auth.users` (hoy hay 13)
- **Compras** — `isDemoMode()` simula el cobro, pero la compra se **guarda**
- **Invitaciones y registros pendientes**

El propio código lo avisa (`utils/demo/mode.ts`): *"en modo demo se escriben
datos REALES (usuarios, compras, invitaciones) en la BD Supabase a la que apunte
el entorno"*.

## Alcance

```
Production  → BD real          (intacta)
Preview     → BD desarrollo
Local       → BD desarrollo
```

Fuera, decidido explícitamente:

- **CI.** Sigue con credenciales falsas y los 15 tests E2E autenticados siguen
  saltándose. Incluirlo obligaría a guardar secretos en GitHub y a sembrar
  usuarios en cada ejecución.
- **Otra cuenta de Mux o de Stripe.** No hacen falta; ver más abajo.

## Por qué no se replican los ficheros del repo

`supabase/MIGRATIONS.md` avisa de que un replay léxico de los 69 ficheros
**reabre agujeros ya cerrados**: `rbac_setup.sql` recrea
`Lessons/Courses viewable by everyone using (true)`, deshaciendo el paywall, y
`full_setup.sql` recrea `handle_new_user` sin `search_path` fijado.

Una base de datos de desarrollo construida así no sería una copia de producción:
sería una copia con el paywall abierto. Probarías contra reglas de seguridad
distintas a las reales sin enterarte, que es peor que no tener entorno de
desarrollo.

Tamaño de lo que hay que reproducir, medido en producción el 2026-08-31:

| | |
|---|---|
| Tablas en `public` | 22 |
| Policies RLS | 64 |
| Funciones | 7 |

64 policies es demasiado para reconstruirlas a mano sin equivocarse. De ahí el
volcado.

## Por qué no una rama de Supabase

Clonan producción automáticamente, pero cuestan **0,01344 $/hora ≈ 9,70 $/mes**
y están diseñadas para ser efímeras: se crean y se destruyen con una PR. No
encajan para una base de datos de desarrollo estable.

Crear el proyecto, en cambio, cuesta **0 €/mes** (comprobado en la organización
`svkqjbfowfpmbxspmdgr`).

## Esquema: volcado de producción

```bash
supabase db dump --db-url '<cadena de conexión de producción>' \
  -f supabase/schema_canonical.sql
```

Lo ejecuta el propietario: pide la contraseña de la base de datos, que no está
en el repo ni en `.env.local`.

**Beneficio que va más allá de esto:** el repo pasa a poder reconstruir
producción. Hoy no puede, y eso afecta también a recuperación ante desastres y
a dar de alta a alguien nuevo. `MIGRATIONS.md` ya lo recomendaba desde julio.

Solo esquema, sin datos: los 13 usuarios reales y sus compras no se copian.

## Tres condicionantes del código

**`COURSE_ID` está hardcodeado** en `utils/courses/landing-course.ts`
(`f89a576f-4a77-40f7-93e9-23e6c820ee92`). La base de datos de desarrollo
necesita un curso con **ese UUID exacto**, o `/curso-bachatango` devolverá 404
en todos los Preview — el mismo fallo que costó semanas en julio, esta vez
autoinfligido.

**Mux se comparte.** `MUX_TOKEN_ID` es el mismo en los tres entornos, así que las
lecciones sembradas pueden reutilizar los `mux_playback_id` reales y los vídeos
se reproducen. No hace falta otra cuenta.

**Stripe no interviene.** `isDemoMode()` ya devuelve true en preview y local, así
que el cobro está simulado. No hacen falta claves de test.

## Datos sembrados

Encima del esquema vacío:

| Qué | Por qué |
|---|---|
| El curso de la landing, con su UUID exacto y `is_published = true` | Sin él, `/curso-bachatango` y la home rompen |
| Sus lecciones, con `mux_playback_id` reales y una `is_free` | `/clase-gratis` y el temario necesitan datos |
| Contenido de landing (cifras, testimonios, FAQ) | El generador ya existe: `scripts/generate-landing-seed.ts` |
| Un usuario admin | Para probar el panel |

El seed se genera con un script, no se transcribe: mismo criterio que la PR #5.

## El riesgo principal

La clave de servicio del proyecto nuevo es **distinta** a la de producción. Si se
cruzan al configurar Vercel, Preview escribiría en la base de datos real sin
avisar de nada — exactamente lo que este trabajo viene a evitar, pero con la
falsa sensación de estar resuelto.

Por eso el plan incluye una comprobación explícita **después** del cambio: un
script que, apuntando a las variables de Preview, escriba una fila marcada y
confirme que aparece en desarrollo y **no** en producción.

## Errores

- **Volcado incompleto o corrupto:** se detecta al aplicarlo, antes de tocar
  ninguna variable. Producción no se toca en ningún paso.
- **Falta el curso sembrado:** `/curso-bachatango` da 404 en Preview. La
  comprobación posterior lo cubre.
- **Reversión:** volver a poner los valores de producción en Preview y
  Development restaura el estado actual. No hay migración de datos que deshacer.

## Orden de trabajo

1. El propietario genera `schema_canonical.sql` desde producción.
2. Se crea el proyecto de desarrollo (0 €).
3. Se aplica el esquema y se siembra.
4. Se comprueba que la base de datos de desarrollo responde y tiene el curso.
5. **Solo entonces** se cambian las variables de Preview y Development.
6. Se verifica que Preview escribe en desarrollo y no en producción.

Producción no se toca en ningún punto.
