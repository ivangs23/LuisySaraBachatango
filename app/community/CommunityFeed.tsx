'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import styles from './community.module.css';

type Post = {
  id: string;
  title: string;
  content: string;
  created_at: string;
  profiles: {
    full_name: string | null;
  } | null;
  category?: string; // Optional for now
};

const CATEGORIES = ["Todos", "General", "Dudas de Clase", "Música", "Eventos", "Quedadas"];

export default function CommunityFeed({ initialPosts }: { initialPosts: Post[] }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');

  const filteredPosts = useMemo(() => {
    return initialPosts.filter(post => {
      const matchesSearch = 
        post.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
        post.content.toLowerCase().includes(searchTerm.toLowerCase());
      
      // For now, since we don't have categories in DB, we ignore category filter or implement dummy logic
      const matchesCategory = selectedCategory === 'Todos' || true; 

      return matchesSearch && matchesCategory;
    });
  }, [initialPosts, searchTerm, selectedCategory]);

  return (
    <div>
      {/* Search and Filter Section */}
      <div className={styles.filterSection}>
        <div className={styles.searchWrapper}>
          <input 
            type="text" 
            placeholder="Buscar en la comunidad..." 
            className={styles.searchInput}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <svg className={styles.searchIcon} xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        </div>
        
        <div className={styles.categories}>
          {CATEGORIES.map(cat => (
            <button 
              key={cat} 
              className={`${styles.categoryChip} ${selectedCategory === cat ? styles.activeChip : ''}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.postList}>
        {filteredPosts.map((post) => (
          <Link key={post.id} href={`/community/${post.id}`} className={styles.postCard}>
            <div className={styles.cardHeader}>
               {/* Avatar Placeholder */}
               <div className={styles.avatarMini}>
                  {post.profiles?.full_name?.[0]?.toUpperCase() || 'U'}
               </div>
               <div className={styles.headerInfo}>
                  <h2 className={styles.postTitle}>{post.title}</h2>
                  <div className={styles.postMeta}>
                    <span className={styles.authorName}>{post.profiles?.full_name || 'Usuario'}</span>
                    <span className={styles.dot}>•</span>
                    <span>{new Date(post.created_at).toLocaleDateString()}</span>
                  </div>
               </div>
            </div>
            
            <p className={styles.postContent}>{post.content.substring(0, 150)}...</p>
            
            <div className={styles.cardFooter}>
              {/* Fake stats for now to show visual improvement */}
              <span className={styles.interaction}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                Ver discusión
              </span>
            </div>
          </Link>
        ))}

        {filteredPosts.length === 0 && (
          <div className={styles.emptyState}>
            <p>No se encontraron resultados para "{searchTerm}"</p>
          </div>
        )}
      </div>
    </div>
  );
}
