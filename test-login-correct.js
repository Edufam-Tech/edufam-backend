require('dotenv').config();
const { query } = require('./src/config/database');
const authService = require('./src/services/authService');
const userService = require('./src/services/userService');

async function testLoginWithCorrectPassword() {
  try {
    console.log('🔍 Testing login with correct password...');
    
    // Test with a known admin user
    const testEmail = 'adan@gmail.com'; // super_admin
    const testPassword = 'elimisha123'; // Correct password
    
    console.log(`\n📧 Testing login for: ${testEmail}`);
    console.log(`🔑 Using password: ${testPassword}`);
    
    // Step 1: Find user
    console.log('\n1️⃣ Finding user by email...');
    const user = await userService.findUserByEmail(testEmail, 'admin_user');
    
    if (!user) {
      console.log('❌ User not found!');
      return;
    }
    
    console.log('✅ User found:');
    console.log(`   ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   User Type: ${user.user_type}`);
    console.log(`   Active: ${user.is_active}`);
    console.log(`   Activation Status: ${user.activation_status}`);
    
    // Step 2: Check if account is locked
    console.log('\n2️⃣ Checking if account is locked...');
    const isLocked = await authService.isAccountLocked(user.id);
    console.log(`   Account Locked: ${isLocked}`);
    
    if (isLocked) {
      console.log('❌ Account is locked!');
      return;
    }
    
    // Step 3: Test password verification
    console.log('\n3️⃣ Testing password verification...');
    const isValidPassword = await authService.verifyPassword(testPassword, user.password_hash);
    console.log(`   Password Valid: ${isValidPassword}`);
    
    if (!isValidPassword) {
      console.log('❌ Password verification failed!');
      return;
    }
    
    console.log('✅ Password verification successful!');
    
    // Step 4: Test token generation
    console.log('\n4️⃣ Testing token generation...');
    const tokens = authService.generateTokens(user);
    console.log('✅ Tokens generated successfully:');
    console.log(`   Access Token: ${tokens.accessToken ? 'Present' : 'Missing'}`);
    console.log(`   Refresh Token: ${tokens.refreshToken ? 'Present' : 'Missing'}`);
    console.log(`   Expires In: ${tokens.expiresIn}`);
    
    // Step 5: Test full login flow
    console.log('\n5️⃣ Testing full login flow...');
    
    // Simulate the login controller logic
    const ipAddress = '127.0.0.1';
    const userAgent = 'Test Agent';
    
    // Set RLS context
    await authService.setUserContext(user.id, user.school_id);
    
    // Reset failed login attempts
    await authService.resetFailedLoginAttempts(user.id);
    
    // Store refresh token
    const deviceInfo = {
      ip: ipAddress,
      userAgent: userAgent,
      loginTime: new Date().toISOString()
    };
    
    await authService.storeRefreshToken(user.id, tokens.refreshToken, deviceInfo);
    
    // Update last login
    await authService.updateLastLogin(user.id);
    
    console.log('✅ Full login flow completed successfully!');
    
    // Step 6: Test API response format
    console.log('\n6️⃣ Testing API response format...');
    const sanitizedUser = userService.sanitizeUser(user);
    
    const response = {
      success: true,
      data: {
        user: sanitizedUser,
        tokens: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresIn: tokens.expiresIn,
          tokenType: tokens.tokenType
        }
      },
      message: 'Login successful'
    };
    
    console.log('✅ API response would be:');
    console.log(JSON.stringify(response, null, 2));
    
  } catch (error) {
    console.error('❌ Error during login test:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    process.exit(0);
  }
}

testLoginWithCorrectPassword();
