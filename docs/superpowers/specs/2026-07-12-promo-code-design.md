# Spec 6 — Precio 129€ + código descuento `luisysara` (primeros 50 → 99€)

**Fecha:** 2026-07-12
**Estado:** Diseño aprobado (pendiente revisión de spec)

## Objetivo

- Bajar el precio del curso a **129€**.
- Código promocional **`luisysara`** que deja el curso en **99€** para los **primeros 50 compradores que paguen** usándolo (cap global de 50 redenciones). El código se difunde por Instagram/TikTok.

## Decisiones (aprobadas)

- Implementación: **Stripe Promotion Codes** (Stripe cuenta las 50 redenciones al pagar, atómico; sin contador propio).
- El comprador introduce el código en el **campo built-in de Stripe Checkout** (`allow_promotion_codes: true`). No hay campo propio en la web/landing.
- Válido en **ambos flujos**: web logueado (`/api/checkout`) y landing (`landingCheckout`).
- "Primeros 50" = primeros 50 que **completan el pago** con el código. Entrar el código sin pagar no consume plaza. Tras 50 → el código deja de aplicar (pagan 129).
- **Sin copy del código en la landing** (se difunde externamente).

## Componentes

### 1. Precio del curso → 129€
`courses.price_eur`: 199 → **129** (fila del curso `f89a576f-4a77-40f7-93e9-23e6c820ee92`). Cambia el precio en todos los sitios (leen `price_eur`). Se aplica en la BD de producción (dato, no migración de esquema).

### 2. Stripe (setup una vez, en LIVE — lo crea el asistente vía API con la clave live)
- **Cupón**: `amount_off = 3000` (30€), `currency = eur`, `duration = once`, nombre "Primeros 50 (luisysara)".
- **Promotion Code**: `code = 'luisysara'`, apunta al cupón, `max_redemptions = 50`, `active = true`.
- Stripe incrementa `times_redeemed` en pago exitoso; al llegar a 50 el código deja de aplicar.

### 3. Código — `allow_promotion_codes: true` en las 2 Checkout Sessions
- `app/api/checkout/route.ts` — la creación de la sesión Stripe (rama logueada real) añade `allow_promotion_codes: true`.
- `app/curso-bachatango/comprar/actions.ts` — `landingCheckout` (rama real) añade `allow_promotion_codes: true`.
- Stripe muestra "Add promotion code"; el comprador teclea `luisysara`; Stripe valida, aplica -30€ (→99€) y controla el cap. Cero validación/contador propio.

### 4. Demo
El flujo demo simula sin Stripe → el código NO aplica; registra el precio base (129 tras el cambio). Aceptable (demo = probar el flujo, no el descuento).

### 5. Registro
`course_purchases.amount_paid` = `session.amount_total` → registra automáticamente 9900 (con código) o 12900 (sin). Sin cambios de código.

## Casos borde

- Código agotado (50 pagos) → Stripe rechaza el código en su UI; el comprador paga 129. Sin manejo especial nuestro.
- Código en demo → ignorado (no hay Stripe).
- `allow_promotion_codes: true` es compatible con `customer` (web) y `customer_email` (landing); no colisiona con nada existente.

## Testing

- `/api/checkout` (unit): la sesión Stripe real se crea con `allow_promotion_codes: true`.
- `landingCheckout` (unit): la sesión Stripe real se crea con `allow_promotion_codes: true`.
- (El cupón/cap los gestiona Stripe; verificación manual con una compra de prueba usando el código.)

## Fuera de alcance

- Contador propio / panel de redenciones (Stripe Dashboard muestra `times_redeemed`).
- Copy del código en la landing.
- Otros códigos / campañas.

## Setup operativo (prerrequisitos)

- El asistente necesita la **clave Stripe LIVE** (archivo, no chat) para: crear el cupón + promo code, y cambiar el precio (o el precio se cambia por BD con el service role de Supabase).
- El código funciona cuando: (a) el cupón+promo existen en Stripe, y (b) el cambio `allow_promotion_codes` está desplegado. Ambos antes de difundir el código.
