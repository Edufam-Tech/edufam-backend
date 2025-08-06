const axios = require('axios');
const fs = require('fs');

// Test configuration
const BASE_URL = 'http://localhost:5000';
const API_URL = `${BASE_URL}/api`;

class SecurityTester {
  constructor() {
    this.testResults = [];
    this.adminToken = null;
    this.userToken = null;
    this.errors = [];
    this.warnings = [];
  }

  logResult(test, status, details = '') {
    const result = {
      test,
      status,
      details,
      timestamp: new Date().toISOString()
    };
    this.testResults.push(result);
    
    const statusEmoji = status === 'PASS' ? '✅' : status === 'WARN' ? '⚠️' : '❌';
    console.log(`${statusEmoji} ${test}: ${status} ${details ? '- ' + details : ''}`);
    
    if (status === 'FAIL') this.errors.push(result);
    if (status === 'WARN') this.warnings.push(result);
  }

  // Test authentication security
  async testAuthenticationSecurity() {
    console.log('\n🔐 Testing Authentication Security...');
    
    try {
      // Test brute force protection
      console.log('Testing brute force protection...');
      const loginAttempts = [];
      for (let i = 0; i < 10; i++) {
        try {
          await axios.post(`${API_URL}/auth/login`, {
            email: 'admin@edufam.com',
            password: 'wrongpassword',
            userType: 'admin_user'
          });
          loginAttempts.push({ attempt: i + 1, status: 'success' });
        } catch (error) {
          loginAttempts.push({ attempt: i + 1, status: error.response?.status || 'error' });
        }
      }
      
      const blockedAttempts = loginAttempts.filter(a => a.status === 429 || a.status === 423);
      if (blockedAttempts.length > 0) {
        this.logResult('Brute Force Protection', 'PASS', `Blocked ${blockedAttempts.length} attempts`);
      } else {
        this.logResult('Brute Force Protection', 'WARN', 'No rate limiting detected');
      }

      // Test valid login
      try {
        const loginResponse = await axios.post(`${API_URL}/auth/login`, {
          email: 'admin@edufam.com',
          password: 'TempAdmin123!',
          userType: 'admin_user'
        });
        
        if (loginResponse.data.success && loginResponse.data.data.tokens.accessToken) {
          this.adminToken = loginResponse.data.data.tokens.accessToken;
          this.logResult('Valid Login', 'PASS');
        } else {
          this.logResult('Valid Login', 'FAIL', 'Invalid response structure');
        }
      } catch (error) {
        this.logResult('Valid Login', 'FAIL', error.message);
      }

      // Test token security
      if (this.adminToken) {
        // Test expired token handling
        const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ0ZXN0IiwiaWF0IjoxNjE2MTYxNjE2LCJleHAiOjE2MTYxNjE2MTZ9.invalid';
        
        try {
          await axios.get(`${API_URL}/auth/me`, {
            headers: { Authorization: `Bearer ${expiredToken}` }
          });
          this.logResult('Expired Token Rejection', 'FAIL', 'Should reject expired tokens');
        } catch (error) {
          if (error.response?.status === 401) {
            this.logResult('Expired Token Rejection', 'PASS');
          } else {
            this.logResult('Expired Token Rejection', 'WARN', 'Unexpected error response');
          }
        }

        // Test malformed token
        try {
          await axios.get(`${API_URL}/auth/me`, {
            headers: { Authorization: 'Bearer malformed-token' }
          });
          this.logResult('Malformed Token Rejection', 'FAIL', 'Should reject malformed tokens');
        } catch (error) {
          if (error.response?.status === 401) {
            this.logResult('Malformed Token Rejection', 'PASS');
          } else {
            this.logResult('Malformed Token Rejection', 'WARN', 'Unexpected error response');
          }
        }
      }

      return true;
    } catch (error) {
      this.logResult('Authentication Security', 'FAIL', error.message);
      return false;
    }
  }

