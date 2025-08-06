const { query } = require('./src/config/database');

async function testLoginQuery() {
  try {
    console.log('🔍 Testing login query...');
    
    const email = 'admin@edufam.com';
    const userType = 'admin_user';
    
    // Test the exact query from userService.findUserByEmail
    let sql = `
      SELECT id, email, password_hash, role, user_type, school_id, 
             first_name, last_name, is_active, activation_status, 
             failed_login_attempts, locked_until, profile_picture_url
      FROM users 
      WHERE email = $1
    `;
    
    const params = [email.toLowerCase()];
    
    if (userType) {
      sql += ' AND user_type = $2';
      params.push(userType);
    }
    
    console.log('SQL Query:', sql);
    console.log('Parameters:', params);
    
    const result = await query(sql, params);
    
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
      console.log('  Has Password Hash:', !!user.password_hash);
    }
    
  } catch (error) {
    console.error('❌ Query failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the script
testLoginQuery().then(() => {
  console.log('🎉 Test completed');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Test failed:', error);
  process.exit(1);
}); 