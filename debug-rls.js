const { query } = require('./src/config/database');

async function debugRLS() {
  try {
    console.log('🔍 Testing RLS context setting...');
    
    // Test 1: Check if we can set application variables
    console.log('1️⃣ Testing application variable setting...');
    
    // Try different approaches
    try {
      await query("SET LOCAL app.current_user_id = '45f754b1-abcf-4fdc-8cfc-344a2fffdd71'");
      console.log('✅ SET LOCAL with string value successful');
    } catch (error) {
      console.log('❌ SET LOCAL with string failed:', error.message);
    }
    
    try {
      await query("SET app.current_user_id = '45f754b1-abcf-4fdc-8cfc-344a2fffdd71'");
      console.log('✅ SET with string value successful');
    } catch (error) {
      console.log('❌ SET with string failed:', error.message);
    }
    
    try {
      await query("SELECT set_config('app.current_user_id', '45f754b1-abcf-4fdc-8cfc-344a2fffdd71', false)");
      console.log('✅ set_config function successful');
    } catch (error) {
      console.log('❌ set_config function failed:', error.message);
    }
    
    // Test 2: Check if the variable is set
    console.log('2️⃣ Checking if variable is set...');
    try {
      const result = await query("SELECT current_setting('app.current_user_id', true) as user_id");
      console.log('✅ Variable check successful:', result.rows[0].user_id);
    } catch (error) {
      console.log('❌ Variable check failed:', error.message);
    }
    
    // Test 3: Test a simple query that uses RLS
    console.log('3️⃣ Testing RLS query...');
    try {
      const userResult = await query(`
        SELECT id, email, role, user_type, school_id, is_active, activation_status,
               first_name, last_name, profile_picture_url, locked_until
        FROM users 
        WHERE email = $1
      `, ['admin@edufam.com']);
      
      if (userResult.rows.length > 0) {
        console.log('✅ RLS query successful:', userResult.rows[0].email);
      } else {
        console.log('❌ No user found with RLS');
      }
    } catch (error) {
      console.log('❌ RLS query failed:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Error occurred:', error.message);
    console.error('Stack:', error.stack);
  }
}

debugRLS().then(() => {
  console.log('🎉 RLS debug completed');
  process.exit(0);
}).catch((error) => {
  console.error('💥 RLS debug failed:', error);
  process.exit(1);
}); 