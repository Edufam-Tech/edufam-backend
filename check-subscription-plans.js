const { query, pool } = require('./src/config/database');

async function checkSubscriptionPlans() {
  try {
    const result = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'subscription_plans' 
      ORDER BY ordinal_position
    `);
    
    console.log('subscription_plans table columns:');
    result.rows.forEach(row => console.log('  ' + row.column_name));
    
  } catch(error) {
    console.error('Error:', error.message);
  } finally {
    if(pool) await pool.end();
  }
}

checkSubscriptionPlans();