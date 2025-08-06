const { query, closePool } = require('./src/config/database');
const authService = require('./src/services/authService');

async function fixAdminPassword() {
  console.log('🔧 Fixing Admin Password for Tests...\n');
  
  try {
    // The password that tests expect
    const expectedPassword = 'TempAdmin123!';
    
    console.log('1. Hashing the expected password...');
    const hashedPassword = await authService.hashPassword(expectedPassword);
    console.log('✅ Password hashed successfully');
    
    console.log('2. Updating admin user password...');
    const result = await query(`
      UPDATE users 
      SET password_hash = $1, password_changed_at = NOW()
      WHERE email = 'admin@edufam.com' AND user_type = 'admin_user'
      RETURNING id, email
    `, [hashedPassword]);
    
    if (result.rows.length > 0) {
      console.log('✅ Admin password updated successfully');
      console.log('   User ID:', result.rows[0].id);
      console.log('   Email:', result.rows[0].email);
      console.log('   New password:', expectedPassword);
    } else {
      console.log('❌ No admin user found to update');
    }
    
    console.log('\n3. Testing the new password...');
    const user = await query('SELECT password_hash FROM users WHERE email = $1', ['admin@edufam.com']);
    const isValid = await authService.verifyPassword(expectedPassword, user.rows[0].password_hash);
    console.log('✅ Password verification:', isValid);
    
  } catch (error) {
    console.error('❌ Failed to fix admin password:', error.message);
  } finally {
    await closePool();
  }
}

fixAdminPassword();