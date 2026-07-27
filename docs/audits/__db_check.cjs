const { createClient } = require('./node_modules/@supabase/supabase-js/dist/index.cjs');

// LR-1 — credentials from the environment, never committed.
//   VITE_SUPABASE_URL=https://<ref>.supabase.co VITE_SUPABASE_ANON_KEY=<key> node __db_check.cjs
const URL = process.env.VITE_SUPABASE_URL || '';
const KEY = process.env.VITE_SUPABASE_ANON_KEY || '';
if (!URL || !KEY) {
  process.stdout.write('Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY before running.\n');
  process.exit(1);
}
const supabase = createClient(URL, KEY);

async function run() {
  const tables = [
    'roles','user_roles','customers','drivers','merchants',
    'merchant_branches','orders','products','categories',
    'driver_earnings','payment_transactions','support_tickets','app_config'
  ];
  
  for (const t of tables) {
    const { count, error } = await supabase.from(t).select('*', { count: 'exact', head: true });
    if (error) {
      process.stdout.write(t + ' | ERROR | code=' + (error.code||'') + ' | ' + error.message + '\n');
    } else {
      process.stdout.write(t + ' | EXISTS | count=' + count + '\n');
    }
  }
}

run().catch(e => process.stdout.write('FATAL: ' + e.message + '\n'));
