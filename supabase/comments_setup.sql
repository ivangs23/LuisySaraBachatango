-- Create Comments Table
create table if not exists public.comments (
  id uuid default gen_random_uuid() primary key,
  content text not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  lesson_id uuid references public.lessons(id) on delete cascade not null,
  parent_id uuid references public.comments(id) on delete cascade,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.comments enable row level security;

-- Policies
create policy "Comments are viewable by everyone" 
  on public.comments for select 
  using (true);

create policy "Authenticated users can create comments" 
  on public.comments for insert 
  with check (auth.role() = 'authenticated');

create policy "Users can delete their own comments" 
  on public.comments for delete 
  using (auth.uid() = user_id);

-- Create Comment Likes Table
create table if not exists public.comment_likes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  comment_id uuid references public.comments(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, comment_id)
);

-- Enable RLS
alter table public.comment_likes enable row level security;

-- Policies
create policy "Likes are viewable by everyone" 
  on public.comment_likes for select 
  using (true);

create policy "Authenticated users can toggle likes" 
  on public.comment_likes for insert 
  with check (auth.role() = 'authenticated');

create policy "Users can remove their likes" 
  on public.comment_likes for delete 
  using (auth.uid() = user_id);
