
import { createClient } from '@supabase/supabase-js';
const supabaseUrl = 'https://wmslxaaihywzscntolll.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indtc2x4YWFpaHl3enNjbnRvbGxsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNzg3MTksImV4cCI6MjA4ODk1NDcxOX0.p7cJAesCZWRjJH7RRef8pm8_mmkmgo0OmYxl5W2ivu0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumn() {
  const { data, error } = await supabase
    .from('timetable_session_classes')
    .select('group_id')
    .limit(1);

  if (error) {
    if (error.code === 'PGRST204' || error.message.includes('column does not exist')) {
        console.log('COLUMN_NOT_FOUND');
    } else {
        console.error('Error:', error);
    }
    return;
  }
  console.log('COLUMN_EXISTS');
}

checkColumn();
