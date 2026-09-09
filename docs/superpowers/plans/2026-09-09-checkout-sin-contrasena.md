# Checkout sin contraseña — Plan de implementación

> **Para agentes:** SUB-SKILL OBLIGATORIA: usar `superpowers:subagent-driven-development` (recomendado) o `superpowers:executing-plans` para ejecutar tarea a tarea. Los pasos usan casillas (`- [ ]`) para seguimiento.

**Objetivo:** Reducir el formulario de compra de la landing de once campos obligatorios a dos campos y tres casillas, para recuperar parte de las 54 personas que en 10 días llegaron al formulario y no compraron.

**Arquitectura:** La compra deja de crear la cuenta con contraseña. Se recoge email, nombre y los consentimientos legales; Stripe cobra; y el aprovisionamiento crea la cuenta sin contraseña y manda **un solo correo** —el de confirmación de compra que ya existe— con un botón para fijarla. El camino sin contraseña ya está en producción como recuperación de compras huérfanas (`utils/checkout/provision-registration.ts:56-61`); esto lo asciende de plan B a camino principal.

**Stack:** Next.js 16 (App Router, Server Actions), Supabase (Postgres + Auth admin API), Stripe Checkout, Resend, Vitest.

**Spec:** este documento. Los datos que lo justifican están en la sección siguiente.

---

## Datos que lo justifican

Medido en producción el 2026-09-09 sobre `landing_events` (analítica desde 2026-08-31):

| Paso | Únicos | Conversión |
|---|---|---|
| `/curso-bachatango` | 418 | — |
| `/curso-bachatango/comprar` | 62 | 14,8 % |
| `/gracias` | 8 | **12,9 %** |

`pending_registrations` tiene **0 filas**. Esa fila se escribe al enviar el formulario, antes de ir a Stripe, y dura 30 días. Cero filas significa que la pérdida ocurre **en el formulario**, no en Stripe.

Seis de los once campos obligatorios se escriben y **no se leen en ninguna parte** de la aplicación: `country`, `city`, `postal_code`, `date_of_birth`, `dance_level`, `phone`. Comprobado con grep sobre `app/`, `utils/` y `components/`: solo aparecen en la lista de censura de `utils/sentry/scrub.ts`.

Todo el tráfico es orgánico, desde historias en redes. No hay coste de adquisición, así que cada punto de conversión recuperado es margen íntegro.

## Restricciones globales

- **Edad mínima 16 años.** Las condiciones lo exigen (`app/legal/terms/page.tsx:40`). La fecha de nacimiento desaparece, pero la comprobación se mantiene como casilla obligatoria.
- **Consentimientos legales intactos.** `terms_version`, `terms_accepted_at` y `digital_execution_consent_at` se siguen sellando ANTES del pago y copiando al perfil. El art. 103.m RDL 1/2007 exige acto específico y separado para la ejecución inmediata: **sigue siendo casilla propia**, nunca fundida con la de condiciones.
- **Las columnas de la base NO se borran.** Solo dejan de pedirse. Borrar columnas es irreversible y estos datos podrían quererse más adelante desde el perfil.
- **Ninguna compra puede quedarse sin acceso.** Cualquier rama que falle usa `alertaCritica`, que es el patrón ya establecido en `utils/alerta.ts`.
- **Migraciones a mano.** Los `.sql` se aplican en el editor de Supabase y se documentan en `supabase/MIGRATIONS.md` (ver ese fichero). El SQL se aplica **antes** de desplegar el código.
- Comentarios de código en español, mensajes de commit en inglés — convención del repositorio.

## Estructura de ficheros

| Fichero | Responsabilidad |
|---|---|
| `supabase/2026_09_pending_password_optional.sql` | **Crear.** `password_hash` pasa a nullable. |
| `utils/checkout/registration-validation.ts` | **Modificar.** Quita contraseña y los seis campos; añade `isAdult`. |
| `components/LandingCheckoutForm.tsx` | **Modificar.** Dos campos y tres casillas. |
| `app/curso-bachatango/comprar/page.tsx` | **Modificar.** La cookie flash solo re-rellena nombre y correo. |
| `app/curso-bachatango/comprar/actions.ts` | **Modificar.** Validar antes de limitar; sin hash; registrar el envío. |
| `utils/checkout/provision-registration.ts` | **Modificar.** Rama sin contraseña + genera enlace para fijarla. |
| `utils/email/purchase-confirmation.ts` | **Modificar.** Botón «Crea tu contraseña». |
| `utils/analytics/tracked-paths.ts` | **Modificar.** Nuevo paso `/curso-bachatango/comprar/enviado`. |

