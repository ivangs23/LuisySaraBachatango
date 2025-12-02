-- 1. Create a table for Posts
create table if not exists posts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Enable RLS for Posts
alter table posts enable row level security;

-- 3. Policies for Posts
create policy "Posts are viewable by authenticated users." on posts
  for select using (auth.role() = 'authenticated');

create policy "Authenticated users can insert posts." on posts
  for insert with check (auth.role() = 'authenticated');

create policy "Users can update own posts." on posts
  for update using (auth.uid() = user_id);

create policy "Users can delete own posts." on posts
  for delete using (auth.uid() = user_id);

-- 4. Create a table for Comments
create table if not exists comments (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  post_id uuid references posts(id) on delete cascade not null,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. Enable RLS for Comments
alter table comments enable row level security;

-- 6. Policies for Comments
create policy "Comments are viewable by authenticated users." on comments
  for select using (auth.role() = 'authenticated');

create policy "Authenticated users can insert comments." on comments
  for insert with check (auth.role() = 'authenticated');

create policy "Users can update own comments." on comments
  for update using (auth.uid() = user_id);

create policy "Users can delete own comments." on comments
  for delete using (auth.uid() = user_id);
