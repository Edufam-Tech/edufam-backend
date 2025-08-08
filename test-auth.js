const axios = require('axios');

const API_BASE = 'http://localhost:5000/api';

async function testAuth() {
  console.log('🔍 Testing Authentication and API Endpoints...\n');

  try {
    // Test 1: Health check
    console.log('1. Testing health check...');
    try {
      const healthResponse = await axios.get(`${API_BASE}/health`);
      console.log('✅ Health check passed:', healthResponse.data);
    } catch (error) {
      console.log('❌ Health check failed:', error.message);
      if (error.response) {
        console.log('Status:', error.response.status);
        console.log('Data:', error.response.data);
      }
      return;
    }

    // Test 2: Public job postings (should work without auth)
    console.log('\n2. Testing public job postings...');
    try {
      const jobResponse = await axios.get(`${API_BASE}/public/job-postings`);
      console.log('✅ Public job postings:', jobResponse.data.success ? 'Working' : 'Failed');
    } catch (error) {
      console.log('❌ Public job postings failed:', error.message);
      if (error.response) {
        console.log('Status:', error.response.status);
        console.log('Data:', error.response.data);
      }
    }

    // Test 3: Protected endpoint without auth (should fail)
    console.log('\n3. Testing protected endpoint without auth...');
    try {
      await axios.get(`${API_BASE}/school/classes`);
      console.log('❌ Should have failed - endpoint is not protected');
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('✅ Protected endpoint correctly requires authentication');
      } else {
        console.log('❌ Unexpected error:', error.response?.status, error.response?.data);
      }
    }

    // Test 4: Login with test credentials
    console.log('\n4. Testing login...');
    try {
      const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
        email: 'admin@edufam.com',
        password: 'admin123'
      });
      
      if (loginResponse.data.success) {
        console.log('✅ Login successful');
        const token = loginResponse.data.data.token || loginResponse.data.data.tokens?.accessToken;
        
        if (token) {
          console.log('✅ Token received');
          
          // Test 5: Protected endpoint with auth
          console.log('\n5. Testing protected endpoint with auth...');
          try {
            const protectedResponse = await axios.get(`${API_BASE}/school/classes`, {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            });
            console.log('✅ Protected endpoint works with auth:', protectedResponse.data.success ? 'Success' : 'Failed');
          } catch (error) {
            console.log('❌ Protected endpoint failed with auth:', error.response?.status, error.response?.data);
          }

          // Test 6: Grades analytics endpoint
          console.log('\n6. Testing grades analytics endpoint...');
          try {
            const gradesResponse = await axios.get(`${API_BASE}/academic/grades/analytics`, {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            });
            console.log('✅ Grades analytics endpoint works:', gradesResponse.data.success ? 'Success' : 'Failed');
          } catch (error) {
            console.log('❌ Grades analytics endpoint failed:', error.response?.status, error.response?.data);
          }

          // Test 7: Classes analytics endpoint
          console.log('\n7. Testing classes analytics endpoint...');
          try {
            const classesResponse = await axios.get(`${API_BASE}/school/classes/analytics`, {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            });
            console.log('✅ Classes analytics endpoint works:', classesResponse.data.success ? 'Success' : 'Failed');
          } catch (error) {
            console.log('❌ Classes analytics endpoint failed:', error.response?.status, error.response?.data);
          }

        } else {
          console.log('❌ No token received in login response');
        }
      } else {
        console.log('❌ Login failed:', loginResponse.data.message);
      }
    } catch (error) {
      console.log('❌ Login request failed:', error.message);
      if (error.response) {
        console.log('Status:', error.response.status);
        console.log('Data:', error.response.data);
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
testAuth();
