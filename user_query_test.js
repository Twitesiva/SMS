
import { supabase } from './supabaseClient.js';
import fs from 'fs';

async function testUserQuery() {
  const { data, error } = await supabase
    .from("classes")
    .select("id,class_name,sections(id,section_name,group_id)");
  
  fs.writeFileSync('user_query_test.txt', error ? `ERROR: ${error.message}` : `OK: ${data.length} rows`);
}
testUserQuery();
