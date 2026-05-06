'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useClickOutside } from '@/hooks/useClickOutside';
import styles from './NotificationBell.module.css';
import { createClient } from '@/utils/supabase/client';
import { markAsRead, markAllRead } from '@/app/actions/notifications';

type NotificationRow = {
  id: string;
  type: string;
  title: string | null;
  message: string | null;
  link: string | null;
  is_read: boolean;
  actor_name: string | null;
  actor_avatar: string | null;
  actor_count: number | null;
  updated_at: string;
};

function renderText(n: NotificationRow): string {
  const others = (n.actor_count ?? 1) - 1;
  const namePart = n.actor_name ?? 'Alguien';
  const suffix = others > 0 ? ` y ${others} más` : '';
  switch (n.type) {
    case 'comment_like':
      return `${namePart}${suffix} dio like a tu comentario`;
    case 'comment_reply':
      return `${namePart} respondió a tu comentario`;
    case 'post_comment':
      return `${namePart} comentó tu publicación`;
    case 'post_like':
      return `${namePart}${suffix} dio like a tu publicación`;
    case 'assignment_graded':
      return n.title ?? 'Tu tarea ha sido corregida';
    default:
      return n.title ?? n.message ?? 'Notificación';
  }
}

export default function NotificationBell() {
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const supabase = createClient();

  useClickOutside(dropdownRef, () => {
    if (isOpen) setIsOpen(false);
  });

  const fetchAll = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('notifications_with_actor')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(20);
    if (data) setItems(data as NotificationRow[]);
  };

  useEffect(() => {
    let cancelled = false;
    let cleanupChannel: (() => void) | null = null;

    // Fallback poll every 5 min in case Realtime fails to connect.
    const fallbackInterval = setInterval(() => {
      if (!cancelled) fetchAll();
    }, 5 * 60 * 1000);

    (async () => {
      await fetchAll();
      if (cancelled) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      const channel = supabase
        .channel(`notifications:${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            if (!cancelled) fetchAll();
          }
        )
        .subscribe();

      cleanupChannel = () => {
        supabase.removeChannel(channel);
      };
    })();

    return () => {
      cancelled = true;
      clearInterval(fallbackInterval);
      if (cleanupChannel) cleanupChannel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const unreadCount = items.filter(i => !i.is_read).length;

  const handleClick = async (n: NotificationRow) => {
    setItems(prev => prev.map(i => i.id === n.id ? { ...i, is_read: true } : i));
    await markAsRead(n.id);
    setIsOpen(false);
    if (n.link) router.push(n.link);
  };

  const handleMarkAll = async () => {
    setItems(prev => prev.map(i => ({ ...i, is_read: true })));
    await markAllRead();
  };

  return (
    <div className={styles.container} ref={dropdownRef}>
      <button className={styles.bell} onClick={() => setIsOpen(!isOpen)} aria-label="Notificaciones">
        <svg
          xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ display: 'block' }}
        >
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unreadCount > 0 && <span className={styles.badge}>{unreadCount}</span>}
      </button>

      {isOpen && (
        <div className={styles.dropdown}>
          <div className={styles.header}>
            <h3 className={styles.title}>Notificaciones</h3>
            {unreadCount > 0 && (
              <button className={styles.markAllBtn} onClick={handleMarkAll}>
                Marcar todas como leídas
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <p className={styles.empty}>No tienes notificaciones nuevas.</p>
          ) : (
            <ul className={styles.list}>
              {items.map((n) => (
                <li
                  key={n.id}
                  className={`${styles.item} ${!n.is_read ? styles.unread : ''}`}
                  onClick={() => handleClick(n)}
                  role="button"
                  tabIndex={0}
                >
                  {renderText(n)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
