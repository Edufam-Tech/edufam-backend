const { query, getClient, closePool } = require('./src/config/database');
const authService = require('./src/services/authService');

async function debugConnectionContext() {
  console.log('🔍 Debugging Connection Context Issues...\n');
  
  try {
    // Test 1: Check if RLS context persists across queries in same connection
    console.log('1. Testing RLS context persistence...');
    
    const client = await getClient();
    try {
      // Set context in this client
      await client.query("SELECT set_config('app.current_user_id', $1, false)", ['45f754b1-abcf-4fdc-8cfc-344a2fffdd71']);
      console.log('✅ Set RLS context');
      
      // Check context in same client
      const result1 = await client.query("SELECT current_setting('app.current_user_id', true) as user_id");
      console.log('Same client context:', result1.rows[0].user_id);
      
      // Test failed login tracking in same client
      await client.query(`
        UPDATE users 
        SET failed_login_attempts = failed_login_attempts + 1
        WHERE id = $1
        RETURNING failed_login_attempts
      `, ['45f754b1-abcf-4fdc-8cfc-344a2fffdd71']);
      console.log('✅ Failed login tracking works in same client');
      
    } finally {
      client.release();
    }

    // Test 2: Check if RLS context is lost with pool queries
    console.log('\n2. Testing pool query context loss...');
    
    // Set context with pool query
    await query("SELECT set_config('app.current_user_id', $1, false)", ['45f754b1-abcf-4fdc-8cfc-344a2fffdd71']);
    console.log('✅ Set RLS context with pool');
    
    // Check context with another pool query
    const result2 = await query("SELECT current_setting('app.current_user_id', true) as user_id");
    console.log('Pool query context:', result2.rows[0].user_id);
    
    // Test failed login tracking with pool query
    try {
      await query(`
        UPDATE users 
        SET failed_login_attempts = failed_login_attempts + 1
        WHERE id = $1
        RETURNING failed_login_attempts
      `, ['45f754b1-abcf-4fdc-8cfc-344a2fffdd71']);
      console.log('✅ Failed login tracking works with pool');
    } catch (error) {
      console.log('❌ Failed login tracking failed with pool:', error.message);
    }

    // Test 3: Check authService setUserContext implementation
    console.log('\n3. Testing authService setUserContext...');
    
    await authService.setUserContext('45f754b1-abcf-4fdc-8cfc-344a2fffdd71');
    console.log('✅ Called authService.setUserContext');
    
    const result3 = await query("SELECT current_setting('app.current_user_id', true) as user_id");
    console.log('Context after authService:', result3.rows[0].user_id);
    
    // Test failed login with authService context
    try {
      await authService.trackFailedLogin('45f754b1-abcf-4fdc-8cfc-344a2fffdd71');
      console.log('✅ authService.trackFailedLogin works');
    } catch (error) {
      console.log('❌ authService.trackFailedLogin failed:', error.message);
    }

  } catch (error) {
    console.error('❌ Debug failed:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await closePool();
  }
}

debugConnectionContext();