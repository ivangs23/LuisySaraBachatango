# Fallos pendientes de la auditoría — Plan de implementación

> **Para agentes:** SUB-SKILL OBLIGATORIA: usar `superpowers:subagent-driven-development` (recomendado) o `superpowers:executing-plans` para ejecutar tarea a tarea. Los pasos usan casillas (`- [ ]`) para seguimiento.

**Objetivo:** Cerrar los seis defectos que quedaron abiertos tras los PRs #24, #25 y #26, verificados uno a uno contra el código el 2026-09-09.

**Arquitectura:** Seis arreglos independientes, sin dependencias entre sí. Se pueden ejecutar en cualquier orden y mergear por separado. Ninguno cambia comportamiento de negocio salvo el 2, que resucita una función que nunca funcionó.

**Stack:** Next.js 16 (App Router, Server Actions), Supabase (Postgres + Auth admin + Storage), Vitest.

**Spec:** este documento. Cada tarea cita la evidencia que la justifica.

## Restricciones globales

- **Ningún borrado destructivo sin verificación previa.** La tarea 4 borra ficheros de Storage; debe filtrar por prefijo de usuario y no puede tocar nada más.
- **Ningún test puede quedar certificando un bug.** La tarea 2 arregla un test que hoy afirma un payload que la base rechaza siempre.
- Comentarios de código en español, mensajes de commit en inglés.
- Las migraciones se aplican a mano y se documentan en `supabase/MIGRATIONS.md`. Este plan **no necesita ninguna**.

## Estructura de ficheros

| Fichero | Responsabilidad |
|---|---|
| `supabase/MIGRATIONS.md` | **Modificar.** Marcar aplicada la migración que ya está en producción. |
| `app/admin/alumnos/actions.ts` | **Modificar.** Columna y tipo correctos al notificar. |
| `__tests__/actions/admin-alumnos-actions.test.ts` | **Modificar.** Deja de certificar el payload roto. |
| `__tests__/utils/supabase-server-cookies.test.ts` | **Crear.** Fija que el cliente de servidor escribe cookies. |
| `utils/storage/purge-user-files.ts` | **Crear.** Borra los avatares de un usuario. |
| `app/profile/actions.ts` · `app/admin/alumnos/actions.ts` | **Modificar.** Llamarla al borrar la cuenta. |
| `utils/checkout/password-hash.ts` + su test + `package.json` | **Borrar.** Código muerto. |
| `app/curso-bachatango/comprar/comprar.module.css` | **Modificar.** Quitar `.pwToggle`. |
| `app/reset-password/actions.ts` | **Modificar.** Decir por qué expulsa al login. |

---

### Task 1: El repositorio dice que una migración está pendiente cuando ya está aplicada

**Ficheros:**
- Modificar: `supabase/MIGRATIONS.md:180-182`

**Evidencia:** el dueño aplicó el SQL el 2026-09-09 y está verificado en producción (`information_schema` devuelve `is_nullable = YES` para `pending_registrations.password_hash`). El documento sigue diciendo ⏳ Pendiente. Quien lo lea creerá que falta aplicarlo y puede ejecutarlo otra vez, o peor, dudar de si el código desplegado funciona.

- [ ] **Paso 1: Cambiar el estado**

En el encabezado de la sección, `⏳ PENDIENTE de aplicar` → `✅ APLICADA (2026-09-09)`. En la celda `Estado` de la tabla, `⏳ Pendiente` → `✅ Aplicada`.

- [ ] **Paso 2: Añadir la validación real**

Sustituir el párrafo que dice qué comprobar tras aplicar por lo que se comprobó de verdad, siguiendo el formato de las secciones vecinas:

```markdown
Verificado tras aplicar (2026-09-09):

| Comprobación | Resultado |
|---|---|
| `is_nullable` de `password_hash` | `YES` |
| Fila pendiente con `password_hash: null` | aceptada (probado contra producción) |
| Cuenta creada sin contraseña | no permite iniciar sesión hasta fijarla |
| Enlace del correo → `/auth/confirm` → fijar contraseña → entrar | cadena completa correcta |
```

- [ ] **Paso 3: Commit**

```bash
git add supabase/MIGRATIONS.md
git commit -m "docs(db): mark the passwordless migration as applied"
```

---

### Task 2: «Enviar notificación» a un alumno no puede funcionar

