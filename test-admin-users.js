require('dotenv').config();
const { query } = require('./src/config/database');

async function checkAdminUsers() {
  try {
    console.log('🔍 Checking for admin users...');
    
    const result = await query(`
      SELECT id, email, user_type, role, is_active, activation_status, created_at
      FROM users 
      WHERE user_type = $1
      ORDER BY created_at DESC
    `, ['admin_user']);
    
    console.log(`📊 Found ${result.rows.length} admin users:`);
    
    if (result.rows.length === 0) {
      console.log('❌ No admin users found! This is likely the cause of the login issue.');
      console.log('💡 You need to create an admin user first.');
    } else {
      result.rows.forEach((user, index) => {
        console.log(`\n${index + 1}. Admin User:`);
        console.log(`   ID: ${user.id}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Role: ${user.role}`);
        console.log(`   Active: ${user.is_active}`);
        console.log(`   Activation Status: ${user.activation_status}`);
        console.log(`   Created: ${user.created_at}`);
      });
    }
    
    // Also check all users to see what we have
    console.log('\n🔍 Checking all users...');
    const allUsers = await query(`
      SELECT id, email, user_type, role, is_active, activation_status
      FROM users 
      ORDER BY created_at DESC
      LIMIT 10
    `);
    
    console.log(`📊 Total users in database: ${allUsers.rows.length}`);
    allUsers.rows.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email} (${user.user_type}, ${user.role}) - Active: ${user.is_active}`);
    });
    
  } catch (error) {
    console.error('❌ Error checking admin users:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    process.exit(0);
  }
}

checkAdminUsers();
