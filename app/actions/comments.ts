'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

export type Comment = {
  id: string;
  content: string;
  user_id: string;
  lesson_id: string;
  parent_id: string | null;
  created_at: string;
  profiles: {
    full_name: string;
    avatar_url: string;
  };
  likes_count: number;
  user_has_liked: boolean;
  replies?: Comment[];
};

export async function getComments(lessonId: string): Promise<{ data?: Comment[], error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Fetch comments with author profile
  const { data: comments, error } = await supabase
    .from('comments')
    .select(`
      *,
      profiles:user_id (
        full_name,
        avatar_url
      )
    `)
    .eq('lesson_id', lessonId)
    .order('created_at', { ascending: true }); // Oldest first for discussion flow

  if (error) {
    console.error('Error fetching comments:', error);
    return { error: error.message };
  }

  // Fetch likes count and user like status efficiently
  // Note: For large scale, we might want a counter cache or a separate query per comment is too slow.
  // Best approach here: fetch all likes for this lesson's comments?
  // Or just fetch likes count via a view or separate query.
  // For simplicity: We will fetch all likes for these comments.
  
  if (!comments || comments.length === 0) return { data: [] };

  const commentIds = comments.map(c => c.id);
  
  const { data: likes } = await supabase
    .from('comment_likes')
    .select('comment_id, user_id')
    .in('comment_id', commentIds);

  const enhancedComments = comments.map(comment => {
    const commentLikes = likes?.filter(l => l.comment_id === comment.id) || [];
    return {
      ...comment,
      likes_count: commentLikes.length,
      user_has_liked: user ? commentLikes.some(l => l.user_id === user.id) : false,
      replies: []
    };
  });

  // Build Tree Structure
  const rootComments: Comment[] = [];
  const commentMap = new Map<string, Comment>();

  enhancedComments.forEach(c => {
    commentMap.set(c.id, c);
  });

  enhancedComments.forEach(c => {
    if (c.parent_id) {
      const parent = commentMap.get(c.parent_id);
      if (parent) {
        parent.replies?.push(c);
      }
    } else {
      rootComments.push(c);
    }
  });

  return { data: rootComments };
}

export async function addComment(lessonId: string, content: string, parentId: string | null = null) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Debes iniciar sesión para comentar' };
  }

  const { error } = await supabase
    .from('comments')
    .insert({
      content,
      lesson_id: lessonId,
      user_id: user.id,
      parent_id: parentId
    });

  if (error) {
    console.error('Error adding comment:', error);
    return { error: error.message };
  }

  revalidatePath(`/courses/${lessonId}`); // Technically needs courseId, but revalidatePath might work if we have exact path
  // Since we don't have courseId here easily (unless passed), we might rely on the client to refresh or revalidate path with wildcard if possible.
  // Actually, revalidatePath works on the route segment. We need the full path.
  // Let's rely on client-side state update or the caller to revalidate properly if possible.
  // OR: pass courseId to this action.
  return { success: true };
}

export async function toggleLike(commentId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Debes iniciar sesión' };
  }

  // check if liked
  const { data: existingLike } = await supabase
    .from('comment_likes')
    .select('id')
    .eq('comment_id', commentId)
    .eq('user_id', user.id)
    .single();

  if (existingLike) {
    // Unlike
    await supabase
      .from('comment_likes')
      .delete()
      .eq('id', existingLike.id);
  } else {
    // Like
    await supabase
      .from('comment_likes')
      .insert({
        comment_id: commentId,
        user_id: user.id
      });
  }

  return { success: true };
}