**Ficheros:**
- Modificar: `app/admin/alumnos/actions.ts:54-59` — la función es `sendNotification(userId, title, body)`, línea 47
- Test: `__tests__/actions/admin-alumnos-actions.test.ts:98`

**Evidencia:** el insert escribe `body`, y la columna se llama `message`. Además manda `type: 'admin_message'`, que la constraint `notifications_type_check` rechaza — los valores permitidos son `comment_like`, `comment_reply`, `post_comment`, `post_like`, `post_comment_like`, `post_comment_reply`, `assignment_graded` y `generic`. PostgREST falla primero por la columna desconocida, así que hay que arreglar las dos cosas. Falla el 100 % de las veces desde que existe.

El test de la línea 98 afirma exactamente ese payload roto, así que CI lleva meses en verde sobre un insert que nunca ha funcionado.

**Interfaces:**
- `NotificationBell.tsx:42` renderiza el tipo `generic` mostrando el `title` y el `message` de la fila. No hace falta tocarlo.

- [ ] **Paso 1: Escribir el test que falla**

```ts
it('escribe en la columna que existe y con un tipo que la constraint acepta', async () => {
  await sendNotification('u1', 'Hola', 'Mensaje')

  const fila = insertMock.mock.calls[0][0] as Record<string, unknown>
  expect(fila.message).toBe('Mensaje')
  expect(fila).not.toHaveProperty('body')
  // La constraint notifications_type_check no admite 'admin_message'.
  expect(['generic']).toContain(fila.type)
})
```

Sustituye al test de la línea 98, que afirma el payload roto. **No lo adaptes: bórralo.** Certifica un contrato que la base rechaza.

- [ ] **Paso 2: Ejecutar y verificar que falla**

```bash
npx vitest run __tests__/actions/admin-alumnos-actions.test.ts
```
Esperado: FALLA en `fila.message`.

- [ ] **Paso 3: Arreglar el insert**

```ts
  const { error } = await sb.from('notifications').insert({
    user_id: userId,
    title: t,
    // La columna es `message`, no `body`, y `admin_message` no está en
    // notifications_type_check: PostgREST rechazaba el insert por la columna
    // desconocida antes siquiera de llegar a la constraint. Esta función no ha
    // funcionado nunca, y su test afirmaba el payload roto.
    message: b,
    type: 'generic',
  })
```

- [ ] **Paso 4: Ejecutar los tests**

```bash
npx vitest run __tests__/actions/admin-alumnos-actions.test.ts
npx tsc --noEmit
```

- [ ] **Paso 5: Commit**

```bash
git add app/admin/alumnos/actions.ts __tests__/actions/admin-alumnos-actions.test.ts
git commit -m "fix(admin): make student notifications actually insert"
```

---

### Task 3: Nada protege la escritura de cookies de sesión

**Ficheros:**
- Crear: `__tests__/utils/supabase-server-cookies.test.ts`

**Evidencia:** `utils/supabase/server.ts:15-19` implementa `setAll`, que es lo que persiste la sesión. Los cinco ficheros de test que tocan ese módulo lo mockean entero, así que **ningún test ejercita esa función**. Si alguien la rompe —o una subida de `@supabase/ssr` (hoy `^0.8.0`, un caret sobre una 0.x) cambia el contrato— CI pasa en verde y en producción dejan de funcionar todos los inicios de sesión y todos los enlaces de correo, en silencio.

Este hueco se detectó durante la revisión de #22 y sigue abierto.

- [ ] **Paso 1: Escribir el test**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const store = { get: vi.fn(), getAll: vi.fn(() => []), set: vi.fn() }
vi.mock('next/headers', () => ({ cookies: async () => store }))

const createServerClientMock = vi.fn(() => ({}))
vi.mock('@supabase/ssr', () => ({
  createServerClient: (...a: unknown[]) => createServerClientMock(...a),
}))

import { createClient } from '@/utils/supabase/server'

beforeEach(() => { store.set.mockClear(); createServerClientMock.mockClear() })

/**
 * `setAll` es lo que persiste la sesión. Los cinco ficheros de test que tocan
 * este módulo lo mockean entero, así que nadie ejercitaba esta función: podía
 * quedarse vacía y CI seguiría en verde mientras en producción dejaban de
 * funcionar todos los logins y todos los enlaces de correo.
 */
