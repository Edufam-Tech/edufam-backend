const { query } = require('./src/config/database');

async function checkUser() {
  try {
    console.log('🔍 Checking if test user exists...');
    
    // Check if user exists
    const result = await query(
      'SELECT id, email, user_type, role, is_active, activation_status FROM users WHERE email = $1',
      ['admin@edufam.com']
    );
    
    if (result.rows.length > 0) {
      const user = result.rows[0];
      console.log('✅ Test user found:');
      console.log('   ID:', user.id);
      console.log('   Email:', user.email);
      console.log('   User Type:', user.user_type);
      console.log('   Role:', user.role);
      console.log('   Is Active:', user.is_active);
      console.log('   Activation Status:', user.activation_status);
    } else {
      console.log('❌ Test user not found');
    }
    
    // Check total users
    const totalUsers = await query('SELECT COUNT(*) as count FROM users');
    console.log('📊 Total users in database:', totalUsers.rows[0].count);
    
  } catch (error) {
    console.error('❌ Database query failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the script
checkUser().then(() => {
  console.log('🎉 Check completed');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Check failed:', error);
  process.exit(1);
}); 