  // Test authorization security
  async testAuthorizationSecurity() {
    console.log('\n🔒 Testing Authorization Security...');
    
    if (!this.adminToken) {
      this.logResult('Authorization Tests', 'FAIL', 'No admin token available');
      return false;
    }

    try {
      // Test role-based access control
      const endpoints = [
        { url: `${API_URL}/users`, method: 'GET', requiredRole: 'super_admin' },
        { url: `${API_URL}/auth/stats`, method: 'GET', requiredRole: 'super_admin' },
        { url: `${API_URL}/users/profile`, method: 'GET', requiredRole: 'any' }
      ];

      for (const endpoint of endpoints) {
        try {
          const response = await axios[endpoint.method.toLowerCase()](endpoint.url, {
            headers: { Authorization: `Bearer ${this.adminToken}` }
          });
          
          if (response.data.success) {
            this.logResult(`Authorization: ${endpoint.method} ${endpoint.url}`, 'PASS');
          } else {
            this.logResult(`Authorization: ${endpoint.method} ${endpoint.url}`, 'WARN', 'Unexpected response');
          }
        } catch (error) {
          if (error.response?.status === 403) {
            this.logResult(`Authorization: ${endpoint.method} ${endpoint.url}`, 'PASS', 'Properly denied access');
          } else {
            this.logResult(`Authorization: ${endpoint.method} ${endpoint.url}`, 'FAIL', error.message);
          }
        }
      }

      // Test unauthorized access with fake token
      try {
        await axios.get(`${API_URL}/users`, {
          headers: { Authorization: 'Bearer fake-token-123' }
        });
        this.logResult('Fake Token Rejection', 'FAIL', 'Should reject fake tokens');
      } catch (error) {
        if (error.response?.status === 401) {
          this.logResult('Fake Token Rejection', 'PASS');
        } else {
          this.logResult('Fake Token Rejection', 'WARN', 'Unexpected error response');
        }
      }

      return true;
    } catch (error) {
      this.logResult('Authorization Security', 'FAIL', error.message);
      return false;
    }
  }

  // Test input validation security
  async testInputValidation() {
    console.log('\n🛡️ Testing Input Validation Security...');
    
    if (!this.adminToken) {
      this.logResult('Input Validation', 'FAIL', 'No admin token available');
      return false;
    }

    try {
      // Test SQL injection attempts
      const sqlInjectionTests = [
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        "'; INSERT INTO users VALUES (1, 'hacker', 'password'); --",
        "admin'--",
        "admin'/*"
      ];

      for (const test of sqlInjectionTests) {
        try {
          await axios.post(`${API_URL}/auth/login`, {
            email: test,
            password: 'password',
            userType: 'admin_user'
          });
          this.logResult(`SQL Injection: ${test}`, 'WARN', 'Should reject malicious input');
        } catch (error) {
          if (error.response?.status === 400 || error.response?.status === 401) {
            this.logResult(`SQL Injection: ${test}`, 'PASS', 'Properly rejected');
          } else {
            this.logResult(`SQL Injection: ${test}`, 'WARN', 'Unexpected response');
          }
        }
      }

      // Test XSS attempts
      const xssTests = [
        '<script>alert("xss")</script>',
        'javascript:alert("xss")',
        '<img src="x" onerror="alert(\'xss\')">',
        '"><script>alert("xss")</script>'
      ];

      for (const test of xssTests) {
        try {
          await axios.post(`${API_URL}/users`, {
            email: `test${Date.now()}@school.com`,
            password: 'TestUser123!',
            firstName: test,
            lastName: 'User',
            userType: 'school_user',
            role: 'teacher'
          }, {
            headers: { Authorization: `Bearer ${this.adminToken}` }
          });
          this.logResult(`XSS: ${test}`, 'WARN', 'Should sanitize malicious input');
        } catch (error) {
          if (error.response?.status === 400) {
            this.logResult(`XSS: ${test}`, 'PASS', 'Properly rejected');
          } else {
            this.logResult(`XSS: ${test}`, 'WARN', 'Unexpected response');
          }
        }
      }

      // Test email validation
      const invalidEmails = [
        'invalid-email',
        'test@',
        '@domain.com',
        'test..test@domain.com',
        'test@domain..com'
      ];

      for (const email of invalidEmails) {
        try {
          await axios.post(`${API_URL}/users`, {
            email: email,
            password: 'TestUser123!',
            firstName: 'Test',
            lastName: 'User',
            userType: 'school_user',
            role: 'teacher'
          }, {
            headers: { Authorization: `Bearer ${this.adminToken}` }
          });
          this.logResult(`Email Validation: ${email}`, 'FAIL', 'Should reject invalid email');
        } catch (error) {
          if (error.response?.status === 400) {
            this.logResult(`Email Validation: ${email}`, 'PASS', 'Properly rejected');
          } else {
            this.logResult(`Email Validation: ${email}`, 'WARN', 'Unexpected response');
          }
        }
      }

      return true;
    } catch (error) {
      this.logResult('Input Validation Security', 'FAIL', error.message);
      return false;
    }
  }

