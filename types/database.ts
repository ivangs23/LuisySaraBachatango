export type Profile = {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  updated_at: string | null
}

export type Course = {
  id: string
  title: string
  description: string | null
  image_url: string | null
  month: number
  year: number
  is_published: boolean
  created_at: string
}

export type Lesson = {
  id: string
  course_id: string
  title: string
  description: string | null
  video_url: string
  thumbnail_url: string | null
  release_date: string | null
  order: number
  created_at: string
}

export type Subscription = {
  id: string
  user_id: string
  status: 'active' | 'past_due' | 'canceled' | 'incomplete' | 'incomplete_expired' | 'trialing' | 'unpaid'
  current_period_start: string | null
  current_period_end: string | null
  created_at: string
}
