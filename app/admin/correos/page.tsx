import Link from 'next/link'
import SendEmailButton from '@/components/admin/SendEmailButton'
import { getEmailPanel, DIAS, type EstadoCorreo, type FilaCorreo, type PanelCorreos } from '@/utils/admin/email-status'
import tabla from '@/app/admin/alumnos/alumnos.module.css'
import styles from './correos.module.css'

export const dynamic = 'force-dynamic'

const ESTADOS: Record<EstadoCorreo, { texto: string; tono: 'ok' | 'pending' | 'bad' | 'neutral' }> = {
  'entregado': { texto: 'Entregado', tono: 'ok' },
  'en-camino': { texto: 'En camino', tono: 'pending' },
  'rebotado': { texto: 'Rebotado', tono: 'bad' },
  'spam': { texto: 'Marcado como spam', tono: 'bad' },
  'fallido': { texto: 'Fallido', tono: 'bad' },
  'no-enviado': { texto: 'No enviado', tono: 'bad' },
  'no-aplica': { texto: 'No se envía', tono: 'neutral' },
  'desconocido': { texto: 'Sin datos', tono: 'neutral' },
}

function fecha(iso: string): string {
  return new Date(iso).toLocaleString('es-ES', {
    timeZone: 'Europe/Madrid', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

function AvisoResend({ resend }: { resend: PanelCorreos['resend'] }) {
  if (resend.ok) return null
  switch (resend.reason) {
    case 'clave-invalida':
      return (
        <p className={styles.alert} role="alert">
          <strong>Resend rechaza la clave de la web: no está saliendo NINGÚN correo</strong> (ni de compra
          ni de clases gratis). Hay que poner una clave válida en <code>RESEND_API_KEY</code> (Vercel →
          Production) y volver a desplegar. Hasta entonces los botones tampoco envían.
        </p>
      )
    case 'sin-clave':
      return (
        <p className={styles.alert} role="alert">
          <strong>Falta <code>RESEND_API_KEY</code>: no sale ningún correo.</strong> Hay que añadirla en
          Vercel → Production y volver a desplegar.
        </p>
      )
    case 'sin-permiso':
      return (
        <p className={styles.warn}>
          La clave de Resend solo tiene permiso para enviar: los correos salen, pero este panel no puede
          ver si llegaron. Para verlo hace falta una clave con permiso «Full access».
        </p>
      )
    default:
      return <p className={styles.warn}>No se pudo consultar Resend ahora mismo. Recarga la página en un rato.</p>
  }
}

function Estado({ fila }: { fila: FilaCorreo }) {
  const e = ESTADOS[fila.estado]
  return (
    <div className={styles.estado}>
      <span className={`${styles.badge} ${styles[e.tono]}`}>{e.texto}</span>
      {fila.enviadoAt && <span className={styles.meta}>Salió el {fecha(fila.enviadoAt)}</span>}
      {fila.nota && <span className={styles.meta}>{fila.nota}</span>}
    </div>
  )
}

const YA_SALIO: readonly EstadoCorreo[] = ['entregado', 'en-camino']

function Accion({ fila, tipo }: { fila: FilaCorreo; tipo: 'compra' | 'clases' }) {
  if (!fila.reenviable) return null
  const reenvio = YA_SALIO.includes(fila.estado)
  const confirmar = tipo === 'compra'
    ? `¿Mandar el correo de compra a ${fila.email}?\n\nSi todavía no ha entrado nunca, lleva un enlace nuevo para crear su contraseña y el anterior deja de valer.`
    : `¿Mandar el correo de las dos clases gratis a ${fila.email}?`
  return (
    <SendEmailButton
      tipo={tipo}
      refId={fila.ref}
      label={reenvio ? 'Reenviar' : 'Enviar'}
      confirmar={reenvio ? `${confirmar}\n\nYa le salió uno: le llegará otro.` : confirmar}
    />
  )
}

export default async function CorreosPage() {
  const panel = await getEmailPanel()

  return (
    <div className={tabla.container}>
      <header className={tabla.header}>
        <h1 className={tabla.title}>
          Correos{' '}
          <span className={tabla.count}>({panel.pendientes} {panel.pendientes === 1 ? 'pendiente' : 'pendientes'})</span>
        </h1>
      </header>

      <p className={styles.intro}>
        Si a cada comprador y a cada persona que pidió las clases gratis le salió su correo, según el
        registro de Resend. Últimos {DIAS} días. Si alguno no salió, pulsa «Enviar».
      </p>

      <AvisoResend resend={panel.resend} />
      {panel.errorBd && (
        <p className={styles.alert} role="alert">No se pudieron leer las compras o las altas de la base de datos. Recarga la página.</p>
      )}
      {panel.resend.ok && panel.pendientes > 0 && (
        <p className={styles.warn}>
          {panel.pendientes === 1 ? 'Hay 1 correo que no salió' : `Hay ${panel.pendientes} correos que no salieron`}.
          Pulsa «Enviar» en {panel.pendientes === 1 ? 'él' : 'cada uno'}.
        </p>
      )}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Compras</h2>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr><th>Fecha</th><th>Comprador</th><th>Curso</th><th>Correo de compra</th><th /></tr>
            </thead>
            <tbody>
              {panel.compras.length === 0 && (
                <tr><td colSpan={5} className={styles.empty}>Ninguna compra en los últimos {DIAS} días.</td></tr>
              )}
              {panel.compras.map((f) => (
                <tr key={f.ref}>
                  <td className={styles.date}>{fecha(f.at)}</td>
                  <td>
                    <div className={styles.person}>
                      <span className={styles.personName}>{f.nombre ?? 'Sin nombre'}</span>
                      <span className={styles.personEmail}>{f.email || '—'}</span>
                    </div>
                  </td>
                  <td>{f.detalle}</td>
                  <td><Estado fila={f} /></td>
                  <td><Accion fila={f} tipo="compra" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Clases gratis por email</h2>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr><th>Fecha</th><th>Email</th><th>Correo con las dos clases</th><th /></tr>
            </thead>
            <tbody>
              {panel.clasesGratis.length === 0 && (
                <tr><td colSpan={4} className={styles.empty}>Nadie las ha pedido en los últimos {DIAS} días.</td></tr>
              )}
              {panel.clasesGratis.map((f) => (
                <tr key={f.ref}>
                  <td className={styles.date}>{fecha(f.at)}</td>
                  <td className={styles.personEmail}>{f.email}</td>
                  <td><Estado fila={f} /></td>
                  <td><Accion fila={f} tipo="clases" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className={styles.footnote}>
        «Entregado» quiere decir que el servidor de correo de la persona lo aceptó: si dice que no le ha
        llegado, que mire en spam o en Promociones. «No se envía»: compras hechas con la sesión iniciada
        o accesos dados a mano, en los que la web no manda este correo; se puede mandar igual. Las fichas
        de los alumnos están en <Link href="/admin/alumnos">Alumnos</Link>.
      </p>
    </div>
  )
}
