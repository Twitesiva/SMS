
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function run() {
  try {
    const clientPath = 'p:/Twite/Jazz/VijayamExam/src/supabaseClient.js';
    const clientFile = fs.readFileSync(clientPath, 'utf8');
    const urlMatch = clientFile.match(/const supabaseUrl = ['"](.+?)['"]/);
    const keyMatch = clientFile.match(/const supabaseKey = ['"](.+?)['"]/);
    
    const supabaseUrl = urlMatch ? urlMatch[1] : null;
    const supabaseKey = keyMatch ? keyMatch[1] : null;

    if (!supabaseUrl || !supabaseKey) {
      fs.writeFileSync('inspect_v3_result.txt', 'Missing URL or Key');
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supabase.from('subjects').select('subject_title, class_id, term').eq('subject_title', 'Mathematics');
    
    if (error) {
      fs.writeFileSync('inspect_v3_result.txt', `Error: ${error.message}`);
    } else {
      fs.writeFileSync('inspect_v3_result.txt', JSON.stringify(data, null, 2));
    }
  } catch (err) {
    fs.writeFileSync('inspect_v3_result.txt', `Fatal: ${err.message}`);
  }
}

run();
