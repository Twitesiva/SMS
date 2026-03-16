
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

// Manually extract env vars from a known location if possible, 
// but since I'm in the project, I'll try to find where they are.
// Usually in .env or src/supabaseClient.js

async function run() {
  const supabaseUrl = 'https://wmslxaaihywzscntolll.supabase.co';
  // I need the key. I can read it from supabaseClient.js
  const clientFile = fs.readFileSync('p:/Twite/Jazz/VijayamExam/supabaseClient.js', 'utf8');
  const keyMatch = clientFile.match(/const supabaseKey = ['"](.+?)['"]/);
  const supabaseKey = keyMatch ? keyMatch[1] : null;

  if (!supabaseKey) {
    fs.writeFileSync('inspect_result.txt', 'Could not find supabaseKey');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data, error } = await supabase.from('subjects').select('id, subject_title, class_id, term').eq('subject_title', 'Mathematics');
  
  if (error) {
    fs.writeFileSync('inspect_result.txt', `Error: ${error.message}`);
  } else {
    fs.writeFileSync('inspect_result.txt', JSON.stringify(data, null, 2));
  }
}

run();
