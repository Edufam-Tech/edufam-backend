const axios = require('axios');
const authService = require('./src/services/authService');
const userService = require('./src/services/userService');
const { closePool } = require('./src/config/database');

const API_URL = 'http://localhost:5000/api';

async function compareAPIvsDirect() {
  console.log('🔍 Comparing API vs Direct Database Calls...\n');
  
  try {
    // First, let's see what credentials the test is using
    console.log('1. Checking what login credentials the test uses...');
    
    // Look at what the failing test is sending
    const testCredentials = {
      email: 'admin@admin.com',  // This might be wrong!
      password: 'admin123',      // This might be wrong!
      userType: 'admin_user'
    };
    
    console.log('Test is using:', testCredentials);
    
    // Check what admin users exist
    console.log('\n2. Checking what admin users exist...');
    const user1 = await userService.findUserByEmail('admin@admin.com', 'admin_user');
    console.log('admin@admin.com exists:', !!user1);
    
    const user2 = await userService.findUserByEmail('admin@edufam.com', 'admin_user');
    console.log('admin@edufam.com exists:', !!user2);
    
    // Test API call with wrong credentials (what test is doing)
    console.log('\n3. Testing API call with test credentials...');
    try {
      const response = await axios.post(`${API_URL}/auth/login`, testCredentials);
      console.log('✅ API login successful with test creds');
    } catch (error) {
      console.log('❌ API login failed with test creds:', error.response?.status, error.response?.data?.error?.message);
      console.log('   Full error:', error.response?.data);
    }
    
    // Test API call with correct credentials
    console.log('\n4. Testing API call with correct credentials...');
    const correctCredentials = {
      email: 'admin@edufam.com',
      password: 'password123',  // We need to figure out the right password
      userType: 'admin_user'
    };
    
    try {
      const response = await axios.post(`${API_URL}/auth/login`, correctCredentials);
      console.log('✅ API login successful with correct creds');
    } catch (error) {
      console.log('❌ API login failed with correct creds:', error.response?.status, error.response?.data?.error?.message);
    }
    
  } catch (error) {
    console.error('❌ Comparison failed:', error.message);
  } finally {
    await closePool();
  }
}

compareAPIvsDirect();