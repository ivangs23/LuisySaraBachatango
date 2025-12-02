-- 1. Create a table for public profiles
create table if not exists profiles (
  id uuid references auth.users on delete cascade not null primary key,
  email text,
  full_name text,
  avatar_url text,
  updated_at timestamp with time zone
);

-- 2. Set up Row Level Security (RLS) for Profiles
alter table profiles enable row level security;

create policy "Public profiles are viewable by everyone." on profiles
  for select using (true);

create policy "Users can insert their own profile." on profiles
  for insert with check (auth.uid() = id);

create policy "Users can update own profile." on profiles
  for update using (auth.uid() = id);

-- 3. Create a table for Courses
create table if not exists courses (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text,
  image_url text,
  month integer not null, -- 1-12
  year integer not null,
  is_published boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table courses enable row level security;

create policy "Courses are viewable by everyone." on courses
  for select using (true);

-- 4. Create a table for Lessons
create table if not exists lessons (
  id uuid default gen_random_uuid() primary key,
  course_id uuid references courses(id) on delete cascade not null,
  title text not null,
  description text,
  video_url text not null,
  thumbnail_url text,
  release_date timestamp with time zone,
  "order" integer not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table lessons enable row level security;

create policy "Lessons are viewable by everyone." on lessons
  for select using (true);

-- 5. Create a table for Subscriptions (Synced with Stripe)
create table if not exists subscriptions (
  id text primary key, -- Stripe Subscription ID
  user_id uuid references auth.users(id) on delete cascade not null,
  status text not null,
  current_period_start timestamp with time zone,
  current_period_end timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table subscriptions enable row level security;

create policy "Users can view own subscription." on subscriptions
  for select using (auth.uid() = user_id);

-- 6. Create a table for Notifications
create table if not exists notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  message text,
  is_read boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table notifications enable row level security;

create policy "Users can view own notifications." on notifications
  for select using (auth.uid() = user_id);

create policy "Users can update own notifications." on notifications
  for update using (auth.uid() = user_id);

-- 7. Function to handle new user signup (Trigger)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$ language plpgsql security definer;

-- 8. Trigger the function every time a user is created
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
