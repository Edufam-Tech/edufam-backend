#!/usr/bin/env node

/**
 * JWT Authentication Test Script
 * 
 * This script tests the JWT authentication implementation
 * Run with: node test-jwt-auth.js
 */

const axios = require('axios');

// Configuration
const BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';
const TEST_EMAIL = process.env.TEST_EMAIL || 'test@example.com';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'password123';

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testEndpoint(method, endpoint, data = null, headers = {}) {
  try {
    const config = {
      method,
      url: `${BASE_URL}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };
    
    if (data) {
      config.data = data;
    }
    
    const response = await axios(config);
    return { success: true, data: response.data, status: response.status };
  } catch (error) {
    return { 
      success: false, 
      error: error.response?.data || error.message, 
      status: error.response?.status || 500 
    };
  }
}

async function runTests() {
  log('\n🧪 Starting JWT Authentication Tests\n', 'bold');
  
  let accessToken = null;
  let refreshToken = null;
  
  // Test 1: Health Check
  log('1. Testing health check...', 'blue');
  const healthResult = await testEndpoint('GET', '/health');
  if (healthResult.success) {
    log('   ✅ Health check passed', 'green');
    log(`   📊 Status: ${healthResult.data.status}`, 'yellow');
    log(`   🗄️  Database: ${healthResult.data.database}`, 'yellow');
  } else {
    log('   ❌ Health check failed', 'red');
    log(`   Error: ${JSON.stringify(healthResult.error)}`, 'red');
  }
  
  // Test 2: Database Health Check
  log('\n2. Testing database health check...', 'blue');
  const dbHealthResult = await testEndpoint('GET', '/api/health/database');
  if (dbHealthResult.success) {
    log('   ✅ Database health check passed', 'green');
    log(`   📊 Connected: ${dbHealthResult.data.database.connected}`, 'yellow');
  } else {
    log('   ❌ Database health check failed', 'red');
    log(`   Error: ${JSON.stringify(dbHealthResult.error)}`, 'red');
  }
  
  // Test 3: Pool Statistics
  log('\n3. Testing pool statistics...', 'blue');
  const poolStatsResult = await testEndpoint('GET', '/api/health/pool-stats');
  if (poolStatsResult.success) {
    log('   ✅ Pool statistics retrieved', 'green');
    const pools = poolStatsResult.data.pools;
    log(`   📊 Session Pool: ${pools.session.totalCount} total, ${pools.session.idleCount} idle`, 'yellow');
    if (pools.transaction) {
      log(`   📊 Transaction Pool: ${pools.transaction.totalCount} total, ${pools.transaction.idleCount} idle`, 'yellow');
    }
  } else {
    log('   ❌ Pool statistics failed', 'red');
    log(`   Error: ${JSON.stringify(poolStatsResult.error)}`, 'red');
  }
  
  // Test 4: Login
  log('\n4. Testing login...', 'blue');
  const loginResult = await testEndpoint('POST', '/api/auth/login', {
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    userType: 'school_user'
  });
  
  if (loginResult.success) {
    log('   ✅ Login successful', 'green');
    accessToken = loginResult.data.data.tokens.accessToken;
    refreshToken = loginResult.data.data.tokens.refreshToken;
    log(`   👤 User: ${loginResult.data.data.user.email}`, 'yellow');
    log(`   🔑 Access Token: ${accessToken.substring(0, 20)}...`, 'yellow');
    log(`   🔄 Refresh Token: ${refreshToken.substring(0, 20)}...`, 'yellow');
  } else {
    log('   ❌ Login failed', 'red');
    log(`   Error: ${JSON.stringify(loginResult.error)}`, 'red');
    log('\n   💡 Make sure to set TEST_EMAIL and TEST_PASSWORD environment variables', 'yellow');
    log('   💡 Or create a test user in your database', 'yellow');
    return;
  }
  
  // Test 5: Get Current User (with JWT)
  log('\n5. Testing get current user...', 'blue');
  const meResult = await testEndpoint('GET', '/api/auth/me', null, {
    'Authorization': `Bearer ${accessToken}`
  });
  
  if (meResult.success) {
    log('   ✅ Get current user successful', 'green');
    log(`   👤 User: ${meResult.data.data.user.email}`, 'yellow');
    log(`   🏫 School ID: ${meResult.data.data.user.schoolId}`, 'yellow');
  } else {
    log('   ❌ Get current user failed', 'red');
    log(`   Error: ${JSON.stringify(meResult.error)}`, 'red');
  }
  
  // Test 6: Refresh Token
  log('\n6. Testing refresh token...', 'blue');
  const refreshResult = await testEndpoint('POST', '/api/auth/refresh-token', {
    refreshToken: refreshToken
  });
  
  if (refreshResult.success) {
    log('   ✅ Token refresh successful', 'green');
    accessToken = refreshResult.data.data.tokens.accessToken;
    refreshToken = refreshResult.data.data.tokens.refreshToken;
    log(`   🔑 New Access Token: ${accessToken.substring(0, 20)}...`, 'yellow');
    log(`   🔄 New Refresh Token: ${refreshToken.substring(0, 20)}...`, 'yellow');
  } else {
    log('   ❌ Token refresh failed', 'red');
    log(`   Error: ${JSON.stringify(refreshResult.error)}`, 'red');
  }
  
  // Test 7: Logout
  log('\n7. Testing logout...', 'blue');
  const logoutResult = await testEndpoint('POST', '/api/auth/logout', {
    refreshToken: refreshToken
  });
  
  if (logoutResult.success) {
    log('   ✅ Logout successful', 'green');
  } else {
    log('   ❌ Logout failed', 'red');
    log(`   Error: ${JSON.stringify(logoutResult.error)}`, 'red');
  }
  
  // Test 8: Test with expired/invalid token
  log('\n8. Testing with invalid token...', 'blue');
  const invalidTokenResult = await testEndpoint('GET', '/api/auth/me', null, {
    'Authorization': 'Bearer invalid-token'
  });
  
  if (!invalidTokenResult.success && invalidTokenResult.status === 401) {
    log('   ✅ Invalid token properly rejected', 'green');
  } else {
    log('   ❌ Invalid token not properly rejected', 'red');
    log(`   Status: ${invalidTokenResult.status}`, 'yellow');
  }
  
  // Summary
  log('\n📋 Test Summary', 'bold');
  log('================', 'bold');
  log('✅ All tests completed!', 'green');
  log('\n💡 Next steps:', 'yellow');
  log('   1. Set up your frontend to use JWT authentication', 'yellow');
  log('   2. Update environment variables in production', 'yellow');
  log('   3. Monitor pool statistics and database connections', 'yellow');
  log('   4. Set up token cleanup cron job', 'yellow');
}

// Run the tests
runTests().catch(error => {
  log(`\n💥 Test script failed: ${error.message}`, 'red');
  process.exit(1);
});
