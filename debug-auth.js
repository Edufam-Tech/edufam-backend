const authService = require('./src/services/authService');
const { query } = require('./src/config/database');

async function debugAuth() {
  try {
    console.log('🔍 Testing authentication flow...');
    
    // Test 1: Find user by email
    console.log('1️⃣ Finding user by email...');
    const userResult = await query(`
      SELECT id, email, role, user_type, school_id, is_active, activation_status,
             first_name, last_name, profile_picture_url, locked_until
      FROM users 
      WHERE email = $1
    `, ['admin@edufam.com']);
    
    if (userResult.rows.length === 0) {
      console.log('❌ User not found');
      return;
    }
    
    const user = userResult.rows[0];
    console.log('✅ User found:', user.email, 'ID:', user.id);
    
    // Test 2: Generate tokens
    console.log('2️⃣ Generating tokens...');
    const tokens = authService.generateTokens(user);
    console.log('✅ Tokens generated');
    
    // Test 3: Verify access token
    console.log('3️⃣ Verifying access token...');
    const decoded = authService.verifyAccessToken(tokens.accessToken);
    console.log('✅ Token verified, userId:', decoded.userId);
    
    // Test 4: Check if user still exists and is active
    console.log('4️⃣ Checking user status...');
    const userCheckResult = await query(`
      SELECT id, email, role, user_type, school_id, is_active, activation_status,
             first_name, last_name, profile_picture_url, locked_until
      FROM users 
      WHERE id = $1
    `, [decoded.userId]);
    
    if (userCheckResult.rows.length === 0) {
      console.log('❌ User not found after token verification');
      return;
    }
    
    const userCheck = userCheckResult.rows[0];
    console.log('✅ User check successful:', userCheck.email);
    
    // Test 5: Set RLS context
    console.log('5️⃣ Setting RLS context...');
    if (userCheck.school_id) {
      await query("SELECT set_config('app.current_school_id', $1, false)", [userCheck.school_id]);
      console.log('✅ School context set');
    }
    await query("SELECT set_config('app.current_user_id', $1, false)", [userCheck.id]);
    console.log('✅ User context set');
    
    console.log('🎉 Authentication flow test passed!');
    
  } catch (error) {
    console.error('❌ Error occurred:', error.message);
    console.error('Stack:', error.stack);
  }
}

debugAuth().then(() => {
  console.log('🎉 Auth debug completed');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Auth debug failed:', error);
  process.exit(1);
}); 