---

### Tarea 1: Hacer `password_hash` opcional

**Ficheros:**
- Crear: `supabase/2026_09_pending_password_optional.sql`
- Modificar: `supabase/MIGRATIONS.md`

**Interfaces:**
- Produce: la columna `pending_registrations.password_hash` acepta `NULL`. Todas las tareas siguientes dependen de ello.

- [ ] **Paso 1: Escribir la migración**

```sql
-- ============================================================================
-- La contraseña deja de pedirse en el formulario de compra.
--
-- Once campos obligatorios antes de pagar dejaban fuera a 54 de cada 62
-- personas que llegaban al formulario (medido 2026-08-31 → 2026-09-09). La
-- cuenta pasa a crearse sin contraseña y el alumno la fija desde el correo de
-- confirmación, que es el camino que este mismo código ya usaba para recuperar
-- compras huérfanas (utils/checkout/provision-registration.ts:56-61).
--
-- La columna NO se borra: las compras en vuelo cuando se despliegue esto
-- todavía traen su hash, y provisionFromPending lo sigue aceptando.
--
-- Idempotente.
-- ============================================================================

alter table public.pending_registrations
  alter column password_hash drop not null;

-- ============================================================================
-- VALIDACIÓN — ejecutar después:
--
--   select is_nullable from information_schema.columns
--    where table_schema='public' and table_name='pending_registrations'
--      and column_name='password_hash';            → YES
-- ============================================================================
```

- [ ] **Paso 2: Aplicar en Supabase y validar**

Pegar en el editor SQL de Supabase. Ejecutar la consulta de validación del propio fichero. Esperado: `YES`.

- [ ] **Paso 3: Documentar en `supabase/MIGRATIONS.md`**

Añadir una sección nueva encima de la más reciente, siguiendo el formato de las que ya hay: tabla con fichero/qué hace/estado, y un párrafo con el porqué y las cifras del embudo.

- [ ] **Paso 4: Commit**

```bash
git add supabase/2026_09_pending_password_optional.sql supabase/MIGRATIONS.md
git commit -m "chore(db): allow pending registrations without a password"
```

---

### Tarea 2: Validador sin contraseña ni campos muertos

**Ficheros:**
- Modificar: `utils/checkout/registration-validation.ts`
- Test: `__tests__/utils/registration-validation.test.ts` (existe; comprobar el nombre real con `ls __tests__/utils | grep -i registration`)

**Interfaces:**
- Produce: `validateRegistration(raw)` devuelve `{ ok: true, data: CleanRegistration }` donde `CleanRegistration` pasa a ser exactamente:
  ```ts
  { fullName: string; email: string; marketingConsent: boolean; acceptDigitalExecution: boolean }
  ```
  Desaparecen `password`, `country`, `city`, `postalCode`, `dateOfBirth`, `danceLevel`, `phone`.
- Códigos de error que siguen existiendo: `invalid_name`, `invalid_email`, `terms_required`, `digital_execution_required`. **Nuevo:** `age_required`. **Desaparecen:** `password_weak`, `password_mismatch`, `invalid_birthdate`, `invalid_country`, `invalid_city`, `invalid_postal`, `invalid_level`, `invalid_phone`.

- [ ] **Paso 1: Escribir los tests que fallan**

