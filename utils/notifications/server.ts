import { createSupabaseAdmin } from '@/utils/supabase/admin'

export type NotifyInput = {
  recipientId: string
  actorId: string
  type:
    | 'comment_like'
    | 'comment_reply'
    | 'post_comment'
    | 'post_like'
    | 'assignment_graded'
  entityType: 'comment' | 'post' | 'submission'
  entityId: string
  link: string
}

export async function notify(input: NotifyInput): Promise<void> {
  if (input.recipientId === input.actorId) return

  const supabase = createSupabaseAdmin()
  const { error } = await supabase.rpc('upsert_notification', {
    recipient_id: input.recipientId,
    actor_id: input.actorId,
    n_type: input.type,
    ent_type: input.entityType,
    ent_id: input.entityId,
    n_link: input.link,
  })

  if (error) {
    console.error('notify() failed:', error)
  }
}
