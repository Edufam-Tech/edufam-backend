require('dotenv').config();
const { query } = require('./src/config/database');
const authService = require('./src/services/authService');
const userService = require('./src/services/userService');

async function testLogin() {
  try {
    console.log('🔍 Testing login process...');
    
    // Test with a known admin user
    const testEmail = 'adan@gmail.com'; // super_admin
    const testPassword = 'password123'; // Common test password
    
    console.log(`\n📧 Testing login for: ${testEmail}`);
    
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
    console.log(`   Failed Login Attempts: ${user.failed_login_attempts}`);
    console.log(`   Locked Until: ${user.locked_until}`);
    
    // Step 2: Check if account is locked
    console.log('\n2️⃣ Checking if account is locked...');
    const isLocked = await authService.isAccountLocked(user.id);
    console.log(`   Account Locked: ${isLocked}`);
    
    // Step 3: Test password verification
    console.log('\n3️⃣ Testing password verification...');
    console.log(`   Testing password: ${testPassword}`);
    console.log(`   Stored hash: ${user.password_hash ? 'Present' : 'Missing'}`);
    
    if (!user.password_hash) {
      console.log('❌ No password hash found!');
      return;
    }
    
    const isValidPassword = await authService.verifyPassword(testPassword, user.password_hash);
    console.log(`   Password Valid: ${isValidPassword}`);
    
    if (!isValidPassword) {
      console.log('❌ Password verification failed!');
      
      // Let's try some common passwords
      const commonPasswords = ['admin123', 'admin', 'password', '123456', 'edufam123'];
      console.log('\n🔍 Trying common passwords...');
      
      for (const pwd of commonPasswords) {
        const isValid = await authService.verifyPassword(pwd, user.password_hash);
        console.log(`   ${pwd}: ${isValid ? '✅' : '❌'}`);
        if (isValid) {
          console.log(`🎉 Found correct password: ${pwd}`);
          break;
        }
      }
    } else {
      console.log('✅ Password verification successful!');
      
      // Step 4: Test token generation
      console.log('\n4️⃣ Testing token generation...');
      try {
        const tokens = authService.generateTokens(user);
        console.log('✅ Tokens generated successfully:');
        console.log(`   Access Token: ${tokens.accessToken ? 'Present' : 'Missing'}`);
        console.log(`   Refresh Token: ${tokens.refreshToken ? 'Present' : 'Missing'}`);
        console.log(`   Expires In: ${tokens.expiresIn}`);
      } catch (tokenError) {
        console.log('❌ Token generation failed:', tokenError.message);
      }
    }
    
  } catch (error) {
    console.error('❌ Error during login test:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    process.exit(0);
  }
}

testLogin();