```ts
describe('validateRegistration — formulario mínimo', () => {
  const base = {
    fullName: 'Ana García', email: 'ana@example.com',
    acceptTerms: 'on', acceptDigitalExecution: 'on', isAdult: 'on',
  }

  it('acepta el formulario mínimo: nombre, email y las tres casillas', () => {
    const r = validateRegistration(base)
    expect(r).toEqual({
      ok: true,
      data: { fullName: 'Ana García', email: 'ana@example.com', marketingConsent: false, acceptDigitalExecution: true },
    })
  })

  it('ya no pide contraseña ni los campos que nadie leía', () => {
    const r = validateRegistration(base)
    expect(r.ok).toBe(true)
    expect(Object.keys((r as { data: object }).data).sort())
      .toEqual(['acceptDigitalExecution', 'email', 'fullName', 'marketingConsent'])
  })

  it('exige la casilla de edad: las condiciones piden 16 años', () => {
    expect(validateRegistration({ ...base, isAdult: null })).toEqual({ ok: false, code: 'age_required' })
  })

  it('mantiene la casilla de ejecución inmediata separada de la de condiciones', () => {
    expect(validateRegistration({ ...base, acceptDigitalExecution: null }))
      .toEqual({ ok: false, code: 'digital_execution_required' })
    expect(validateRegistration({ ...base, acceptTerms: null }))
      .toEqual({ ok: false, code: 'terms_required' })
  })

  it('sigue rechazando un email inválido', () => {
    expect(validateRegistration({ ...base, email: 'no-es-email' })).toEqual({ ok: false, code: 'invalid_email' })
  })

  it('normaliza el email a minúsculas y recorta espacios', () => {
    const r = validateRegistration({ ...base, email: '  Ana@Example.COM  ' })
    expect((r as { data: { email: string } }).data.email).toBe('ana@example.com')
  })

  it('recoge el consentimiento de marketing cuando se marca', () => {
    const r = validateRegistration({ ...base, marketingConsent: 'on' })
    expect((r as { data: { marketingConsent: boolean } }).data.marketingConsent).toBe(true)
  })
})
```

- [ ] **Paso 2: Ejecutar y verificar que fallan**

```bash
npx vitest run __tests__/utils/registration-validation.test.ts
```
Esperado: FALLAN. Los tests viejos que comprueban contraseña y fecha de nacimiento también fallarán — **hay que borrarlos**, no adaptarlos: comprueban campos que dejan de existir.

- [ ] **Paso 3: Reescribir el validador**

```ts
import { EMAIL_RE } from '@/utils/auth/email'

export type CleanRegistration = {
  fullName: string
  email: string
  marketingConsent: boolean
  /**
   * Consentimiento previo y expreso al inicio inmediato de la ejecución, con
   * reconocimiento de que ello hace perder el derecho de desistimiento
   * (art. 103.m RDL 1/2007). Casilla propia y obligatoria, separada de la
   * aceptación de términos: el artículo exige un acto específico, y una
   * casilla genérica de "acepto los términos" no lo prueba.
   */
  acceptDigitalExecution: boolean
}

export type RegistrationResult =
  | { ok: true; data: CleanRegistration }
  | { ok: false; code: string }

function str(v: FormDataEntryValue | null): string {
  return typeof v === 'string' ? v.trim() : ''
}

function marcada(v: FormDataEntryValue | null): boolean {
  return v === 'on' || v === 'true'
}

export function validateRegistration(
  raw: Record<string, FormDataEntryValue | null>,
): RegistrationResult {
  const fullName = str(raw.fullName)
  const email = str(raw.email).toLowerCase()

  if (fullName.length < 2 || fullName.length > 120) return { ok: false, code: 'invalid_name' }
  if (!EMAIL_RE.test(email) || email.length > 254) return { ok: false, code: 'invalid_email' }

  // La fecha de nacimiento se pedía solo para esto. Las condiciones exigen 16
  // años (app/legal/terms/page.tsx:40) y una casilla lo declara igual de bien,
  // sin cobrar un campo de fecha a cada comprador ni guardar un dato que
  // ninguna pantalla de la aplicación lee.
  if (!marcada(raw.isAdult)) return { ok: false, code: 'age_required' }
  if (!marcada(raw.acceptTerms)) return { ok: false, code: 'terms_required' }
  if (!marcada(raw.acceptDigitalExecution)) return { ok: false, code: 'digital_execution_required' }

  return {
    ok: true,
    data: { fullName, email, marketingConsent: marcada(raw.marketingConsent), acceptDigitalExecution: true },
  }
}
```

- [ ] **Paso 4: Ejecutar los tests**

```bash
npx vitest run __tests__/utils/registration-validation.test.ts
npx tsc --noEmit
```
Esperado: tests en verde. `tsc` señalará los consumidores rotos (`comprar/actions.ts`) — se arreglan en la tarea 4, es esperado en este punto.

- [ ] **Paso 5: Commit**

```bash
git add utils/checkout/registration-validation.ts __tests__/utils/registration-validation.test.ts
git commit -m "refactor(checkout): validate only what the purchase actually needs"
```

