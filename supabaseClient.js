// src/lib/supabaseClient.js
import { createClient } from '@supabase/supabase-js'

// ✅ Replace these with your actual project values
const supabaseUrl = 'https://mnhpvhvtihxtmlbmovpz.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1uaHB2aHZ0aWh4dG1sYm1vdnB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMzExMzUsImV4cCI6MjA4NDcwNzEzNX0.guiXVrebWm0S2G9Wb-KuP-n5QmmdZodzw8WenHZtsKw'

// Initialize Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