describe('cliente de servidor de Supabase — escritura de cookies', () => {
  async function adaptador() {
    await createClient()
    const opciones = createServerClientMock.mock.calls[0][2] as {
      cookies: { getAll: () => unknown; setAll: (c: unknown[]) => void }
    }
    return opciones.cookies
  }

  it('setAll escribe CADA cookie en el store de Next', async () => {
    const cookies = await adaptador()
    cookies.setAll([
      { name: 'sb-a', value: '1', options: { path: '/' } },
      { name: 'sb-b', value: '2', options: { path: '/' } },
    ])

    expect(store.set).toHaveBeenCalledTimes(2)
    expect(store.set).toHaveBeenCalledWith('sb-a', '1', { path: '/' })
    expect(store.set).toHaveBeenCalledWith('sb-b', '2', { path: '/' })
  })

  it('getAll lee del store', async () => {
    store.getAll.mockReturnValueOnce([{ name: 'sb-a', value: '1' }])
    const cookies = await adaptador()
    expect(cookies.getAll()).toEqual([{ name: 'sb-a', value: '1' }])
  })

  /**
   * Llamado desde un Server Component, `cookieStore.set` lanza. Eso es
   * esperado y el middleware refresca la sesión: no puede propagarse y tumbar
   * el render.
   */
  it('no propaga el error cuando el store lanza', async () => {
    store.set.mockImplementationOnce(() => { throw new Error('Server Component') })
    const cookies = await adaptador()
    expect(() => cookies.setAll([{ name: 'sb-a', value: '1', options: {} }])).not.toThrow()
  })
})
```

- [ ] **Paso 2: Comprobar que el test detecta la rotura**

Vaciar temporalmente el cuerpo de `setAll` en `utils/supabase/server.ts` y ejecutar:

```bash
npx vitest run __tests__/utils/supabase-server-cookies.test.ts
```
Esperado: FALLA. **Restaurar el fichero** y volver a ejecutar: debe pasar. Un test que no falla al romper el código no protege nada.

- [ ] **Paso 3: Commit**

```bash
git add __tests__/utils/supabase-server-cookies.test.ts
git commit -m "test(auth): pin the cookie writer that every session depends on"
```

---

### Task 4: Borrar la cuenta deja los avatares en Storage

**Ficheros:**
- Crear: `utils/storage/purge-user-files.ts`
- Modificar: `app/profile/actions.ts` (borrado por el propio usuario)
- Modificar: `app/admin/alumnos/actions.ts` (borrado por un admin)
- Test: `__tests__/utils/purge-user-files.test.ts`

**Evidencia:** `grep -rn "\.remove("` sobre `app/`, `utils/` y `components/` no devuelve nada: el repositorio nunca borra un fichero de Storage. `app/profile/actions.ts:62` sube el avatar a `thumbnails/avatars/${user.id}-${uuid}.${ext}`, y cada guardado usa un UUID nuevo, así que **hasta reemplazar el avatar deja el anterior huérfano**. `deleteUser` borra la fila y las tablas cascadean; los objetos de Storage no.

`app/legal/privacy/page.tsx` promete la supresión de los datos. Un fichero con la cara de alguien en un bucket público, después de que haya pedido el borrado, es exactamente lo que esa promesa dice que no pasa.

**Interfaces:**
- Produce: `purgeUserFiles(admin: SupabaseClient, userId: string): Promise<void>`. Nunca lanza — un fallo de limpieza no puede impedir el borrado de la cuenta, que es el derecho que se está ejerciendo.

- [ ] **Paso 1: Escribir los tests que fallan**

```ts
it('borra solo los ficheros cuyo nombre empieza por el id del usuario', async () => {
  const admin = makeStorage({ 'avatars': [
    { name: 'u1-aaa.jpg' }, { name: 'u1-bbb.png' }, { name: 'u2-ccc.jpg' },
  ]})
  await purgeUserFiles(admin, 'u1')
  expect(admin.__removed).toEqual([['avatars/u1-aaa.jpg', 'avatars/u1-bbb.png']])
})

it('no llama a remove cuando el usuario no tiene ficheros', async () => {
  const admin = makeStorage({ 'avatars': [{ name: 'u2-ccc.jpg' }] })
  await purgeUserFiles(admin, 'u1')
  expect(admin.__removed).toEqual([])
})

it('un fallo al listar no lanza: el borrado de cuenta debe continuar', async () => {
  const admin = makeStorage({}, { listError: { message: 'boom' } })
  await expect(purgeUserFiles(admin, 'u1')).resolves.toBeUndefined()
})