---

### Tarea 3: Formulario de dos campos

**Ficheros:**
- Modificar: `components/LandingCheckoutForm.tsx`
- Test: `__tests__/components/landing-checkout-form.test.tsx` (existe)

**Interfaces:**
- Consume: los códigos de error de la tarea 2.
- Produce: un `<form>` cuyos `name` son exactamente `courseId`, `fullName`, `email`, `isAdult`, `acceptTerms`, `acceptDigitalExecution`, `marketingConsent`.

- [ ] **Paso 1: Escribir los tests que fallan**

```ts
describe('LandingCheckoutForm — formulario mínimo', () => {
  it('pide exactamente nombre y email', () => {
    render(<LandingCheckoutForm courseId="c1" />)
    expect(screen.getByLabelText(/nombre/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/contraseña/i)).not.toBeInTheDocument()
  })

  it('no pide ninguno de los campos que nadie leía', () => {
    render(<LandingCheckoutForm courseId="c1" />)
    for (const etiqueta of [/país/i, /ciudad/i, /postal/i, /nacimiento/i, /nivel/i, /teléfono/i]) {
      expect(screen.queryByLabelText(etiqueta)).not.toBeInTheDocument()
    }
  })

  it('mantiene las tres casillas, y la de ejecución inmediata aparte', () => {
    render(<LandingCheckoutForm courseId="c1" />)
    expect(screen.getByRole('checkbox', { name: /16/ })).toBeRequired()
    expect(screen.getByRole('checkbox', { name: /condiciones/i })).toBeRequired()
    expect(screen.getByRole('checkbox', { name: /acceso inmediato|ejecución/i })).toBeRequired()
  })

  it('muestra el error de edad que devuelve el servidor', () => {
    render(<LandingCheckoutForm courseId="c1" error="age_required" />)
    expect(screen.getByRole('alert')).toHaveTextContent(/16/)
  })
})
```

- [ ] **Paso 2: Ejecutar y verificar que fallan**

```bash
npx vitest run __tests__/components/landing-checkout-form.test.tsx
```

- [ ] **Paso 3: Reescribir el formulario**

Borrar los bloques de `password`, `repeatPassword`, `country`, `city`, `postalCode`, `dateOfBirth`, `danceLevel` y `phone`, junto con el estado `showPw`/`pwType` y el botón de ver/ocultar, que se quedan sin uso. Sustituir el mapa de errores por:

```tsx
const ERRORES: Record<string, string> = {
  invalid_name: 'Escribe tu nombre completo.',
  invalid_email: 'Revisa el correo: no parece válido.',
  age_required: 'Debes confirmar que tienes 16 años o más.',
  terms_required: 'Tienes que aceptar las condiciones para continuar.',
  digital_execution_required: 'Marca la casilla de acceso inmediato para continuar.',
  rate: 'Has hecho varios intentos seguidos. Espera un minuto y vuelve a probar.',
  stripe: 'No hemos podido abrir el pago. Inténtalo de nuevo en un momento.',
  course: 'Ese curso no está disponible ahora mismo.',
  account_creation_failed: 'No hemos podido preparar tu compra. Inténtalo de nuevo.',
}
```

Añadir la casilla de edad junto a las otras dos, con el mismo marcado que ya usan:

```tsx
<label className={styles.check}>
  <input name="isAdult" type="checkbox" value="on" required />
  <span>Confirmo que tengo 16 años o más.</span>
</label>
```

- [ ] **Paso 4: Adelgazar la cookie flash**

Tras un error de validación, los campos vuelven al formulario por una cookie
`landing_form` (httpOnly, 120 s), escrita en `app/curso-bachatango/comprar/actions.ts:33`
y leída en `app/curso-bachatango/comprar/page.tsx:24`. Existe para no meter PII en
la query string (AUDITORIA-2026-07 M6).

Reducir `FlashFields` a `{ name?: string; email?: string }` en la página, quitar
las seis claves del `JSON.stringify` de la acción, y borrar las props `defaults`
del componente. Con esto la cookie deja de llevar fecha de nacimiento y teléfono,
que era el motivo de la advertencia original.

Actualizar también la descripción de `landing_form` en `app/legal/cookies/page.tsx:65`
si enumera los campos: la página de cookies no puede prometer que guarda datos que
ya no guarda.

