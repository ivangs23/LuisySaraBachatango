'use client'
import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deletePost } from './actions'

export default function DeletePostBtn({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  function handle() {
    if (!confirm('¿Eliminar este post? Esta acción no se puede deshacer.')) return
    startTransition(async () => { await deletePost(id); router.refresh() })
  }
  return (
    <button
      onClick={handle}
      disabled={isPending}
      style={{ background: 'transparent', border: 0, color: 'rgba(180, 60, 60, 1)', fontSize: '0.82rem', cursor: 'pointer', padding: 0 }}
    >
      {isPending ? 'Eliminando…' : 'Eliminar'}
    </button>
  )
}
