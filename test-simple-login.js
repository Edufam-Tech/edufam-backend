const authService = require('./src/services/authService');
const userService = require('./src/services/userService');

async function testSimpleLogin() {
  try {
    console.log('🔍 Testing simple login process...');
    
    const email = 'admin@edufam.com';
    const password = 'TempAdmin123!';
    const userType = 'admin_user';
    
    // Step 1: Find user
    console.log('1️⃣ Finding user...');
    const user = await userService.findUserByEmail(email, userType);
    
    if (!user) {
      console.log('❌ User not found');
      return;
    }
    
    console.log('✅ User found:', user.email);
    console.log('   User Type:', user.user_type);
    console.log('   Role:', user.role);
    console.log('   Is Active:', user.is_active);
    console.log('   Activation Status:', user.activation_status);
    
    // Step 2: Check if account is locked
    console.log('2️⃣ Checking account lock status...');
    const isLocked = await authService.isAccountLocked(user.id);
    console.log('   Is Locked:', isLocked);
    
    // Step 3: Verify password
    console.log('3️⃣ Verifying password...');
    const isValidPassword = await authService.verifyPassword(password, user.password_hash);
    console.log('   Password Valid:', isValidPassword);
    
    if (!isValidPassword) {
      console.log('❌ Invalid password');
      return;
    }
    
    // Step 4: Generate tokens
    console.log('4️⃣ Generating tokens...');
    const tokens = authService.generateTokens(user);
    console.log('✅ Tokens generated successfully');
    console.log('   Access Token Length:', tokens.accessToken.length);
    console.log('   Refresh Token Length:', tokens.refreshToken.length);
    console.log('   Expires In:', tokens.expiresIn);
    
    // Step 5: Store refresh token
    console.log('5️⃣ Storing refresh token...');
    const deviceInfo = {
      ip: '127.0.0.1',
      userAgent: 'Test Script',
      loginTime: new Date().toISOString()
    };
    
    await authService.storeRefreshToken(user.id, tokens.refreshToken, deviceInfo);
    console.log('✅ Refresh token stored');
    
    // Step 6: Update last login
    console.log('6️⃣ Updating last login...');
    await authService.updateLastLogin(user.id);
    console.log('✅ Last login updated');
    
    console.log('🎉 Login process completed successfully!');
    
  } catch (error) {
    console.error('❌ Login process failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the script
testSimpleLogin().then(() => {
  console.log('🎉 Test completed');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Test failed:', error);
  process.exit(1);
}); 