- [ ] **Paso 5: Ejecutar los tests**

```bash
npx vitest run __tests__/components/landing-checkout-form.test.tsx
npx tsc --noEmit
```

- [ ] **Paso 6: Commit**

```bash
git add components/LandingCheckoutForm.tsx app/curso-bachatango/comprar/page.tsx app/legal/cookies/page.tsx __tests__/components/landing-checkout-form.test.tsx
git commit -m "feat(checkout): cut the purchase form to two fields"
```

---

### Tarea 4: Acción de servidor — validar antes de limitar

**Ficheros:**
- Modificar: `app/curso-bachatango/comprar/actions.ts`
- Test: `__tests__/actions/landing-checkout.test.ts` (existe)

**Interfaces:**
- Consume: `validateRegistration` de la tarea 2.
- Produce: la fila de `pending_registrations` se escribe con `password_hash: null` y sin los seis campos. La metadata de Stripe no cambia.

- [ ] **Paso 1: Escribir los tests que fallan**

```ts
it('valida ANTES de gastar cupo: una errata no cuenta como intento', async () => {
  const fd = new FormData()
  fd.set('courseId', 'c1'); fd.set('fullName', 'Ana'); fd.set('email', 'no-es-email')
  await landingCheckout(fd).catch(getRedirectUrl)
  expect(vi.mocked(rateLimit)).not.toHaveBeenCalled()
})

it('no guarda contraseña ni los campos que nadie leía', async () => {
  const fd = formularioValido()
  await landingCheckout(fd).catch(getRedirectUrl)
  const fila = insertMock.mock.calls[0][0]
  expect(fila.password_hash).toBeNull()
  for (const c of ['country', 'city', 'postal_code', 'date_of_birth', 'dance_level', 'phone']) {
    expect(fila[c]).toBeUndefined()
  }
})

it('sigue sellando los consentimientos antes del pago', async () => {
  const fd = formularioValido()
  await landingCheckout(fd).catch(getRedirectUrl)
  const fila = insertMock.mock.calls[0][0]
  expect(fila.terms_version).toBeTruthy()
  expect(fila.terms_accepted_at).toBeTruthy()
  expect(fila.digital_execution_consent_at).toBeTruthy()
})
```

- [ ] **Paso 2: Ejecutar y verificar que fallan**

```bash
npx vitest run __tests__/actions/landing-checkout.test.ts
```

- [ ] **Paso 3: Reordenar y adelgazar**

Mover el bloque completo de límites (los tres `rateLimit`, hoy en `:50-61`) a **después** de `if (!v.ok) redirect(await back(v.code))`. Mantener el orden relativo entre ellos y este comentario:

```ts
// Los límites van DESPUÉS de validar. Al revés, una errata en el correo
// consumía cupo: 5 por (IP,email) al día, y al sexto intento un bloqueo de 24
// horas cuyo mensaje decía "Espera un momento". Quien más se equivoca al
// teclear es justo quien más quiere comprar.
```

Borrar `const passwordHash = await hashPassword(reg.password)` y su import. En el `insert`, dejar solo:

```ts
.insert({
  id: randomUUID(),
  email: reg.email,
  full_name: reg.fullName,
  password_hash: null,
  marketing_consent: reg.marketingConsent,
  terms_version: CURRENT_TERMS_VERSION,
  terms_accepted_at: new Date().toISOString(),
  digital_execution_consent_at: reg.acceptDigitalExecution ? new Date().toISOString() : null,
  marketing_consent_at: reg.marketingConsent ? new Date().toISOString() : null,
  course_id: courseId,
  amount_expected: amountExpected,
})
```

- [ ] **Paso 4: Ejecutar los tests**

```bash
npx vitest run __tests__/actions/landing-checkout.test.ts
npx tsc --noEmit
```

- [ ] **Paso 5: Commit**

```bash
git add app/curso-bachatango/comprar/actions.ts __tests__/actions/landing-checkout.test.ts
git commit -m "fix(checkout): validate before spending the rate-limit budget"
```

---

### Tarea 5: Aprovisionar sin contraseña

**Ficheros:**
- Modificar: `utils/checkout/provision-registration.ts:84-101`
- Test: `__tests__/utils/provision-registration.test.ts` (existe)

