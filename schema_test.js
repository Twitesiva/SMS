
import { supabase } from './supabaseClient.js';
import fs from 'fs';

async function checkSchema() {
  const { data, error } = await supabase.rpc('get_table_info', { tname: 'class_sections' }); 
  // If rpc doesn't exist, try a direct query on pg_catalog if allowed, but usually not.
  // Instead, let's just use query filters to test relation names.
  
  const results = [];
  
  // Test 1: classes -> class_sections
  const { error: e1 } = await supabase.from('classes').select('class_sections(id)').limit(1);
  results.push(`classes -> class_sections: ${e1 ? e1.message : 'OK'}`);
  
  // Test 2: class_sections -> sections
  const { error: e2 } = await supabase.from('class_sections').select('sections(id)').limit(1);
  results.push(`class_sections -> sections: ${e2 ? e2.message : 'OK'}`);

  // Test 3: class_sections -> section_id (sometimes relation is named after FK column)
  const { error: e3 } = await supabase.from('class_sections').select('section_id(id)').limit(1);
  results.push(`class_sections -> section_id: ${e3 ? e3.message : 'OK'}`);

  fs.writeFileSync('schema_test.txt', results.join('\n'));
}
checkSchema();
