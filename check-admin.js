const { query, closePool } = require('./src/config/database');

async function checkAdmin() {
  try {
    console.log('Checking admin user details...\n');
    
    // Check all admin users
    const result = await query(`
      SELECT id, email, password_hash, user_type, role, is_active, activation_status, created_at 
      FROM users 
      WHERE user_type = 'admin_user' 
      ORDER BY created_at
    `);
    
    console.log(`Found ${result.rows.length} admin users:`);
    result.rows.forEach((user, index) => {
      console.log(`\n${index + 1}. Admin User:`);
      console.log('   ID:', user.id);
      console.log('   Email:', user.email);
      console.log('   Role:', user.role);
      console.log('   Active:', user.is_active);
      console.log('   Status:', user.activation_status);
      console.log('   Password hash:', user.password_hash ? `${user.password_hash.length} chars` : 'NULL');
      console.log('   Created:', user.created_at);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await closePool();
  }
}

checkAdmin();