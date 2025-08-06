const authService = require('./src/services/authService');
const userService = require('./src/services/userService');

async function testTokenVerification() {
  try {
    console.log('🔍 Testing JWT token verification...');
    
    const email = 'admin@edufam.com';
    const password = 'TempAdmin123!';
    const userType = 'admin_user';
    
    // Step 1: Find user and generate tokens
    console.log('1️⃣ Finding user and generating tokens...');
    const user = await userService.findUserByEmail(email, userType);
    
    if (!user) {
      console.log('❌ User not found');
      return;
    }
    
    const tokens = authService.generateTokens(user);
    console.log('✅ Tokens generated');
    
    // Step 2: Verify access token
    console.log('2️⃣ Verifying access token...');
    const decoded = authService.verifyAccessToken(tokens.accessToken);
    console.log('✅ Access token verified');
    console.log('   User ID:', decoded.userId);
    console.log('   Email:', decoded.email);
    console.log('   Role:', decoded.role);
    console.log('   User Type:', decoded.userType);
    
    // Step 3: Test the exact process from the /me endpoint
    console.log('3️⃣ Testing /me endpoint process...');
    
    // Get current user data (like in the controller)
    const currentUser = await userService.findUserById(decoded.userId);
    console.log('✅ Current user data retrieved');
    console.log('   ID:', currentUser.id);
    console.log('   Email:', currentUser.email);
    
    // Get user's active sessions
    const sessions = await authService.getUserSessions(decoded.userId);
    console.log('✅ User sessions retrieved');
    console.log('   Active Sessions:', sessions.length);
    
    // Sanitize user data
    const sanitizedUser = userService.sanitizeUser(currentUser);
    console.log('✅ User data sanitized');
    console.log('   Sanitized Keys:', Object.keys(sanitizedUser));
    
    console.log('🎉 Token verification and /me process completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the script
testTokenVerification().then(() => {
  console.log('🎉 Test completed');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Test failed:', error);
  process.exit(1);
}); 