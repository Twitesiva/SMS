
import { createClient } from '@supabase/supabase-js';
const supabaseUrl = 'https://wmslxaaihywzscntolll.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indtc2x4YWFpaHl3enNjbnRvbGxsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNzg3MTksImV4cCI6MjA4ODk1NDcxOX0.p7cJAesCZWRjJH7RRef8pm8_mmkmgo0OmYxl5W2ivu0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  const { data, error } = await supabase
    .from('timetable_session_classes')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error:', error);
    return;
  }
  if (data && data.length > 0) {
    console.log('Columns:', Object.keys(data[0]));
  } else {
    console.log('No data in table to infer columns.');
  }
}

checkSchema();
