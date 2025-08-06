require('dotenv').config();

console.log('🔍 Checking JWT Configuration...');
console.log('================================');

// Check environment variables
console.log('Environment Variables:');
console.log('  JWT_SECRET:', process.env.JWT_SECRET ? '✅ Set' : '❌ Not Set');
console.log('  JWT_REFRESH_SECRET:', process.env.JWT_REFRESH_SECRET ? '✅ Set' : '❌ Not Set');
console.log('  JWT_EXPIRES_IN:', process.env.JWT_EXPIRES_IN || '15m (default)');
console.log('  JWT_REFRESH_EXPIRES_IN:', process.env.JWT_REFRESH_EXPIRES_IN || '7d (default)');

// Check if secrets are valid
if (process.env.JWT_SECRET && process.env.JWT_REFRESH_SECRET) {
  console.log('✅ JWT secrets are configured');
  
  // Test JWT service initialization
  try {
    const authService = require('./src/services/authService');
    console.log('✅ AuthService initialized successfully');
    
    // Test token generation
    const testUser = {
      id: 'test-id',
      email: 'test@example.com',
      role: 'super_admin',
      user_type: 'admin_user',
      school_id: null,
      is_active: true,
      activation_status: 'active'
    };
    
    const tokens = authService.generateTokens(testUser);
    console.log('✅ Token generation works');
    console.log('  Access Token Length:', tokens.accessToken.length);
    console.log('  Refresh Token Length:', tokens.refreshToken.length);
    
    // Test token verification
    const decoded = authService.verifyAccessToken(tokens.accessToken);
    console.log('✅ Token verification works');
    console.log('  Decoded User ID:', decoded.userId);
    
  } catch (error) {
    console.error('❌ JWT service error:', error.message);
  }
} else {
  console.log('❌ JWT secrets are missing');
  console.log('Please set JWT_SECRET and JWT_REFRESH_SECRET in your .env file');
}

console.log('================================');
console.log('🎉 JWT Configuration Check Complete'); 