const bcrypt = require('bcryptjs');
const { query } = require('./src/config/database');

async function fixUser() {
  try {
    console.log('🔧 Fixing test user account...');
    
    // Hash the password correctly
    const passwordHash = await bcrypt.hash('TempAdmin123!', 12);
    
    // Update user to unlock account and fix password
    const result = await query(`
      UPDATE users 
      SET 
        password_hash = $1,
        failed_login_attempts = 0,
        locked_until = NULL,
        is_active = true,
        activation_status = 'active',
        email_verified = true
      WHERE email = $2
      RETURNING id, email, is_active, activation_status, failed_login_attempts, locked_until
    `, [passwordHash, 'admin@edufam.com']);
    
    if (result.rows.length > 0) {
      const user = result.rows[0];
      console.log('✅ User account fixed:');
      console.log('   ID:', user.id);
      console.log('   Email:', user.email);
      console.log('   Is Active:', user.is_active);
      console.log('   Activation Status:', user.activation_status);
      console.log('   Failed Login Attempts:', user.failed_login_attempts);
      console.log('   Locked Until:', user.locked_until);
      console.log('');
      console.log('🔐 Login Credentials:');
      console.log('   Email: admin@edufam.com');
      console.log('   Password: TempAdmin123!');
      console.log('');
      console.log('🧪 You can now test the authentication endpoints!');
    } else {
      console.log('❌ User not found');
    }
    
  } catch (error) {
    console.error('❌ Failed to fix user:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the script
fixUser().then(() => {
  console.log('🎉 Fix completed');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Fix failed:', error);
  process.exit(1);
}); 