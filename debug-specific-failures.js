const axios = require('axios');
const { query, closePool } = require('./src/config/database');
const authService = require('./src/services/authService');
const userService = require('./src/services/userService');

const API_URL = 'http://localhost:5000/api';

async function debugSpecificFailures() {
  console.log('🔍 Debugging Specific Database Failures...\n');
  
  try {
    // Get admin token first
    console.log('1. Getting admin token...');
    const loginResponse = await axios.post(`${API_URL}/auth/login`, {
      email: 'admin@edufam.com',
      password: 'TempAdmin123!',
      userType: 'admin_user'
    });
    const adminToken = loginResponse.data.data.tokens.accessToken;
    console.log('✅ Admin token obtained');

    // Test 1: Failed login tracking (the invalid login test)
    console.log('\n2. Testing failed login tracking...');
    
    // Test direct failed login tracking
    await authService.setUserContext('45f754b1-abcf-4fdc-8cfc-344a2fffdd71');
    try {
      await authService.trackFailedLogin('45f754b1-abcf-4fdc-8cfc-344a2fffdd71');
      console.log('✅ Direct failed login tracking works');
    } catch (error) {
      console.log('❌ Direct failed login tracking failed:', error.message);
    }

    // Test via API (this is what fails)
    try {
      await axios.post(`${API_URL}/auth/login`, {
        email: 'invalid@email.com',  // Non-existent user
        password: 'wrongpassword',
        userType: 'admin_user'
      });
      console.log('❌ API should have failed');
    } catch (error) {
      console.log('API Response Status:', error.response?.status);
      console.log('API Response Message:', error.response?.data?.error?.message);
      if (error.response?.status === 401) {
        console.log('✅ API invalid login protection works');
      } else {
        console.log('❌ API invalid login protection broken');
      }
    }

    // Test 2: User creation
    console.log('\n3. Testing user creation...');
    
    const testUser = {
      email: `test-${Date.now()}@test.com`,
      password: 'TestPassword123!',
      firstName: 'Test',
      lastName: 'User',
      userType: 'school_user',
      role: 'teacher',
      schoolId: null  // This might be the issue
    };

    try {
      const createResponse = await axios.post(`${API_URL}/users`, testUser, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      console.log('✅ User creation API works');
    } catch (error) {
      console.log('❌ User creation API failed:', error.response?.status, error.response?.data?.error?.message);
      
      // Try direct user creation
      try {
        await authService.setUserContext('45f754b1-abcf-4fdc-8cfc-344a2fffdd71');
        const directUser = await userService.createUser({
          email: `direct-${Date.now()}@test.com`,
          password: 'TestPassword123!',
          firstName: 'Direct',
          lastName: 'User',
          userType: 'admin_user',  // Try admin user to avoid school ID issues
          role: 'support_hr',
          schoolId: null
        }, '45f754b1-abcf-4fdc-8cfc-344a2fffdd71');
        console.log('✅ Direct user creation works');
      } catch (directError) {
        console.log('❌ Direct user creation failed:', directError.message);
      }
    }

    // Test 3: Check what RLS context we have in API vs direct
    console.log('\n4. Checking RLS context in different scenarios...');
    
    // Check current RLS settings
    const rlsTest = await query("SELECT current_setting('app.current_user_id', true) as user_id");
    console.log('Current RLS context:', rlsTest.rows[0].user_id);

  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  } finally {
    await closePool();
  }
}

debugSpecificFailures();