  // Test rate limiting
  async testRateLimiting() {
    console.log('\n⏱️ Testing Rate Limiting...');
    
    try {
      // Test general rate limiting
      console.log('Testing general rate limiting...');
      const promises = [];
      for (let i = 0; i < 30; i++) {
        promises.push(
          axios.get(`${BASE_URL}/health`).catch(e => e.response)
        );
      }
      
      const results = await Promise.all(promises);
      const rateLimited = results.some(r => r?.status === 429);
      
      if (rateLimited) {
        this.logResult('General Rate Limiting', 'PASS', 'Rate limiting is active');
      } else {
        this.logResult('General Rate Limiting', 'WARN', 'Rate limiting might not be working');
      }

      // Test authentication rate limiting
      console.log('Testing authentication rate limiting...');
      const authPromises = [];
      for (let i = 0; i < 20; i++) {
        authPromises.push(
          axios.post(`${API_URL}/auth/login`, {
            email: 'test@test.com',
            password: 'wrongpassword',
            userType: 'admin_user'
          }).catch(e => e.response)
        );
      }
      
      const authResults = await Promise.all(authPromises);
      const authRateLimited = authResults.some(r => r?.status === 429);
      
      if (authRateLimited) {
        this.logResult('Authentication Rate Limiting', 'PASS', 'Auth rate limiting is active');
      } else {
        this.logResult('Authentication Rate Limiting', 'WARN', 'Auth rate limiting might not be working');
      }

      return true;
    } catch (error) {
      this.logResult('Rate Limiting', 'FAIL', error.message);
      return false;
    }
  }

  // Test security headers
  async testSecurityHeaders() {
    console.log('\n🛡️ Testing Security Headers...');
    
    try {
      const response = await axios.get(`${BASE_URL}/health`);
      const headers = response.headers;
      
      const requiredHeaders = [
        'x-content-type-options',
        'x-frame-options',
        'x-xss-protection',
        'strict-transport-security'
      ];
      
      const optionalHeaders = [
        'content-security-policy',
        'referrer-policy',
        'permissions-policy'
      ];
      
      let passedHeaders = 0;
      let totalHeaders = requiredHeaders.length;
      
      for (const header of requiredHeaders) {
        if (headers[header]) {
          this.logResult(`Security Header: ${header}`, 'PASS');
          passedHeaders++;
        } else {
          this.logResult(`Security Header: ${header}`, 'FAIL', 'Missing required header');
        }
      }
      
      for (const header of optionalHeaders) {
        if (headers[header]) {
          this.logResult(`Security Header: ${header}`, 'PASS');
          passedHeaders++;
        } else {
          this.logResult(`Security Header: ${header}`, 'WARN', 'Optional header missing');
        }
      }
      
      if (passedHeaders >= requiredHeaders.length) {
        this.logResult('Security Headers Overall', 'PASS', `${passedHeaders}/${totalHeaders} headers present`);
      } else {
        this.logResult('Security Headers Overall', 'FAIL', `Only ${passedHeaders}/${totalHeaders} headers present`);
      }

      return true;
    } catch (error) {
      this.logResult('Security Headers', 'FAIL', error.message);
      return false;
    }
  }