**Interfaces:**
- Consume: filas de `pending_registrations` con `password_hash` a `null`.
- Produce: `provisionFromPending` sigue devolviendo `{ ok: true, userId, created }`. Cuando crea una cuenta sin contraseña, pasa `setPasswordUrl` a `sendPurchaseConfirmation` (tarea 6).

- [ ] **Paso 1: Escribir los tests que fallan**

```ts
it('sin password_hash crea la cuenta igualmente y la deja confirmada', async () => {
  const admin = makeAdmin({ pending: { ...PENDING, password_hash: null }, profileByEmail: null,
                            createUser: { id: 'u-nuevo' }, purchaseInserted: [{ id: 'p1' }] })
  const res = await provisionFromPending(session(), admin)
  expect(res).toEqual({ ok: true, userId: 'u-nuevo', created: true })
  expect(admin.__calls.createUser[0]).toMatchObject({ email_confirm: true })
  expect(admin.__calls.createUser[0].password_hash).toBeUndefined()
})

it('manda el enlace para fijar contraseña en el correo de compra', async () => {
  const admin = makeAdmin({ pending: { ...PENDING, password_hash: null }, profileByEmail: null,
                            createUser: { id: 'u-nuevo' }, purchaseInserted: [{ id: 'p1' }] })
  await provisionFromPending(session(), admin)
  expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({
    setPasswordUrl: expect.stringContaining('/auth/confirm?token_hash='),
  }))
})

it('una compra con contraseña (en vuelo al desplegar) sigue funcionando', async () => {
  const admin = makeAdmin({ pending: PENDING, profileByEmail: null,
                            createUser: { id: 'u-nuevo' }, purchaseInserted: [{ id: 'p1' }] })
  const res = await provisionFromPending(session(), admin)
  expect(res.ok).toBe(true)
  expect(admin.__calls.createUser[0].password_hash).toBe(PENDING.password_hash)
  expect(sendMock.mock.calls[0][0].setPasswordUrl).toBeUndefined()
})
```

- [ ] **Paso 2: Ejecutar y verificar que fallan**

```bash
npx vitest run __tests__/utils/provision-registration.test.ts
```

- [ ] **Paso 3: Implementar la rama sin contraseña**

En la llamada a `createUser`, incluir `password_hash` solo si existe:

```ts
// La contraseña ya no se pide en el formulario, pero una compra que estuviera
// en vuelo al desplegar todavía trae su hash. Se respetan los dos casos.
const sinContrasena = !pending.password_hash
const { data: createdUser, error: createErr } = await admin.auth.admin.createUser({
  email,
  email_confirm: true,
  ...(sinContrasena ? {} : { password_hash: pending.password_hash as string }),
  user_metadata: pending.full_name ? { full_name: pending.full_name } : undefined,
})
```

Justo antes del envío del correo, generar el enlace cuando haga falta:

```ts
// Un solo correo, no dos. Se podría dejar que Supabase mandase su invitación,
// pero entonces el comprador recibiría dos mensajes casi idénticos y el de
// Supabase no lleva la plantilla de la casa. Aquí se genera el enlace y viaja
// dentro del correo de compra, que ya se envía y ya está maquetado.
let setPasswordUrl: string | undefined
if (genuineInsert && !opts.isDemo && sinContrasena && created) {
  const { data: link } = await admin.auth.admin.generateLink({ type: 'recovery', email })
  const th = link?.properties?.hashed_token
  if (th) {
    const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://luisysarabachatango.com'
    setPasswordUrl = `${base}/auth/confirm?token_hash=${th}&type=recovery&next=/reset-password`
  } else {
    // Sin enlace el comprador no puede entrar. Tiene salida —"olvidé mi
    // contraseña" funciona— pero nadie se enteraría de que hizo falta.
    alertaCritica('Compra sin enlace para fijar contraseña: el comprador tendrá que recuperarla', {
      sesion: session.id, usuario: userId as string,
    })
  }
}
```

Pasarlo a `sendPurchaseConfirmation({ email, fullName, existingAccount: !created, setPasswordUrl })`.

- [ ] **Paso 4: Ejecutar los tests**

```bash
npx vitest run __tests__/utils/provision-registration.test.ts
```

- [ ] **Paso 5: Commit**

```bash
git add utils/checkout/provision-registration.ts __tests__/utils/provision-registration.test.ts
git commit -m "feat(checkout): provision buyers without a password"
```

