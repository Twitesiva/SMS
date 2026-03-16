
import { supabase } from './supabaseClient.js';
import fs from 'fs';

async function check() {
  const result = [];
  try {
    // We can't directly check constraints via RPC if it's not enabled, 
    // but we can try to find duplicate handling or check the table columns/indexes if possible.
    // However, the error message already told us the constraint name: subjects_subject_name_key on subject_title.
    
    // Let's check what's in the table currently for "Mathematics"
    const { data, error } = await supabase.from('subjects').select('id, subject_title, class_id, term').eq('subject_title', 'Mathematics');
    if (error) {
       result.push(`ERROR: ${error.message}`);
    } else {
       result.push(`Existing Mathematics subjects: ${JSON.stringify(data, null, 2)}`);
    }

    // Since I can't easily DROP CONSTRAINT via Supabase client without a Postgres function,
    // I should check if I can rename the subject to test if it's indeed the title or the combination.
    // But the error is very specific: "Key (subject_title)=(Mathematics) already exists."
    
  } catch (e) {
    result.push(`FATAL: ${e.message}`);
  }
  fs.writeFileSync('subjects_inspect.txt', result.join('\n'));
  process.exit(0);
}
check();
