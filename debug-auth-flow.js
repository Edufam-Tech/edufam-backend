const { query, closePool } = require('./src/config/database');
const authService = require('./src/services/authService');
const userService = require('./src/services/userService');

async function debugAuthFlow() {
  console.log('🔍 Deep Diving into Authentication Flow...\n');
  
  try {
    // Test the exact login flow that's failing
    console.log('1. Testing findUserByEmail (the working part)...');
    const user = await userService.findUserByEmail('admin@edufam.com', 'admin_user');
    console.log('✅ User found:', { id: user.id, email: user.email, user_type: user.user_type });

    console.log('\n2. Testing password verification...');
    const passwordValid = await authService.verifyPassword('password123', user.password_hash);
    console.log('✅ Password verification:', passwordValid);

    console.log('\n3. Testing token generation...');
    const tokens = authService.generateTokens(user);
    console.log('✅ Tokens generated successfully');

    console.log('\n4. Testing setUserContext before database operations...');
    await authService.setUserContext(user.id, user.school_id);
    console.log('✅ User context set for:', user.id);

    console.log('\n5. Testing storeRefreshToken (the failing operation)...');
    const deviceInfo = {
      ip: '127.0.0.1',
      userAgent: 'Test Browser',
      loginTime: new Date().toISOString()
    };
    
    try {
      const sessionId = await authService.storeRefreshToken(user.id, tokens.refreshToken, deviceInfo);
      console.log('✅ Refresh token stored successfully:', sessionId);
    } catch (error) {
      console.error('❌ storeRefreshToken failed:', error.message);
      console.error('   Error code:', error.code);
      console.error('   Stack:', error.stack);
    }

    console.log('\n6. Testing updateLastLogin...');
    try {
      await authService.updateLastLogin(user.id);
      console.log('✅ Last login updated successfully');
    } catch (error) {
      console.error('❌ updateLastLogin failed:', error.message);
      console.error('   Error code:', error.code);
    }

    console.log('\n7. Testing logUserActivity...');
    try {
      await userService.logUserActivity(
        user.id, 
        'LOGIN_SUCCESS', 
        { userType: user.user_type }, 
        '127.0.0.1', 
        'Test Browser'
      );
      console.log('✅ User activity logged successfully');
    } catch (error) {
      console.error('❌ logUserActivity failed:', error.message);
      console.error('   Error code:', error.code);
    }

    console.log('\n8. Testing invalid login scenario...');
    try {
      // This should fail gracefully, not with database error
      await authService.trackFailedLogin(user.id);
      console.log('✅ Failed login tracked successfully');
    } catch (error) {
      console.error('❌ trackFailedLogin failed:', error.message);
      console.error('   Error code:', error.code);
    }

  } catch (error) {
    console.error('❌ Auth flow debug failed:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await closePool();
  }
}

debugAuthFlow();