---

### Tarea 6: El correo lleva el botón para fijar contraseña

**Ficheros:**
- Modificar: `utils/email/purchase-confirmation.ts`
- Test: `__tests__/utils/purchase-confirmation.test.ts` (crear si no existe)

**Interfaces:**
- Consume: `setPasswordUrl?: string` de la tarea 5.
- Produce: `sendPurchaseConfirmation(opts)` con `opts.setPasswordUrl` opcional.

- [ ] **Paso 1: Escribir los tests que fallan**

```ts
it('con enlace, el botón lleva a fijar la contraseña', async () => {
  await sendPurchaseConfirmation({ email: 'a@b.es', fullName: 'Ana', existingAccount: false,
                                   setPasswordUrl: 'https://x/auth/confirm?token_hash=abc&type=recovery' })
  const { html, text } = enviarMock.mock.calls[0][0]
  expect(html).toContain('token_hash=abc')
  expect(html).toMatch(/crea tu contraseña/i)
  expect(text).toContain('token_hash=abc')
})

it('sin enlace (cuenta ya existente) manda al login como siempre', async () => {
  await sendPurchaseConfirmation({ email: 'a@b.es', fullName: 'Ana', existingAccount: true })
  const { html } = enviarMock.mock.calls[0][0]
  expect(html).toContain('/login')
  expect(html).not.toMatch(/crea tu contraseña/i)
})

it('nunca dice "la contraseña que elegiste" cuando no se eligió ninguna', async () => {
  await sendPurchaseConfirmation({ email: 'a@b.es', fullName: 'Ana', existingAccount: false,
                                   setPasswordUrl: 'https://x/auth/confirm?token_hash=abc&type=recovery' })
  expect(enviarMock.mock.calls[0][0].html).not.toMatch(/elegiste durante la compra/i)
})
```

- [ ] **Paso 2: Ejecutar y verificar que fallan**

```bash
npx vitest run __tests__/utils/purchase-confirmation.test.ts
```

- [ ] **Paso 3: Implementar**

Añadir `setPasswordUrl?: string` a la firma. Cuando venga, sustituir párrafos y botón:

```ts
const parrafos = opts.existingAccount
  ? [ /* … sin cambios … */ ]
  : opts.setPasswordUrl
    ? [
        `${saludo} tu compra del <strong>CURSO BACHATANGO</strong> está confirmada.`,
        'Solo queda un paso: elige tu contraseña y entras. Puedes hacerlo desde cualquier dispositivo.',
      ]
    : [ /* … la rama actual, para compras con contraseña en vuelo … */ ]

const boton = opts.setPasswordUrl
  ? { texto: 'Crea tu contraseña', url: opts.setPasswordUrl }
  : { texto: 'Entrar al curso', url: `${BASE}/login` }
```

Y para ese caso, la nota:

```ts
const nota = opts.setPasswordUrl
  ? `El enlace caduca y solo puede usarse una vez. Si se te pasa, entra en la web y pulsa <strong>«¿Olvidaste tu contraseña?»</strong>: tu compra ya está guardada.`
  : /* … las notas actuales … */
```

- [ ] **Paso 4: Ejecutar los tests**

```bash
npx vitest run __tests__/utils/purchase-confirmation.test.ts
```

- [ ] **Paso 5: Commit**

```bash
git add utils/email/purchase-confirmation.ts __tests__/utils/purchase-confirmation.test.ts
git commit -m "feat(email): let the purchase email set the password"
```

---

### Tarea 7: Medir el envío del formulario

**Ficheros:**
- Modificar: `utils/analytics/tracked-paths.ts`
- Modificar: `app/curso-bachatango/comprar/actions.ts`
- Test: `__tests__/utils/tracked-paths.test.ts` (existe)

**Interfaces:**
- Produce: un evento con `path = '/curso-bachatango/comprar/enviado'` por cada envío validado, visible en el embudo de `/admin/landing` sin tocar el esquema.

- [ ] **Paso 1: Escribir el test que falla**

```ts
it('el paso de envío del formulario es una ruta medida y va en el embudo', () => {
  expect(normalisePath('/curso-bachatango/comprar/enviado')).toBe('/curso-bachatango/comprar/enviado')
  expect(FUNNEL_STEPS.map(s => s.path)).toEqual([
    '/', '/curso-bachatango', '/curso-bachatango/comprar', '/curso-bachatango/comprar/enviado', '/gracias',
  ])
})
```

