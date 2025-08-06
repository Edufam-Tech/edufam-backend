# Edufam Backend Debugging & Testing Guide

This guide provides comprehensive instructions for debugging, testing, and validating the Edufam backend system.

## 🚀 Quick Start

### Run Complete System Debug
```bash
npm run debug:system
```

This will run all debugging checks and generate a comprehensive report.

### Run Individual Tests
```bash
# Backend functionality tests
npm test

# Security vulnerability tests
npm run test:security

# Database schema validation
npm run debug:schema

# System health check
npm run debug:health
```

## 📋 Available Debugging Tools

### 1. Comprehensive System Debugger (`debug-system.js`)
**Command:** `npm run debug:system`

Performs a complete system audit including:
- Environment configuration validation
- File system structure verification
- Dependencies check
- Database health assessment
- Schema validation
- Backend functionality tests
- Security vulnerability scans

**Output:** `comprehensive-debug-report.json`

### 2. Backend Functionality Tester (`tests/backend-debug.js`)
**Command:** `npm test`

Tests all backend functionality:
- Database connection health
- Authentication system
- User management
- File upload system
- Security features
- API response consistency

**Output:** `backend-test-report.json`

### 3. Security Vulnerability Tester (`tests/security-test.js`)
**Command:** `npm run test:security`

Comprehensive security testing:
- Authentication security (brute force protection)
- Authorization security (role-based access)
- Input validation (SQL injection, XSS)
- Rate limiting
- Security headers
- CORS configuration
- File upload security
- Error handling security

**Output:** `security-test-report.json`

### 4. Database Schema Validator (`database/validate-schema.js`)
**Command:** `npm run debug:schema`

Validates database structure:
- Required tables existence
- Table structure validation
- Foreign key constraints
- Database indexes
- RLS policies
- Database triggers
- Default data validation

### 5. System Health Checker (`src/utils/debugger.js`)
**Command:** `npm run debug:health`

Quick system health assessment:
- Database schema integrity
- RLS policies status
- Active sessions count
- User statistics
- System settings
- Maintenance mode status
- File upload statistics
- Audit log statistics
- Database performance

## 🔧 Debugging Utilities

### DebugUtils Class (`src/utils/debugger.js`)

Provides individual debugging functions:

```javascript
const DebugUtils = require('./src/utils/debugger');

// Check database schema
await DebugUtils.checkSchema();

// Check RLS policies
await DebugUtils.checkRLSPolicies();

// Check active sessions
await DebugUtils.checkActiveSessions();

// Check user statistics
await DebugUtils.checkUserStatistics();

// Check database indexes
await DebugUtils.checkIndexes();

// Check system settings
await DebugUtils.checkSystemSettings();

// Check maintenance mode
await DebugUtils.checkMaintenanceMode();

// Check file uploads
await DebugUtils.checkFileUploads();

// Check audit logs
await DebugUtils.checkAuditLogs();

// Check database performance
await DebugUtils.checkDatabasePerformance();

// Run comprehensive health check
await DebugUtils.systemHealth();

// Generate detailed health report
const report = await DebugUtils.generateHealthReport();
```

## 📊 Understanding Test Results

### Test Status Codes
- **✅ PASS**: Test passed successfully
- **❌ FAIL**: Critical issue detected
- **⚠️ WARN**: Warning that should be addressed

### Report Structure
All test reports follow this structure:
```json
{
  "timestamp": "2024-01-01T00:00:00.000Z",
  "summary": {
    "totalTests": 50,
    "passedTests": 45,
    "failedTests": 3,
    "warningTests": 2
  },
  "results": [...],
  "errors": [...],
  "warnings": [...]
}
```

## 🛠️ Troubleshooting Common Issues

### Database Connection Issues
1. **Check environment variables:**
   ```bash
   echo $DATABASE_URL
   ```

2. **Test database connection:**
   ```bash
   npm run debug:health
   ```

3. **Common solutions:**
   - Verify DATABASE_URL is correct
   - Check if Supabase project is active
   - Ensure network connectivity
   - Verify SSL settings

### Authentication Issues
1. **Check JWT configuration:**
   ```bash
   echo $JWT_SECRET
   echo $JWT_REFRESH_SECRET
   ```

2. **Test authentication:**
   ```bash
   npm test
   ```

