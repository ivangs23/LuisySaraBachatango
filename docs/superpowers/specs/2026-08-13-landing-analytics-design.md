# Estadísticas de la landing en el panel de administrador — diseño

**Fecha:** 2026-08-13
**Estado:** aprobado en conversación, pendiente de plan de implementación

## Problema

El panel tiene `/admin/estadisticas` con ingresos, altas, suscripciones y
engagement — todo lo que la base de datos ya sabe. Pero **la base de datos no
guarda ni una sola visita**, así que no puede responder la pregunta que importa
para vender: *de quienes entran, ¿cuántos compran, y dónde se pierden los demás?*

## Alcance

Dentro:

- Captura de vistas de página en la superficie de venta, sin cookies.
- `/admin/landing` con dos vistas: embudo con porcentaje de caída, y serie
  temporal de vistas y visitantes únicos.

Fuera, decidido explícitamente:

- **Editar contenido de la landing.** Es el otro subsistema de la petición
  original. Tendrá su propio spec: datos, riesgos e i18n no tienen nada que ver
  con esto.
- Origen del tráfico y rendimiento de la clase gratis. Descartados al acotar.
- Agregación y purga por volumen. Ver «Cuándo habrá que volver».

## Por qué no se usa GA4

GA4 está integrado tras el banner de consentimiento, así que **solo cuenta a
quien acepta cookies de análisis** — típicamente el 50-70% del tráfico. Además
sabe de visitas pero no de compras, y `course_purchases` sabe de compras pero no
de visitas: la conversión real solo sale si ambas viven en el mismo sitio.

Eventos propios en Supabase cuentan al 100% del tráfico, funcionan sin esperar a
que se active ninguna variable, y quedan al lado de las compras.

## Privacidad

La decisión que sostiene todo lo demás: **no se identifica a nadie**.

```
visitor_hash = sha256( sal_del_día || ip || user_agent )
sal_del_día  = hmac_sha256( LANDING_ANALYTICS_SECRET, 'YYYY-MM-DD' )
```

- La IP y el user-agent se usan para calcular el hash y **se descartan**. Nunca
  se persisten.
- La sal cambia cada día, así que el mismo visitante recibe un hash distinto
  mañana. No hay seguimiento entre días, por diseño.
- No hay cookie, no hay `user_id`, no hay `localStorage`.

**Por tanto no pasa por el banner de consentimiento**, igual que Vercel
Analytics. Sin identificador persistente ni datos personales almacenados, no hay
nada que consentir. Esto debe seguir siendo cierto: si alguna vez se añade IP,
cookie o `user_id`, la categoría pasa a requerir consentimiento y hay que subir
`CONSENT_VERSION`.

**Riesgo residual, dicho claro:** quien tuviera a la vez el secreto y una IP
concreta podría recalcular el hash de ese día y comprobar si esa IP estuvo. Se
asume: exige el secreto del servidor, adivinar la IP, y solo funciona dentro del
mismo día. La alternativa —sal aleatoria rotada y destruida— exige tabla y tarea
de rotación, y no compensa a esta escala.

## Captura

### Por qué no en el servidor

`/` y `/curso-bachatango` se sirven con ISR (`revalidate = 300`). El componente
de servidor se ejecuta una vez cada cinco minutos aunque entren mil personas:
contar ahí perdería casi todo.

### Por qué no en el middleware

`middleware.ts` refresca la sesión de Supabase en cada petición y está
optimizado para saltárselo en tráfico anónimo (auditoría de junio). Meterle una
escritura a la base de datos desharía esa optimización y añadiría latencia a
todas las rutas, no solo a las medidas.

### Beacon desde el cliente

```
<LandingAnalytics />  (en app/layout.tsx)
   observa el pathname
   si está en la allowlist → navigator.sendBeacon('/api/landing-event', { path })
        ↓
POST /api/landing-event
   1. valida `path` contra la allowlist        ← entrada no confiable
   2. descarta bots por user-agent
   3. rate limit por IP (utils/rate-limit.ts)
   4. calcula visitor_hash y descarta la IP
   5. INSERT con service role
   6. responde 204 siempre
```

Ruta de primera parte: los bloqueadores no la tumban como harían con un dominio
de analítica conocido. Fuera de la ruta crítica de render.

`sendBeacon` no bloquea la navegación y sobrevive a que el usuario se vaya de la
página.

**El `path` que llega del cliente es entrada no confiable** y se valida contra
una allowlist cerrada. Nunca se inserta lo que mande el navegador.

**Fail-closed:** sin `LANDING_ANALYTICS_SECRET` la ruta responde 204 y no guarda
nada. Se pierde la medición, no la página.

## Datos

```sql
create table public.landing_events (
  id           bigserial   primary key,
  path         text        not null,
  visitor_hash text        not null,
  created_at   timestamptz not null default now()
);

create index landing_events_created_at_idx on public.landing_events (created_at desc);
create index landing_events_path_created_idx on public.landing_events (path, created_at desc);
```

Cuatro columnas. Sin `referrer` ni `device` porque esas métricas se descartaron;
sin `event_type` porque el embudo acordado es de vistas de página. Añadir una
columna nullable más adelante es barato; arrastrar columnas que nadie consulta,
no.

RLS: solo `admin` puede leer (vía `public.is_admin()`, creada en
`2026_08_fix_anon_read_admin_check.sql`); nadie puede escribir con la anon key —
las inserciones van con service role desde la ruta de API.