- [ ] **Paso 2: Ejecutar y verificar que falla**

```bash
npx vitest run __tests__/utils/tracked-paths.test.ts
```

- [ ] **Paso 3: Añadir el paso y registrarlo**

En `tracked-paths.ts`, añadir `'/curso-bachatango/comprar/enviado'` a `TRACKED_PATHS` y a `FUNNEL_STEPS` entre el formulario y `/gracias`, con etiqueta `'Formulario enviado'`.

En `comprar/actions.ts`, justo después de insertar la fila pendiente:

```ts
// El embudo solo veía vistas de página, así que "llegó al formulario" y "lo
// envió" eran el mismo dato. Sin distinguirlos no se puede saber si un cambio
// en el formulario funcionó. No es una ruta real: es un evento con forma de
// ruta, que reutiliza la tabla y el gráfico que ya existen.
const visitorHash = dailyVisitorHash(ip, (await headers()).get('user-agent'), new Date())
if (visitorHash) {
  await admin.from('landing_events')
    .insert({ path: '/curso-bachatango/comprar/enviado', visitor_hash: visitorHash })
}
```

- [ ] **Paso 4: Ejecutar los tests**

```bash
npx vitest run __tests__/utils/tracked-paths.test.ts __tests__/utils/landing-queries.test.ts
```

- [ ] **Paso 5: Commit**

```bash
git add utils/analytics/tracked-paths.ts app/curso-bachatango/comprar/actions.ts __tests__/utils/tracked-paths.test.ts
git commit -m "feat(analytics): separate reaching the form from submitting it"
```

---

### Tarea 8: Verificación completa y despliegue

- [ ] **Paso 1: Suite entera**

```bash
npm run test && npx tsc --noEmit && npm run lint && npm run build
```
Esperado: todo en verde, 0 errores de lint.

- [ ] **Paso 2: Prueba manual en modo demo**

Con `/admin/pruebas` activado, completar una compra desde `/curso-bachatango/comprar`. Comprobar: el formulario pide dos campos y tres casillas; la compra se registra; llega un correo con el botón «Crea tu contraseña»; el botón abre `/reset-password` con sesión; la contraseña se guarda y se entra al curso.

- [ ] **Paso 3: Comprobar el sellado legal**

```sql
select terms_version, terms_accepted_at, digital_execution_consent_at, marketing_consent_at
from public.profiles order by created_at desc limit 1;
```
Esperado: las tres primeras con valor. Si alguna sale nula, **parar**: es un requisito legal, no un detalle.

- [ ] **Paso 4: PR y despliegue**

El SQL de la tarea 1 debe estar aplicado **antes** de mergear. Sin él, cada compra falla al insertar la fila pendiente.

- [ ] **Paso 5: Anotar la línea base**

Dejar escrito en el PR: conversión formulario→compra **12,9 %** (8 de 62) entre el 31 de agosto y el 9 de septiembre. Volver a medirla a las dos semanas con el nuevo paso `enviado`, que además dirá si la gente ahora envía y falla, o ni envía.

---

## Qué NO entra en este plan

- **Borrar columnas de la base.** Se quedan por si algún día se piden desde el perfil.
- **Pedir esos datos después de comprar.** Es una pantalla nueva; primero hay que ver si el formulario corto vende más.
- **Tocar el checkout de usuario logueado** (`/api/checkout`). Ese ya no pide nada: la cuenta existe.
- **Test A/B.** Con 62 visitas al formulario en 10 días no se alcanza significación en un plazo útil.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| El correo con el enlace no llega y el comprador se queda fuera | Ya tiene salida: «¿Olvidaste tu contraseña?» funciona desde el #21, y la compra está guardada. En Gmail entra en bandeja; en Outlook cae en spam, que es problema conocido de reputación. La copia del correo lo dice. |
| Una compra en vuelo al desplegar trae contraseña | La rama con `password_hash` se mantiene y está cubierta por test. |
| El sellado legal se pierde en la refactorización | Paso 3 de la tarea 8 lo comprueba en la base, y hay test en la tarea 4. |
| `generateLink` falla y no hay enlace | `alertaCritica` avisa; el comprador tiene acceso y puede recuperar la contraseña. |
