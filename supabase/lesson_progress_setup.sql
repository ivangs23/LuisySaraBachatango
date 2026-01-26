
-- Create a table for Lesson Progress
create table if not exists lesson_progress (
  user_id uuid references auth.users(id) on delete cascade not null,
  lesson_id uuid references lessons(id) on delete cascade not null,
  is_completed boolean default false,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (user_id, lesson_id)
);

alter table lesson_progress enable row level security;

create policy "Users can view own progress." on lesson_progress
  for select using (auth.uid() = user_id);

create policy "Users can insert own progress." on lesson_progress
  for insert with check (auth.uid() = user_id);

create policy "Users can update own progress." on lesson_progress
  for update using (auth.uid() = user_id);
