import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://rowqvgjzsoaptmqujluw.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJvd3F2Z2p6c29hcHRtcXVqbHV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2NjYwNTAsImV4cCI6MjA5NDI0MjA1MH0.FfL7Ut9krwordccdZ7heo_2NaZ6adnDJbiluwJAmRh8'

export const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
