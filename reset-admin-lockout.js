const { query, closePool } = require('./src/config/database');

async function resetAdminLockout() {
  console.log('🔓 Resetting Admin Account Lockout...\n');
  
  try {
    // Reset failed login attempts and unlock the admin account
    const result = await query(`
      UPDATE users 
      SET failed_login_attempts = 0, locked_until = NULL
      WHERE email = 'admin@edufam.com'
      RETURNING id, email, failed_login_attempts, locked_until
    `);
    
    if (result.rows.length > 0) {
      const user = result.rows[0];
      console.log('✅ Admin account reset:');
      console.log('   Email:', user.email);
      console.log('   Failed attempts:', user.failed_login_attempts);
      console.log('   Locked until:', user.locked_until);
    } else {
      console.log('❌ No admin user found');
    }
    
  } catch (error) {
    console.error('❌ Failed to reset admin lockout:', error.message);
  } finally {
    await closePool();
  }
}

resetAdminLockout();