it('un fallo al borrar no lanza', async () => {
  const admin = makeStorage({ 'avatars': [{ name: 'u1-aaa.jpg' }] }, { removeError: { message: 'boom' } })
  await expect(purgeUserFiles(admin, 'u1')).resolves.toBeUndefined()
})
```

- [ ] **Paso 2: Ejecutar y verificar que fallan**

```bash
npx vitest run __tests__/utils/purge-user-files.test.ts
```

- [ ] **Paso 3: Implementar**

```ts
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

/** Bucket y carpeta donde app/profile/actions.ts:62 sube los avatares. */
const BUCKET = 'thumbnails'
const CARPETA = 'avatars'

/**
 * Borra los ficheros que subió un usuario, antes de eliminar su cuenta.
 *
 * `deleteUser` borra la fila de auth y las tablas cascadean, pero los objetos
 * de Storage no: sin esto, la cara de alguien que ha pedido el borrado se
 * queda en un bucket PÚBLICO. La política de privacidad promete la supresión.
 *
 * El nombre del fichero empieza por el id del usuario
 * (`${user.id}-${uuid}.${ext}`), así que el filtro por prefijo recoge también
 * los avatares antiguos: cada guardado usa un UUID nuevo y deja huérfano el
 * anterior.
 *
 * Nunca lanza. Un fallo limpiando no puede impedir el borrado de la cuenta,
 * que es el derecho que la persona está ejerciendo.
 */
export async function purgeUserFiles(admin: SupabaseClient, userId: string): Promise<void> {
  try {
    const { data, error } = await admin.storage.from(BUCKET).list(CARPETA)
    if (error || !data) {
      if (error) console.error('[purgeUserFiles] list falló', error.message)
      return
    }

    const rutas = data
      .filter(f => f.name.startsWith(`${userId}-`))
      .map(f => `${CARPETA}/${f.name}`)
    if (rutas.length === 0) return

    const { error: removeError } = await admin.storage.from(BUCKET).remove(rutas)
    if (removeError) console.error('[purgeUserFiles] remove falló', removeError.message)
  } catch (e) {
    console.error('[purgeUserFiles] inesperado', e)
  }
}
```

- [ ] **Paso 4: Llamarla desde los dos caminos de borrado**

En `app/profile/actions.ts`, justo **antes** de `supabaseAdmin.auth.admin.deleteUser(userId)`:

```ts
  // Antes de borrar la cuenta: los objetos de Storage no cascadean.
  await purgeUserFiles(supabaseAdmin, userId)