  // Test CORS configuration
  async testCORS() {
    console.log('\n🌐 Testing CORS Configuration...');
    
    try {
      // Test preflight request
      const corsResponse = await axios.options(`${API_URL}/auth/login`, {
        headers: {
          'Origin': 'http://localhost:3000',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type'
        }
      });
      
      const corsHeaders = corsResponse.headers;
      
      if (corsHeaders['access-control-allow-origin']) {
        this.logResult('CORS Preflight', 'PASS', 'CORS headers present');
      } else {
        this.logResult('CORS Preflight', 'FAIL', 'CORS headers missing');
      }
      
      // Test actual request with origin
      try {
        const actualResponse = await axios.post(`${API_URL}/auth/login`, {
          email: 'test@test.com',
          password: 'password',
          userType: 'admin_user'
        }, {
          headers: {
            'Origin': 'http://localhost:3000'
          }
        });
        
        if (actualResponse.headers['access-control-allow-origin']) {
          this.logResult('CORS Actual Request', 'PASS', 'CORS headers present');
        } else {
          this.logResult('CORS Actual Request', 'WARN', 'CORS headers missing');
        }
      } catch (error) {
        // Expected to fail due to invalid credentials
        if (error.response?.headers['access-control-allow-origin']) {
          this.logResult('CORS Actual Request', 'PASS', 'CORS headers present even on error');
        } else {
          this.logResult('CORS Actual Request', 'WARN', 'CORS headers missing on error');
        }
      }

      return true;
    } catch (error) {
      this.logResult('CORS Configuration', 'FAIL', error.message);
      return false;
    }
  }

  // Test file upload security
  async testFileUploadSecurity() {
    console.log('\n📁 Testing File Upload Security...');
    
    if (!this.adminToken) {
      this.logResult('File Upload Security', 'FAIL', 'No admin token available');
      return false;
    }

    try {
      // Test file type validation
      const maliciousFiles = [
        { name: 'test.php', content: '<?php echo "hacked"; ?>', type: 'application/x-php' },
        { name: 'test.js', content: 'alert("xss")', type: 'application/javascript' },
        { name: 'test.exe', content: 'fake-executable', type: 'application/x-executable' }
      ];

      for (const file of maliciousFiles) {
        try {
          const FormData = require('form-data');
          const form = new FormData();
          form.append('profilePicture', Buffer.from(file.content), {
            filename: file.name,
            contentType: file.type
          });

          await axios.post(`${API_URL}/upload/profile-picture`, form, {
            headers: {
              ...form.getHeaders(),
              Authorization: `Bearer ${this.adminToken}`
            }
          });
          this.logResult(`File Type Validation: ${file.name}`, 'FAIL', 'Should reject malicious file type');
        } catch (error) {
          if (error.response?.status === 400) {
            this.logResult(`File Type Validation: ${file.name}`, 'PASS', 'Properly rejected');
          } else {
            this.logResult(`File Type Validation: ${file.name}`, 'WARN', 'Unexpected response');
          }
        }
      }

      // Test file size limits
      try {
        const FormData = require('form-data');
        const form = new FormData();
        const largeFile = Buffer.alloc(10 * 1024 * 1024); // 10MB file
        form.append('profilePicture', largeFile, {
          filename: 'large-image.jpg',
          contentType: 'image/jpeg'
        });

        await axios.post(`${API_URL}/upload/profile-picture`, form, {
          headers: {
            ...form.getHeaders(),
            Authorization: `Bearer ${this.adminToken}`
          }
        });
        this.logResult('File Size Validation', 'FAIL', 'Should reject oversized file');
      } catch (error) {
        if (error.response?.status === 400 || error.response?.status === 413) {
          this.logResult('File Size Validation', 'PASS', 'Properly rejected oversized file');
        } else {
          this.logResult('File Size Validation', 'WARN', 'Unexpected response');
        }
      }

      return true;
    } catch (error) {
      this.logResult('File Upload Security', 'FAIL', error.message);
      return false;
    }
  }

