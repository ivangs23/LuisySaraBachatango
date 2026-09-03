# Plantillas de correo de Supabase Auth

Los correos de autenticación —restablecer contraseña, invitación, confirmar
alta— **no salen de este repositorio**. Los envía Supabase con las plantillas
que hay en el dashboard, así que el HTML vive aquí solo como fuente de verdad:
lo que está en `Authentication → Emails` debe ser copia de estos ficheros.

Se aplican a mano, igual que los `.sql` (ver [MIGRATIONS.md](../MIGRATIONS.md)).

| Fichero | Plantilla en Supabase |
|---|---|
| `reset-password.html` | Reset password |
| `invite.html` | Invite user |
| `confirm-signup.html` | Confirm signup |

## Por qué existen

Dos motivos, y ninguno es estético.

**1. El enlace tenía que cambiar.** Las plantillas por defecto usan
`{{ .ConfirmationURL }}`, que entra por `/auth/callback` — flujo PKCE. PKCE
exige un `code_verifier` guardado en el navegador que *pidió* el enlace y un
estado que caduca en menos de una hora. Nada de eso sobrevive a cómo se lee el
correo de verdad: se pide en el portátil y se abre en el móvil, o después de
cenar.

El resultado medido en producción el 2026-09-03: **3 recuperaciones intentadas,
0 completadas** desde que existe el proyecto. Dos personas se quedaron fuera sin
que nadie se enterara.

`reset-password.html` e `invite.html` apuntan a `/auth/confirm` con
`{{ .TokenHash }}`, que verifica el token en servidor y fija la cookie de sesión
directamente. Sin `code_verifier`, sin estado previo, sin depender del
dispositivo.

`confirm-signup.html` **mantiene `{{ .ConfirmationURL }}` a propósito**: el alta
por email funciona (16 intentos, 14 completados) y no hay motivo para tocar el
flujo. Solo cambia el aspecto.

**2. Los correos caían en spam.** El SMTP y el dominio estaban bien —Resend
activo, DKIM, SPF en `send.luisysarabachatango.com`, DMARC—, pero la plantilla
por defecto de Supabase es HTML pelado: un `<h2>`, una frase en inglés y un
enlace suelto, sin marca y sin versión en texto plano. El resto del correo del
sitio sale por `utils/email/layout.ts`, que está maquetado precisamente para no
puntuar mal.

Estas plantillas replican ese diseño: mismo logo, misma paleta, mismo pie legal,
maquetación con tablas y estilos en línea para que Outlook y Gmail no la
destrocen, y la URL visible al final para quien no pueda pulsar el botón.

## Cómo aplicarlas

1. Supabase → **Authentication → Emails**
2. Elegir la plantilla, pegar el HTML del fichero correspondiente
3. Ajustar el asunto:

| Plantilla | Asunto |
|---|---|
| Reset password | `Restablece tu contraseña` |
| Invite user | `Tu acceso a Luis y Sara Bachatango` |
| Confirm signup | `Confirma tu correo` |

4. Comprobar que **Site URL** sea `https://luisysarabachatango.com`: las tres
   plantillas construyen el enlace con `{{ .SiteURL }}`.

## Limitaciones que no se arreglan aquí

**Un solo idioma.** El sitio habla seis; estas plantillas hablan español.
Supabase no conoce la preferencia de idioma del destinatario.

**El asunto se edita aparte.** Está en su propio campo del dashboard, no en el
HTML: pegar la plantilla no lo cambia. Pasó la primera vez —cuerpo en español y
asunto en el `Reset Your Password` de fábrica—, y esa frase es de las más
gastadas en phishing.

## Sí llevan texto plano

Aunque el editor de Supabase solo acepte un cuerpo HTML, el correo **no** sale
sin versión en texto: su cliente SMTP (Nodemailer) la genera desde el HTML y
manda un `multipart/alternative`. Comprobado en las cabeceras de un envío real
del 2026-09-03:

    Content-Type: multipart/alternative; boundary="--_NmP-4d63114ad0b75df8-Part_1"
      → Content-Type: text/plain; charset=utf-8
      → Content-Type: text/html;  charset=utf-8

Queda escrito porque lo contrario parece de sentido común y llevó a diagnosticar
mal la entrega en spam. La versión en texto sale correcta, con los enlaces entre
corchetes, así que la maquetación con tablas y el orden del contenido también
mandan sobre cómo se lee ese texto.

## Sobre la entrega

Un envío real a Outlook el 2026-09-03 pasó **todo**: `spf=pass`, `dkim=pass`
(por `luisysarabachatango.com` y por `amazonses.com`), `dmarc=pass` y
`compauth=pass reason=100`. Aun así aterrizó en no deseado con `SCL 5`.

O sea: la autenticación y el DNS están bien y no hay nada que tocar ahí. Lo que
queda es reputación —dominio joven, volumen bajo, IP compartida de Amazon SES— y
el filtro concreto del destinatario. Antes de tocar DNS por una queja de spam,
mirar las cabeceras: si `dmarc=pass`, el problema no está en este repo.

Las dos se resuelven igual: con un **Send Email Hook**, que deja que la
aplicación envíe estos correos por Resend usando `utils/email/layout.ts`
—con su versión en texto y el diccionario de i18n— en lugar de que los mande
Supabase. Es la evolución natural cuando compense; mientras tanto, esto cubre lo
importante.

## Al cambiar el HTML

Editar el fichero **y** pegarlo en el dashboard. Si solo se cambia aquí, no pasa
nada en producción; si solo se cambia allí, el siguiente que lea este directorio
creerá algo falso.
