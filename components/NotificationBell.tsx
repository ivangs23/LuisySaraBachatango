'use client';

import { useState, useEffect, useRef } from 'react';
import { useClickOutside } from '@/hooks/useClickOutside';
import styles from './NotificationBell.module.css';
import { createClient } from '@/utils/supabase/client';

type Notification = {
  id: string;
  title: string;
  is_read: boolean;
};

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  useClickOutside(dropdownRef, () => {
    if (isOpen) setIsOpen(false);
  });

  useEffect(() => {
    async function fetchNotifications() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_read', false)
        .order('created_at', { ascending: false });

      if (data) {
        setNotifications(data);
      }
    }

    fetchNotifications();
    
    // Realtime subscription could go here
  }, [supabase]);

  const unreadCount = notifications.length;

  return (
    <div className={styles.container} ref={dropdownRef}>
      <button className={styles.bell} onClick={() => setIsOpen(!isOpen)} aria-label="Notificaciones">
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          width="24" 
          height="24" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          className="lucide lucide-bell"
          style={{ display: 'block' }} // Ensure it behaves block-like inside button
        >
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unreadCount > 0 && <span className={styles.badge}>{unreadCount}</span>}
      </button>

      {isOpen && (
        <div className={styles.dropdown}>
          <h3 className={styles.title}>Notificaciones</h3>
          {notifications.length === 0 ? (
            <p className={styles.empty}>No tienes notificaciones nuevas.</p>
          ) : (
            <ul className={styles.list}>
              {notifications.map((notif) => (
                <li key={notif.id} className={styles.item}>
                  {notif.title}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
