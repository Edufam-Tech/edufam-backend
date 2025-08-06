const userService = require('./src/services/userService');
const { query } = require('./src/config/database');

async function debugUserService() {
  try {
    console.log('🔍 Testing userService methods...');
    
    // Test 1: Check if we can query the database directly
    console.log('1️⃣ Testing direct database query...');
    const testResult = await query('SELECT COUNT(*) as count FROM users');
    console.log('✅ Direct query successful:', testResult.rows[0].count, 'users found');
    
    // Test 2: Test findUserByEmail
    console.log('2️⃣ Testing findUserByEmail...');
    const userByEmail = await userService.findUserByEmail('admin@edufam.com', 'admin_user');
    if (userByEmail) {
      console.log('✅ findUserByEmail successful:', userByEmail.email);
    } else {
      console.log('❌ User not found by email');
      return;
    }
    
    // Test 3: Test findUserById
    console.log('3️⃣ Testing findUserById...');
    const userById = await userService.findUserById(userByEmail.id);
    if (userById) {
      console.log('✅ findUserById successful:', userById.email);
    } else {
      console.log('❌ User not found by ID');
    }
    
    // Test 4: Test sanitizeUser
    console.log('4️⃣ Testing sanitizeUser...');
    const sanitizedUser = userService.sanitizeUser(userById);
    console.log('✅ sanitizeUser successful:', Object.keys(sanitizedUser));
    
    console.log('🎉 All tests passed!');
    
  } catch (error) {
    console.error('❌ Error occurred:', error.message);
    console.error('Stack:', error.stack);
  }
}

debugUserService().then(() => {
  console.log('🎉 Debug completed');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Debug failed:', error);
  process.exit(1);
}); 