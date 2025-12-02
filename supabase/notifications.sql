-- Create a table for Notifications
create table notifications (
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