### Rutas medidas

```ts
'/'                          // paso 1  Inicio
'/curso-bachatango'          // paso 2  Página de venta
'/clase-gratis'              //         medida, fuera del embudo
'/curso-bachatango/comprar'  // paso 3  Formulario de compra
'/gracias'                   // paso 4  Compra completada
```

`/clase-gratis` se captura aunque su métrica se descartara: el coste es cero y
sin ella no se podrá responder más adelante si la clase gratis vende.

## Métricas

### Qué significa «visitante único» aquí

El hash rota cada día, así que `count(distinct visitor_hash)` sobre un rango de
90 días cuenta **visitante-día**, no personas: quien entra el lunes y el martes
suma dos.

Es la consecuencia directa de no seguir a nadie entre días. El panel usa el
término **«únicos/día»** en vez de «visitantes» para no dar a entender una
precisión que no existe, y los totales de rango se presentan como suma de
únicos diarios.

### Embudo

Únicos por paso dentro del rango, y el porcentaje que pasa al siguiente.

```
/                    1.240
                       ↓ 18,0 %
/curso-bachatango      223
                       ↓ 12,1 %
/curso-bachatango/comprar 27
                       ↓ 63,0 %
/gracias                17          conversión total 1,4 %
```

**Limitación que hay que decir en pantalla:** son *proporciones entre pasos*, no
recorridos seguidos persona a persona. El hash caduca cada día, así que quien ve
la página el martes y compra el jueves cuenta en ambos pasos pero no queda
enlazado. Encadenar recorridos exigiría identificadores entre días, que es
exactamente lo que se decidió no tener.

Es la consecuencia honesta de la decisión de privacidad, y el panel la muestra
como nota al pie en vez de fingir precisión que no tiene.

### Tráfico

Serie diaria con dos valores: vistas de página y visitantes únicos
(`count(distinct visitor_hash)` por día). Mismo `RangePicker` que
`/admin/estadisticas`: 30 / 90 / 365 / todo.

## Componentes

| Fichero | Responsabilidad |
|---|---|
| `supabase/2026_08_landing_events.sql` | Tabla, índices y RLS |
| `utils/analytics/tracked-paths.ts` | Allowlist y definición del embudo. Único sitio donde se declaran las rutas |
| `utils/analytics/visitor-hash.ts` | `dailyVisitorHash(ip, userAgent, now)` y detección de bots |
| `app/api/landing-event/route.ts` | Valida, limita, calcula el hash, inserta |
| `components/LandingAnalytics.tsx` | Cliente. Dispara el beacon al cambiar de ruta |
| `utils/admin/landing-queries.ts` | `getLandingFunnel(range)` y `getLandingTraffic(range)` |
| `components/admin/charts/LandingFunnelChart.tsx` | Embudo con porcentajes |
| `components/admin/charts/LandingTrafficChart.tsx` | Serie diaria |
| `app/admin/landing/page.tsx` | Página, con `RangePicker` |

Modificados: `components/admin/AdminSidebar.tsx` (entrada nueva),
`app/layout.tsx` (montar el beacon), `CLAUDE.md` (variable nueva).

`landing-queries.ts` va aparte de `utils/admin/queries.ts` a propósito: ese
fichero ya exporta 17 funciones y no necesita crecer más.

## Errores

- **Ruta de API:** responde 204 pase lo que pase. Un fallo de analítica no puede
  romper la navegación. Los errores se registran en servidor, no se devuelven.
- **Consultas de admin:** si fallan, la gráfica muestra el estado vacío de
  `ChartShell` («Sin datos en este rango»), no un 500.
- **Sin datos:** el panel dirá que la medición empieza el día del despliegue. No
  hay histórico y no se puede rellenar hacia atrás.

## Pruebas

- `visitor-hash`: mismo día e misma entrada dan el mismo hash; días distintos dan
  hashes distintos; la IP no aparece en la salida; los bots se detectan.
- `tracked-paths`: la allowlist rechaza rutas no declaradas, incluidas las que
  intenten colarse con query string o mayúsculas.
- Ruta de API: 204 en válido; nada insertado con `path` no permitido; nada
  insertado sin el secreto; el limitador corta.
- Consultas de admin: el embudo calcula bien los porcentajes; división por cero
  cuando un paso está a cero; el rango filtra.
- Componentes: el embudo pinta los cuatro pasos y sus porcentajes; la serie
  temporal muestra el vacío cuando no hay datos.
- E2E: navegar a `/curso-bachatango` como anónimo dispara exactamente una
  petición a `/api/landing-event`.

## Cuándo habrá que volver

**Volumen.** Con el tráfico actual son miles de filas al mes y los índices
bastan. Si `landing_events` pasa de ~5 millones de filas, la respuesta es una
tabla de agregados diarios más purga del detalle. No se construye ahora: sería
resolver un problema que no existe.

**Si se quiere atribución entre días.** Exige un identificador persistente, y eso
mueve la funcionalidad dentro del banner de consentimiento con la infravaloración
que eso implica. Es un cambio de diseño, no un ajuste.

## Variable de entorno

```
LANDING_ANALYTICS_SECRET   # Clave HMAC de la sal diaria de visitor_hash.
                           # Fail-closed: sin ella /api/landing-event no guarda
                           # nada y responde 204. Rotarla parte la continuidad
                           # del conteo de únicos ese día.
```
