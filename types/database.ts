export type Profile = {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  updated_at: string | null
  role: 'member' | 'premium' | 'admin'
  stripe_customer_id: string | null
  instagram: string | null
  facebook: string | null
  tiktok: string | null
  youtube: string | null
}

export type Course = {
  id: string
  title: string
  description: string | null
  image_url: string | null
  month: number | null
  year: number | null
  is_published: boolean
  course_type: 'membership' | 'complete'
  category: string | null
  price_eur: number | null
  stripe_price_id: string | null
  created_at: string
}

export type Lesson = {
  id: string
  course_id: string
  title: string
  description: string | null
  thumbnail_url: string | null
  release_date: string | null
  order: number
  duration: number | null
  is_free: boolean
  created_at: string
}


export type Subscription = {
  id: string
  user_id: string
  status: 'active' | 'past_due' | 'canceled' | 'incomplete' | 'incomplete_expired' | 'trialing' | 'unpaid'
  plan_type: string | null
  current_period_start: string | null
  current_period_end: string | null
  created_at: string
}

export type CoursePurchase = {
  id: string
  user_id: string
  course_id: string
  stripe_session_id: string
  amount_paid: number | null
  created_at: string
}

export type Assignment = {
  id: string
  lesson_id: string
  course_id: string
  title: string
  description: string | null
  created_at: string
}

export type Submission = {
  id: string
  assignment_id: string
  user_id: string
  text_content: string | null
  file_url: string | null
  status: 'pending' | 'reviewed'
  grade: string | null
  feedback: string | null
  created_at: string
  updated_at: string
}

export type LessonProgress = {
  user_id: string
  lesson_id: string
  is_completed: boolean
  updated_at: string
}

export type Notification = {
  id: string
  user_id: string
  title: string
  message: string
  is_read: boolean
  created_at: string
}
