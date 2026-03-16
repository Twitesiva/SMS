
import { supabase } from './supabaseClient.js';
import fs from 'fs';

async function check() {
  const result = [];
  try {
    const tables = ['classes', 'sections', 'groups', 'class_sections'];
    for (const t of tables) {
      const { data, error } = await supabase.from(t).select().limit(1);
      if (error) {
        result.push(`${t}: ERROR - ${error.message}`);
      } else {
        const cols = data.length > 0 ? Object.keys(data[0]) : 'EMPTY TABLE';
        result.push(`${t}: ${Array.isArray(cols) ? cols.join(', ') : cols}`);
      }
    }
  } catch (e) {
    result.push(`FATAL: ${e.message}`);
  }
  fs.writeFileSync('db_check_results.txt', result.join('\n'));
  process.exit(0);
}
check();
