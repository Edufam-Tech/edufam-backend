const bcrypt = require('bcryptjs');
const { query } = require('./src/config/database');

async function createTestUser() {
  try {
    console.log('🔧 Creating test admin user...');
    
    // Check if test user already exists
    const existingUser = await query(
      'SELECT id FROM users WHERE email = $1',
      ['admin@edufam.com']
    );
    
    if (existingUser.rows.length > 0) {
      console.log('✅ Test user already exists');
      return;
    }
    
    // Hash password
    const passwordHash = await bcrypt.hash('TempAdmin123!', 12);
    
    // Create test admin user
    const result = await query(`
      INSERT INTO users (
        email, 
        password_hash, 
        user_type, 
        role, 
        first_name, 
        last_name, 
        is_active, 
        email_verified, 
        activation_status,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      RETURNING id, email, role, user_type
    `, [
      'admin@edufam.com',
      passwordHash,
      'admin_user',
      'super_admin',
      'Test',
      'Admin',
      true,
      true,
      'active'
    ]);
    
    console.log('✅ Test admin user created successfully!');
    console.log('   ID:', result.rows[0].id);
    console.log('   Email:', result.rows[0].email);
    console.log('   Role:', result.rows[0].role);
    console.log('   User Type:', result.rows[0].user_type);
    console.log('');
    console.log('🔐 Login Credentials:');
    console.log('   Email: admin@edufam.com');
    console.log('   Password: TempAdmin123!');
    console.log('');
    console.log('🧪 You can now test the authentication endpoints!');
    
  } catch (error) {
    console.error('❌ Failed to create test user:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the script
createTestUser().then(() => {
  console.log('🎉 Script completed');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Script failed:', error);
  process.exit(1);
}); 