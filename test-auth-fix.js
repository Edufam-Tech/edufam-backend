const axios = require('axios');

const API_URL = 'http://localhost:5000/api';

async function testAuthFix() {
  console.log('🧪 Testing Authentication Fixes...\n');
  
  try {
    // Test 1: Invalid user (should give 401, not 500)
    console.log('1. Testing invalid user login...');
    try {
      await axios.post(`${API_URL}/auth/login`, {
        email: 'nonexistent@user.com',
        password: 'wrongpassword',
        userType: 'admin_user'
      });
      console.log('❌ Should have failed');
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('✅ Invalid user properly rejected with 401');
      } else {
        console.log('❌ Wrong status code:', error.response?.status);
        console.log('   Error message:', error.response?.data?.error?.message);
      }
    }

    // Test 2: Valid user + wrong password (should give 401, not 500)
    console.log('\n2. Testing valid user with wrong password...');
    try {
      await axios.post(`${API_URL}/auth/login`, {
        email: 'admin@edufam.com',
        password: 'wrongpassword',
        userType: 'admin_user'
      });
      console.log('❌ Should have failed');
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('✅ Wrong password properly rejected with 401');
      } else {
        console.log('❌ Wrong status code:', error.response?.status);
        console.log('   Error message:', error.response?.data?.error?.message);
      }
    }

    // Test 3: Valid login (should work)
    console.log('\n3. Testing valid login...');
    try {
      const response = await axios.post(`${API_URL}/auth/login`, {
        email: 'admin@edufam.com',
        password: 'TempAdmin123!',
        userType: 'admin_user'
      });
      if (response.data.success) {
        console.log('✅ Valid login successful');
        
        // Test user creation with token
        console.log('\n4. Testing user creation...');
        try {
          const createResponse = await axios.post(`${API_URL}/users`, {
            email: `test-${Date.now()}@test.com`,
            password: 'TestPassword123!',
            firstName: 'Test',
            lastName: 'User',
            userType: 'admin_user',
            role: 'support_hr'
          }, {
            headers: { Authorization: `Bearer ${response.data.data.tokens.accessToken}` }
          });
          
          if (createResponse.data.success) {
            console.log('✅ User creation successful');
          } else {
            console.log('❌ User creation failed');
          }
        } catch (createError) {
          console.log('❌ User creation error:', createError.response?.status, createError.response?.data?.error?.message);
        }
      }
    } catch (error) {
      console.log('❌ Valid login failed:', error.response?.status, error.response?.data?.error?.message);
    }

    console.log('\n🎉 Authentication fix testing completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testAuthFix();