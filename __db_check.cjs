const { createClient } = require('./node_modules/@supabase/supabase-js/dist/index.cjs');

const supabase = createClient(
  'https://umwbzradvbsirsybfxfb.supabase.co',
  'sb_publishable_R8uXSgCyxFK-TpZsFMnIrg_Mkm-MGOD'
);

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
