
import { supabase } from './supabaseClient.js';
import fs from 'fs';

async function check() {
  const result = [];
  try {
    const { data, error } = await supabase.from('staff_subjects').select().limit(1);
    if (error) {
      result.push(`ERROR: ${error.message}`);
    } else {
      const cols = data.length > 0 ? Object.keys(data[0]) : 'EMPTY TABLE';
      result.push(`staff_subjects cols: ${Array.isArray(cols) ? cols.join(', ') : cols}`);
    }
  } catch (e) {
    result.push(`FATAL: ${e.message}`);
  }
  fs.writeFileSync('staff_subjects_check.txt', result.join('\n'));
  process.exit(0);
}
check();
