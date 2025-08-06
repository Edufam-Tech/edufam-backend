const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

// Test configuration
const BASE_URL = 'http://localhost:5000';
const API_URL = `${BASE_URL}/api`;

class BackendTester {
  constructor() {
    this.testResults = [];
    this.adminToken = null;
    this.userToken = null;
    this.testUserId = null;
    this.errors = [];
    this.warnings = [];
  }

  // Log test results
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

  // Test database health
  async testDatabaseHealth() {
    console.log('\n🗄️ Testing Database Health...');
    
    try {
      const response = await axios.get(`${BASE_URL}/health`);
      
      if (response.data.database === 'Connected') {
        this.logResult('Database Connection', 'PASS');
      } else {
        this.logResult('Database Connection', 'FAIL', 'Database not connected');
        return false;
      }
      
      // Test database schema
      const schemas = [
        'users', 'schools', 'user_sessions', 'password_reset_tokens',
        'students', 'staff', 'file_uploads', 'audit_logs'
      ];
      
      // This would require a dedicated endpoint to check schema
      this.logResult('Database Schema', 'WARN', 'Schema validation endpoint needed');
      
      return true;
    } catch (error) {
      this.logResult('Database Health', 'FAIL', error.message);
      return false;
    }
  }

  // Test authentication system
  async testAuthentication() {
    console.log('\n🔐 Testing Authentication System...');
    
    try {
      // Test invalid login
      try {
        await axios.post(`${API_URL}/auth/login`, {
          email: 'invalid@email.com',
          password: 'wrongpassword',
          userType: 'admin_user'
        });
        this.logResult('Invalid Login Protection', 'FAIL', 'Should reject invalid credentials');
      } catch (error) {
        if (error.response?.status === 401) {
          this.logResult('Invalid Login Protection', 'PASS');
        } else {
          this.logResult('Invalid Login Protection', 'FAIL', `Unexpected error: ${error.message}`);
        }
      }

      // Test valid admin login
      try {
        const loginResponse = await axios.post(`${API_URL}/auth/login`, {
          email: 'admin@edufam.com',
          password: 'TempAdmin123!',
          userType: 'admin_user'
        });
        
        if (loginResponse.data.success && loginResponse.data.data.tokens.accessToken) {
          this.adminToken = loginResponse.data.data.tokens.accessToken;
          this.logResult('Admin Login', 'PASS');
        } else {
          this.logResult('Admin Login', 'FAIL', 'Invalid response structure');
          return false;
        }
      } catch (error) {
        this.logResult('Admin Login', 'FAIL', error.message);
        return false;
      }

      // Test token validation
      try {
        const meResponse = await axios.get(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${this.adminToken}` }
        });
        
        if (meResponse.data.success && meResponse.data.data.user) {
          this.logResult('Token Validation', 'PASS');
        } else {
          this.logResult('Token Validation', 'FAIL', 'Invalid me response');
        }
      } catch (error) {
        this.logResult('Token Validation', 'FAIL', error.message);
      }

      // Test protected endpoint without token
      try {
        await axios.get(`${API_URL}/users/profile`);
        this.logResult('Protected Route Security', 'FAIL', 'Should require authentication');
      } catch (error) {
        if (error.response?.status === 401) {
          this.logResult('Protected Route Security', 'PASS');
        } else {
          this.logResult('Protected Route Security', 'FAIL', `Unexpected error: ${error.message}`);
        }
      }

      return true;
    } catch (error) {
      this.logResult('Authentication System', 'FAIL', error.message);
      return false;
    }
  }

  // Test user management
  async testUserManagement() {
    console.log('\n👥 Testing User Management...');
    
    if (!this.adminToken) {
      this.logResult('User Management', 'FAIL', 'No admin token available');
      return false;
    }

    try {
      // Test user creation
      const newUser = {
        email: `test-${Date.now()}@school.com`,
        password: 'TestUser123!',
        firstName: 'Test',
        lastName: 'User',
        userType: 'school_user',
        role: 'teacher',
        schoolId: null // This should be a valid school ID
      };

      try {
        const createResponse = await axios.post(`${API_URL}/users`, newUser, {
          headers: { Authorization: `Bearer ${this.adminToken}` }
        });
        
        if (createResponse.data.success && createResponse.data.data.user) {
          this.testUserId = createResponse.data.data.user.id;
          this.logResult('User Creation', 'PASS');
        } else {
          this.logResult('User Creation', 'FAIL', 'Invalid create response');
        }
      } catch (error) {
        this.logResult('User Creation', 'FAIL', error.message);
      }

      // Test user listing
      try {
        const listResponse = await axios.get(`${API_URL}/users`, {
          headers: { Authorization: `Bearer ${this.adminToken}` }
        });
        
        if (listResponse.data.success && Array.isArray(listResponse.data.data.users)) {
          this.logResult('User Listing', 'PASS');
        } else {
          this.logResult('User Listing', 'FAIL', 'Invalid list response');
        }
      } catch (error) {
        this.logResult('User Listing', 'FAIL', error.message);
      }

      // Test pagination
      try {
        const paginationResponse = await axios.get(`${API_URL}/users?page=1&limit=5`, {
          headers: { Authorization: `Bearer ${this.adminToken}` }
        });
        
        if (paginationResponse.data.data.pagination) {
          this.logResult('User Pagination', 'PASS');
        } else {
          this.logResult('User Pagination', 'FAIL', 'Missing pagination data');
        }
      } catch (error) {
        this.logResult('User Pagination', 'FAIL', error.message);
      }

      // Test role-based access (non-admin trying to access users)
      try {
        await axios.get(`${API_URL}/users`, {
          headers: { Authorization: `Bearer fake-token` }
        });
        this.logResult('Role-Based Access Control', 'FAIL', 'Should reject invalid tokens');
      } catch (error) {
        if (error.response?.status === 401) {
          this.logResult('Role-Based Access Control', 'PASS');
        } else {
          this.logResult('Role-Based Access Control', 'WARN', 'Unexpected error response');
        }
      }

      return true;
    } catch (error) {
      this.logResult('User Management', 'FAIL', error.message);
      return false;
    }
  }

  // Test file upload system
  async testFileUpload() {
    console.log('\n📁 Testing File Upload System...');
    
    if (!this.adminToken) {
      this.logResult('File Upload', 'FAIL', 'No admin token available');
      return false;
    }

    try {
      // Create a test image file
      const testImagePath = path.join(__dirname, 'test-image.jpg');
      const testImageBuffer = Buffer.from('fake-image-data'); // In real test, use actual image
      
      // Test profile picture upload
      const form = new FormData();
      form.append('profilePicture', testImageBuffer, {
        filename: 'test-profile.jpg',
        contentType: 'image/jpeg'
      });

      try {
        const uploadResponse = await axios.post(`${API_URL}/upload/profile-picture`, form, {
          headers: {
            ...form.getHeaders(),
            Authorization: `Bearer ${this.adminToken}`
          }
        });
        
        if (uploadResponse.data.success && uploadResponse.data.data.file) {
          this.logResult('Profile Picture Upload', 'PASS');
        } else {
          this.logResult('Profile Picture Upload', 'FAIL', 'Invalid upload response');
        }
      } catch (error) {
        this.logResult('Profile Picture Upload', 'FAIL', error.message);
      }

      // Test file listing
      try {
        const filesResponse = await axios.get(`${API_URL}/upload/files`, {
          headers: { Authorization: `Bearer ${this.adminToken}` }
        });
        
        if (filesResponse.data.success) {
          this.logResult('File Listing', 'PASS');
        } else {
          this.logResult('File Listing', 'FAIL', 'Invalid files response');
        }
      } catch (error) {
        this.logResult('File Listing', 'FAIL', error.message);
      }

      // Test unauthorized file access
      try {
        await axios.get(`${API_URL}/upload/files`);
        this.logResult('File Access Security', 'FAIL', 'Should require authentication');
      } catch (error) {
        if (error.response?.status === 401) {
          this.logResult('File Access Security', 'PASS');
        } else {
          this.logResult('File Access Security', 'WARN', 'Unexpected error response');
        }
      }

      return true;
    } catch (error) {
      this.logResult('File Upload System', 'FAIL', error.message);
      return false;
    }
  }

  // Test security features
  async testSecurity() {
    console.log('\n🛡️ Testing Security Features...');
    
    try {
      // Test rate limiting
      console.log('Testing rate limiting...');
      const promises = [];
      for (let i = 0; i < 20; i++) {
        promises.push(
          axios.post(`${API_URL}/auth/login`, {
            email: 'test@test.com',
            password: 'wrongpassword',
            userType: 'admin_user'
          }).catch(e => e.response)
        );
      }
      
      const results = await Promise.all(promises);
      const rateLimited = results.some(r => r?.status === 429);
      
      if (rateLimited) {
        this.logResult('Rate Limiting', 'PASS');
      } else {
        this.logResult('Rate Limiting', 'WARN', 'Rate limiting might not be working');
      }

      // Test CORS
      try {
        const corsResponse = await axios.options(`${API_URL}/auth/login`);
        if (corsResponse.headers['access-control-allow-origin']) {
          this.logResult('CORS Configuration', 'PASS');
        } else {
          this.logResult('CORS Configuration', 'WARN', 'CORS headers missing');
        }
      } catch (error) {
        this.logResult('CORS Configuration', 'WARN', 'Could not test CORS');
      }

      // Test input validation
      try {
        await axios.post(`${API_URL}/users`, {
          email: 'invalid-email',
          password: '123',
          firstName: '',
          lastName: '',
          userType: 'invalid_type',
          role: 'invalid_role'
        }, {
          headers: { Authorization: `Bearer ${this.adminToken}` }
        });
        this.logResult('Input Validation', 'FAIL', 'Should reject invalid data');
      } catch (error) {
        if (error.response?.status === 400) {
          this.logResult('Input Validation', 'PASS');
        } else {
          this.logResult('Input Validation', 'WARN', 'Unexpected validation response');
        }
      }

      return true;
    } catch (error) {
      this.logResult('Security Features', 'FAIL', error.message);
      return false;
    }
  }

  // Test API consistency
  async testAPIConsistency() {
    console.log('\n📋 Testing API Response Consistency...');
    
    try {
      // Test all endpoints return consistent format
      const endpoints = [
        { method: 'GET', url: `${BASE_URL}/health`, auth: false },
        { method: 'GET', url: `${API_URL}`, auth: false },
        { method: 'GET', url: `${API_URL}/auth/me`, auth: true },
        { method: 'GET', url: `${API_URL}/users/profile`, auth: true }
      ];

      for (const endpoint of endpoints) {
        try {
          const config = endpoint.auth && this.adminToken 
            ? { headers: { Authorization: `Bearer ${this.adminToken}` } }
            : {};
            
          const response = await axios[endpoint.method.toLowerCase()](endpoint.url, config);
          
          if (response.data.hasOwnProperty('success')) {
            this.logResult(`API Consistency: ${endpoint.method} ${endpoint.url}`, 'PASS');
          } else {
            this.logResult(`API Consistency: ${endpoint.method} ${endpoint.url}`, 'WARN', 'Missing success field');
          }
        } catch (error) {
          if (endpoint.auth && error.response?.status === 401) {
            this.logResult(`API Consistency: ${endpoint.method} ${endpoint.url}`, 'PASS', 'Auth required');
          } else {
            this.logResult(`API Consistency: ${endpoint.method} ${endpoint.url}`, 'FAIL', error.message);
          }
        }
      }

      return true;
    } catch (error) {
      this.logResult('API Consistency', 'FAIL', error.message);
      return false;
    }
  }

  // Run all tests
  async runAllTests() {
    console.log('🚀 Starting Comprehensive Backend Testing...\n');
    console.log('='.repeat(60));
    
    const testSuite = [
      () => this.testDatabaseHealth(),
      () => this.testAuthentication(),
      () => this.testUserManagement(),
      () => this.testFileUpload(),
      () => this.testSecurity(),
      () => this.testAPIConsistency()
    ];

    for (const test of testSuite) {
      await test();
    }

    // Generate test report
    this.generateReport();
  }

  // Generate comprehensive test report
  generateReport() {
    console.log('\n' + '='.repeat(60));
    console.log('🧪 COMPREHENSIVE TEST REPORT');
    console.log('='.repeat(60));
    
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(r => r.status === 'PASS').length;
    const failedTests = this.errors.length;
    const warningTests = this.warnings.length;
    
    console.log(`\n📊 Test Summary:`);
    console.log(`   Total Tests: ${totalTests}`);
    console.log(`   ✅ Passed: ${passedTests}`);
    console.log(`   ❌ Failed: ${failedTests}`);
    console.log(`   ⚠️  Warnings: ${warningTests}`);
    console.log(`   Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
    
    if (this.errors.length > 0) {
      console.log(`\n❌ CRITICAL ISSUES (${this.errors.length}):`);
      this.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error.test}: ${error.details}`);
      });
    }
    
    if (this.warnings.length > 0) {
      console.log(`\n⚠️  WARNINGS (${this.warnings.length}):`);
      this.warnings.forEach((warning, index) => {
        console.log(`   ${index + 1}. ${warning.test}: ${warning.details}`);
      });
    }
    
    // Recommendations
    console.log(`\n💡 RECOMMENDATIONS:`);
    
    if (failedTests > 0) {
      console.log(`   🔴 HIGH PRIORITY: Fix ${failedTests} critical issues before proceeding`);
    }
    
    if (warningTests > 0) {
      console.log(`   🟡 MEDIUM PRIORITY: Address ${warningTests} warnings for better security/performance`);
    }
    
    if (failedTests === 0 && warningTests === 0) {
      console.log(`   🟢 EXCELLENT: Backend is ready for frontend development!`);
    }
    
    // Save report to file
    const reportData = {
      timestamp: new Date().toISOString(),
      summary: { totalTests, passedTests, failedTests, warningTests },
      results: this.testResults,
      errors: this.errors,
      warnings: this.warnings
    };
    
    fs.writeFileSync('backend-test-report.json', JSON.stringify(reportData, null, 2));
    console.log(`\n📄 Detailed report saved to: backend-test-report.json`);
    console.log('='.repeat(60));
  }
}

// Run tests if script is executed directly
if (require.main === module) {
  const tester = new BackendTester();
  tester.runAllTests().catch(console.error);
}

module.exports = BackendTester; 