3. **Common solutions:**
   - Ensure JWT secrets are set
   - Check token expiration settings
   - Verify user exists in database

### Schema Issues
1. **Run schema validation:**
   ```bash
   npm run debug:schema
   ```

2. **Common solutions:**
   - Run database migrations
   - Check for missing tables
   - Verify foreign key constraints
   - Ensure indexes are created

### Security Issues
1. **Run security tests:**
   ```bash
   npm run test:security
   ```

2. **Common solutions:**
   - Update security headers
   - Configure rate limiting
   - Fix input validation
   - Update CORS settings

## 🔍 Debugging Checklist

### Before Running Tests
- [ ] Server is running (`npm start` or `npm run dev`)
- [ ] Database is connected
- [ ] Environment variables are set
- [ ] All dependencies are installed

### Critical Issues to Fix First
1. **Missing environment variables**
2. **Database connection failures**
3. **Schema validation errors**
4. **Security vulnerabilities**
5. **Authentication failures**

### Performance Issues
1. **Slow database queries**
2. **Missing indexes**
3. **Connection pool issues**
4. **Memory leaks**

## 📈 Performance Benchmarks

### Expected Performance
- **API Response Time:** < 200ms average
- **Database Queries:** < 50ms average
- **File Uploads:** Handle 5MB+ files smoothly
- **Concurrent Requests:** Support 100+ simultaneous users
- **Memory Usage:** < 512MB for typical usage

### Monitoring Commands
```bash
# Check system performance
npm run debug:health

# Monitor database performance
node -e "require('./src/utils/debugger').checkDatabasePerformance()"

# Check active sessions
node -e "require('./src/utils/debugger').checkActiveSessions()"
```

## 🚨 Emergency Debugging

### System Won't Start
1. **Check environment:**
   ```bash
   npm run debug:system
   ```

2. **Check logs:**
   ```bash
   npm start 2>&1 | tee startup.log
   ```

3. **Test database:**
   ```bash
   node database/test-connection.js
   ```

### Authentication Broken
1. **Check JWT configuration:**
   ```bash
   node -e "console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'SET' : 'MISSING')"
   ```

2. **Test login:**
   ```bash
   curl -X POST http://localhost:5000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@edufam.com","password":"TempAdmin123!","userType":"admin_user"}'
   ```

### Database Issues
1. **Check connection:**
   ```bash
   node database/test-connection.js
   ```

2. **Validate schema:**
   ```bash
   npm run debug:schema
   ```

3. **Check migrations:**
   ```bash
   node database/migrate.js
   ```

## 📝 Generating Reports

### Automated Reports
All debugging tools generate JSON reports automatically:
- `comprehensive-debug-report.json`
- `backend-test-report.json`
- `security-test-report.json`

### Custom Reports
```javascript
const SystemDebugger = require('./debug-system');
const debugger = new SystemDebugger();

// Run specific checks
await debugger.checkEnvironmentConfiguration();
await debugger.runDatabaseHealthCheck();

// Generate custom report
debugger.generateComprehensiveReport();
```

## 🔄 Continuous Integration

### Pre-commit Checks
```bash
# Run all tests before committing
npm test && npm run test:security && npm run debug:schema
```

### Automated Testing
```bash
# Run complete system validation
npm run debug:system

# Check exit code for CI/CD
if [ $? -eq 0 ]; then
  echo "All tests passed"
else
  echo "Tests failed"
  exit 1
fi
```

## 📞 Getting Help

### Common Error Messages
- **"Database connection failed"**: Check DATABASE_URL and network
- **"JWT secrets are required"**: Set JWT_SECRET and JWT_REFRESH_SECRET
- **"Schema validation failed"**: Run database migrations
- **"Security vulnerabilities detected"**: Review security test results

### Debugging Workflow
1. **Identify the issue** using appropriate test
2. **Check the logs** for detailed error messages
3. **Verify configuration** using debug tools
4. **Fix the issue** based on recommendations
5. **Re-run tests** to confirm resolution

### Support Resources
- Check generated JSON reports for detailed information
- Review console output for specific error messages
- Use individual debugging functions for targeted checks
- Consult this guide for common solutions

---

**Remember:** Always run `npm run debug:system` after making significant changes to ensure everything is working correctly! 