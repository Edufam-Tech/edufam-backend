const { query, pool } = require('./src/config/database');

async function checkSchemaConflict() {
  try {
    console.log('Checking existing schools table structure...');
    
    const result = await query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'schools' 
      ORDER BY ordinal_position
    `);
    
    console.log('Schools table columns:');
    result.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type}`);
    });
    
    // Check if subscription_status exists
    const hasSubscriptionStatus = result.rows.some(row => row.column_name === 'subscription_status');
    console.log(`\nHas subscription_status column: ${hasSubscriptionStatus}`);
    
    if (!hasSubscriptionStatus) {
      console.log('\n⚠️  The schools table is missing the subscription_status column.');
      console.log('This is likely causing the migration error.');
    }
    
  } catch (error) {
    console.error('Error checking schema:', error.message);
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

checkSchemaConflict();