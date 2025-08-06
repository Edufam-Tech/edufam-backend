const { query } = require('./src/config/database');

async function testFindUserById() {
  try {
    console.log('🔍 Testing findUserById query...');
    
    // First get the user ID
    const userResult = await query(
      'SELECT id FROM users WHERE email = $1',
      ['admin@edufam.com']
    );
    
    if (userResult.rows.length === 0) {
      console.log('❌ User not found');
      return;
    }
    
    const userId = userResult.rows[0].id;
    console.log('User ID:', userId);
    
    // Test the exact query from userService.findUserById
    const sql = `
      SELECT id, email, role, user_type, school_id, first_name, last_name,
             is_active, activation_status, profile_picture_url, phone,
             created_at, last_login, email_verified
      FROM users 
      WHERE id = $1
    `;
    
    console.log('SQL Query:', sql);
    console.log('Parameter:', userId);
    
    const result = await query(sql, [userId]);
    
    console.log('Query result:');
    console.log('Rows found:', result.rows.length);
    
    if (result.rows.length > 0) {
      const user = result.rows[0];
      console.log('User data:');
      console.log('  ID:', user.id);
      console.log('  Email:', user.email);
      console.log('  User Type:', user.user_type);
      console.log('  Role:', user.role);
      console.log('  Is Active:', user.is_active);
      console.log('  Activation Status:', user.activation_status);
      console.log('  Created At:', user.created_at);
      console.log('  Last Login:', user.last_login);
      console.log('  Email Verified:', user.email_verified);
    }
    
  } catch (error) {
    console.error('❌ Query failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the script
testFindUserById().then(() => {
  console.log('🎉 Test completed');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Test failed:', error);
  process.exit(1);
}); 