```

Lo mismo en `app/admin/alumnos/actions.ts:94`, justo antes de `sb.auth.admin.deleteUser(userId)` — es la función `deleteUser(userId, confirmPhrase, targetEmail)` que arranca en la línea 64.

- [ ] **Paso 5: Ejecutar los tests**

```bash
npx vitest run __tests__/utils/purge-user-files.test.ts
npm run test
npx tsc --noEmit
```

- [ ] **Paso 6: Commit**

```bash
git add utils/storage/purge-user-files.ts __tests__/utils/purge-user-files.test.ts app/profile/actions.ts app/admin/alumnos/actions.ts
git commit -m "fix(privacy): delete a user's uploaded files when the account goes"
```

---

### Task 5: Código muerto del formulario antiguo

**Ficheros:**
- Borrar: `utils/checkout/password-hash.ts`
- Borrar: `__tests__/utils/password-hash.test.ts`
- Modificar: `package.json` (quitar `bcryptjs`)
- Modificar: `app/curso-bachatango/comprar/comprar.module.css` (quitar `.pwToggle`)

**Evidencia:** tras #26, `hashPassword` no tiene ningún llamante — comprobado con grep sobre `app/`, `utils/`, `components/` y `__tests__/`: solo aparece en su propio fichero y en su propio test. `provision-registration.ts` lee la **columna** `pending.password_hash`, nunca la función. `bcryptjs` queda como dependencia sin uso.

`.pwToggle` en el CSS module era del botón de ver/ocultar contraseña, que se borró con el formulario.

**Cuidado:** las tres cosas van juntas o ninguna. Borrar el módulo y dejar la dependencia, o al revés, deja el repositorio en un estado peor que ahora.

- [ ] **Paso 1: Confirmar que sigue muerto**

```bash
grep -rn "password-hash\|hashPassword" --include="*.ts" --include="*.tsx" app/ utils/ components/ __tests__/
grep -rn "bcrypt" --include="*.ts" --include="*.tsx" app/ utils/ components/ __tests__/
grep -n "pwToggle" app/curso-bachatango/comprar/ -r
```
Esperado: el primero solo devuelve el módulo y su test; el segundo, nada; el tercero, solo el CSS. **Si algo más aparece, parar y no borrar nada.**

- [ ] **Paso 2: Borrar**

```bash
git rm utils/checkout/password-hash.ts __tests__/utils/password-hash.test.ts
npm uninstall bcryptjs
```

Quitar a mano el bloque `.pwToggle` y `.pwToggle:hover` del CSS module.

- [ ] **Paso 3: Verificar que no se rompió nada**

```bash
npm run test && npx tsc --noEmit && npm run build
```
Esperado: todo en verde. El build es importante: `bcryptjs` podría estar en un import transitivo que el typecheck no ve.

- [ ] **Paso 4: Commit**

```bash
git add -A
git commit -m "chore: drop the password hashing the checkout no longer does"
```

---

### Task 6: `/reset-password` expulsa al login sin decir por qué

**Ficheros:**
- Modificar: `app/reset-password/actions.ts:16`
- Test: `__tests__/actions/reset-password.test.ts`

**Evidencia:** la página se renderiza a cualquiera —no está en `AUTH_REQUIRED_PREFIXES`—, así que quien abre un enlace caducado ve el formulario, escribe una contraseña nueva, pulsa guardar y aterriza en `/login` **sin ningún mensaje**. Parece que la web se ha tragado su contraseña. La causa real es que la sesión no llegó, y ya existe un mecanismo de mensajes en `/login` que se está desaprovechando.

- [ ] **Paso 1: Escribir el test que falla**

```ts
it('sin sesión manda al login CON un motivo, no en silencio', async () => {
  getUserMock.mockResolvedValueOnce({ data: { user: null } })
  const url = await updatePassword(new FormData()).catch(getRedirectUrl)
  expect(url).toContain('/login')
  expect(url).toContain('error=')
})
```

- [ ] **Paso 2: Ejecutar y verificar que falla**

```bash
npx vitest run __tests__/actions/reset-password.test.ts
```

- [ ] **Paso 3: Implementar**

```ts
  if (!user) {
    // El enlace caducó o ya se usó. Sin motivo, la persona ve un login pelado
    // después de escribir una contraseña y cree que se ha perdido.
    redirect('/login?error=session_expired')
  }
```

Comprobar que `/login` sabe pintar ese código: si `session_expired` no está en el diccionario de errores, cae en `t.errors.unknown`, que ya dice algo genérico. Añadirlo a los seis idiomas es mejor; si se añade, hay que hacerlo en los seis (`Dictionary = typeof es` lo obliga).

- [ ] **Paso 4: Ejecutar los tests**

```bash
npx vitest run __tests__/actions/reset-password.test.ts
npx tsc --noEmit
```

- [ ] **Paso 5: Commit**

```bash
git add app/reset-password/actions.ts __tests__/actions/reset-password.test.ts utils/i18n/dictionaries/
git commit -m "fix(auth): say why an expired reset link sends you back to login"
```

---

## Qué NO entra en este plan, y por qué

**Los rastreadores de enlaces corporativos.** Ahora que el enlace del correo verifica con un `GET`, un escáner tipo Outlook Safe Links puede **gastar el token** antes de que la persona lo pulse, y esta se encuentra la pantalla de error sin haber hecho nada. Es una clase de fallo nueva, real, y sin arreglo barato: la defensa estándar es una pantalla intermedia que exige un clic, lo que añade fricción a todo el mundo para protegerse de una minoría. Tu público es Gmail de consumo, donde esto casi no pasa. **Merece la pena saberlo antes de que llegue el primer aviso, no arreglarlo hoy.**

**Alertar los 500 reintentables del webhook.** `app/api/webhooks/stripe/route.ts` devuelve 500 con solo un `console.error` para los motivos que Stripe reintenta. Si Stripe agota los reintentos **y** el comprador nunca abre `/gracias`, nadie se entera. El autoarreglo de `/gracias` cubre el caso realista, así que es menos urgente que lo que ya se arregló.

**El píxel de Meta.** Es configuración, no código: la variable existe y está cableada. Va aparte.
