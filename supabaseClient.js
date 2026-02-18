// src/lib/supabaseClient.js
import { createClient } from '@supabase/supabase-js'

// ✅ Replace these with your actual project values
const supabaseUrl = 'https://pedgdgqghjevxjawrksx.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBlZGdkZ3FnaGpldnhqYXdya3N4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzOTE5MTAsImV4cCI6MjA4Njk2NzkxMH0.Y1ZFgl3uM1-WoZ4Aiv8NuoQjungW_He7NGnHG4InsdE'

// Initialize Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