  // Test error handling security
  async testErrorHandlingSecurity() {
    console.log('\n🚨 Testing Error Handling Security...');
    
    try {
      // Test that errors don't leak sensitive information
      const errorTests = [
        { url: `${API_URL}/auth/login`, method: 'POST', data: { email: 'admin@edufam.com', password: 'wrong' } },
        { url: `${API_URL}/users/999999`, method: 'GET', headers: { Authorization: `Bearer ${this.adminToken}` } },
        { url: `${API_URL}/invalid-endpoint`, method: 'GET' }
      ];

      for (const test of errorTests) {
        try {
          const config = {
            method: test.method,
            url: test.url,
            headers: test.headers || {}
          };
          
          if (test.data) {
            config.data = test.data;
          }
          
          await axios(config);
        } catch (error) {
          const response = error.response?.data;
          
          // Check for sensitive information leaks
          const sensitivePatterns = [
            /password/i,
            /token/i,
            /secret/i,
            /key/i,
            /database/i,
            /connection/i,
            /stack trace/i,
            /error:/i
          ];
          
          const responseString = JSON.stringify(response).toLowerCase();
          const leaks = sensitivePatterns.filter(pattern => pattern.test(responseString));
          
          if (leaks.length > 0) {
            this.logResult(`Error Handling: ${test.url}`, 'FAIL', `Potential information leak: ${leaks.join(', ')}`);
          } else {
            this.logResult(`Error Handling: ${test.url}`, 'PASS', 'No sensitive information leaked');
          }
        }
      }

      return true;
    } catch (error) {
      this.logResult('Error Handling Security', 'FAIL', error.message);
      return false;
    }
  }

  // Run all security tests
  async runAllSecurityTests() {
    console.log('🔒 Starting Comprehensive Security Testing...\n');
    console.log('='.repeat(60));
    
    const testSuite = [
      () => this.testAuthenticationSecurity(),
      () => this.testAuthorizationSecurity(),
      () => this.testInputValidation(),
      () => this.testRateLimiting(),
      () => this.testSecurityHeaders(),
      () => this.testCORS(),
      () => this.testFileUploadSecurity(),
      () => this.testErrorHandlingSecurity()
    ];

    for (const test of testSuite) {
      await test();
    }

    this.generateSecurityReport();
  }

  // Generate security report
  generateSecurityReport() {
    console.log('\n' + '='.repeat(60));
    console.log('🔒 COMPREHENSIVE SECURITY TEST REPORT');
    console.log('='.repeat(60));
    
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(r => r.status === 'PASS').length;
    const failedTests = this.errors.length;
    const warningTests = this.warnings.length;
    
    console.log(`\n📊 Security Test Summary:`);
    console.log(`   Total Tests: ${totalTests}`);
    console.log(`   ✅ Passed: ${passedTests}`);
    console.log(`   ❌ Failed: ${failedTests}`);
    console.log(`   ⚠️  Warnings: ${warningTests}`);
    console.log(`   Security Score: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
    
    if (this.errors.length > 0) {
      console.log(`\n❌ CRITICAL SECURITY ISSUES (${this.errors.length}):`);
      this.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error.test}: ${error.details}`);
      });
    }
    
    if (this.warnings.length > 0) {
      console.log(`\n⚠️  SECURITY WARNINGS (${this.warnings.length}):`);
      this.warnings.forEach((warning, index) => {
        console.log(`   ${index + 1}. ${warning.test}: ${warning.details}`);
      });
    }
    
    // Security recommendations
    console.log(`\n💡 SECURITY RECOMMENDATIONS:`);
    
    if (failedTests > 0) {
      console.log(`   🔴 CRITICAL: Fix ${failedTests} security vulnerabilities immediately`);
    }
    
    if (warningTests > 0) {
      console.log(`   🟡 IMPORTANT: Address ${warningTests} security warnings`);
    }
    
    if (failedTests === 0 && warningTests === 0) {
      console.log(`   🟢 EXCELLENT: Backend is secure and ready for production!`);
    }
    
    // Save security report
    const reportData = {
      timestamp: new Date().toISOString(),
      summary: { totalTests, passedTests, failedTests, warningTests },
      results: this.testResults,
      errors: this.errors,
      warnings: this.warnings
    };
    
    fs.writeFileSync('security-test-report.json', JSON.stringify(reportData, null, 2));
    console.log(`\n📄 Security report saved to: security-test-report.json`);
    console.log('='.repeat(60));
  }
}

// Run tests if script is executed directly
if (require.main === module) {
  const tester = new SecurityTester();
  tester.runAllSecurityTests().catch(console.error);
}

module.exports = SecurityTester; 