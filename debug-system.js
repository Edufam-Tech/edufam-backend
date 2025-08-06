const DebugUtils = require('./src/utils/debugger');
const SchemaValidator = require('./database/validate-schema');
const BackendTester = require('./tests/backend-debug');
const SecurityTester = require('./tests/security-test');
const fs = require('fs');

class SystemDebugger {
  constructor() {
    this.reports = {};
    this.startTime = new Date();
  }

  async runDatabaseHealthCheck() {
    console.log('\n' + '='.repeat(80));
    console.log('🏥 DATABASE HEALTH CHECK');
    console.log('='.repeat(80));
    
    try {
      const healthReport = await DebugUtils.generateHealthReport();
      this.reports.databaseHealth = healthReport;
      
      if (healthReport) {
        console.log('✅ Database health check completed successfully');
        return true;
      } else {
        console.log('❌ Database health check failed');
        return false;
      }
    } catch (error) {
      console.error('❌ Database health check error:', error.message);
      return false;
    }
  }

  async runSchemaValidation() {
    console.log('\n' + '='.repeat(80));
    console.log('🔍 DATABASE SCHEMA VALIDATION');
    console.log('='.repeat(80));
    
    try {
      const validator = new SchemaValidator();
      await validator.runAllValidations();
      
      this.reports.schemaValidation = {
        timestamp: new Date().toISOString(),
        results: validator.validationResults,
        errors: validator.errors,
        warnings: validator.warnings
      };
      
      return validator.errors.length === 0;
    } catch (error) {
      console.error('❌ Schema validation error:', error.message);
      return false;
    }
  }

  async runBackendTests() {
    console.log('\n' + '='.repeat(80));
    console.log('🧪 BACKEND FUNCTIONALITY TESTS');
    console.log('='.repeat(80));
    
    try {
      const tester = new BackendTester();
      await tester.runAllTests();
      
      this.reports.backendTests = {
        timestamp: new Date().toISOString(),
        results: tester.testResults,
        errors: tester.errors,
        warnings: tester.warnings
      };
      
      return tester.errors.length === 0;
    } catch (error) {
      console.error('❌ Backend tests error:', error.message);
      return false;
    }
  }

  async runSecurityTests() {
    console.log('\n' + '='.repeat(80));
    console.log('🔒 SECURITY VULNERABILITY TESTS');
    console.log('='.repeat(80));
    
    try {
      const securityTester = new SecurityTester();
      await securityTester.runAllSecurityTests();
      
      this.reports.securityTests = {
        timestamp: new Date().toISOString(),
        results: securityTester.testResults,
        errors: securityTester.errors,
        warnings: securityTester.warnings
      };
      
      return securityTester.errors.length === 0;
    } catch (error) {
      console.error('❌ Security tests error:', error.message);
      return false;
    }
  }

  async checkEnvironmentConfiguration() {
    console.log('\n' + '='.repeat(80));
    console.log('⚙️  ENVIRONMENT CONFIGURATION CHECK');
    console.log('='.repeat(80));
    
    const requiredEnvVars = [
      'DATABASE_URL',
      'JWT_SECRET',
      'JWT_REFRESH_SECRET',
      'PORT'
    ];
    
    const optionalEnvVars = [
      'NODE_ENV',
      'MAINTENANCE_MODE',
      'JWT_EXPIRES_IN',
      'JWT_REFRESH_EXPIRES_IN'
    ];
    
    const envReport = {
      timestamp: new Date().toISOString(),
      required: {},
      optional: {},
      missing: [],
      warnings: []
    };
    
    console.log('📋 Required Environment Variables:');
    for (const envVar of requiredEnvVars) {
      const value = process.env[envVar];
      if (value) {
        envReport.required[envVar] = 'SET';
        console.log(`   ✅ ${envVar}: SET`);
      } else {
        envReport.required[envVar] = 'MISSING';
        envReport.missing.push(envVar);
        console.log(`   ❌ ${envVar}: MISSING`);
      }
    }
    
    console.log('\n📋 Optional Environment Variables:');
    for (const envVar of optionalEnvVars) {
      const value = process.env[envVar];
      if (value) {
        envReport.optional[envVar] = value;
        console.log(`   ✅ ${envVar}: ${value}`);
      } else {
        envReport.optional[envVar] = 'NOT_SET';
        console.log(`   ⚠️  ${envVar}: NOT SET (using default)`);
      }
    }
    
    // Check for security concerns
    if (process.env.NODE_ENV === 'production' && process.env.JWT_SECRET === 'your-secret-key') {
      envReport.warnings.push('JWT_SECRET should be changed in production');
      console.log('   ⚠️  WARNING: JWT_SECRET should be changed in production');
    }
    
    this.reports.environment = envReport;
    
    return envReport.missing.length === 0;
  }

  async checkFileSystem() {
    console.log('\n' + '='.repeat(80));
    console.log('📁 FILE SYSTEM CHECK');
    console.log('='.repeat(80));
    
    const fs = require('fs');
    const path = require('path');
    
    const fileSystemReport = {
      timestamp: new Date().toISOString(),
      directories: {},
      files: {},
      issues: []
    };
    
    // Check required directories
    const requiredDirs = [
      'uploads',
      'src',
      'src/config',
      'src/controllers',
      'src/middleware',
      'src/models',
      'src/routes',
      'src/services',
      'src/utils',
      'tests',
      'database'
    ];
    
    console.log('📁 Required Directories:');
    for (const dir of requiredDirs) {
      try {
        const stats = fs.statSync(dir);
        if (stats.isDirectory()) {
          fileSystemReport.directories[dir] = 'EXISTS';
          console.log(`   ✅ ${dir}: EXISTS`);
        } else {
          fileSystemReport.directories[dir] = 'NOT_DIRECTORY';
          fileSystemReport.issues.push(`${dir} exists but is not a directory`);
          console.log(`   ❌ ${dir}: EXISTS BUT NOT A DIRECTORY`);
        }
      } catch (error) {
        fileSystemReport.directories[dir] = 'MISSING';
        fileSystemReport.issues.push(`${dir} directory missing`);
        console.log(`   ❌ ${dir}: MISSING`);
      }
    }
    
    // Check critical files
    const criticalFiles = [
      'package.json',
      'server.js',
      'src/config/database.js',
      'src/services/authService.js',
      'src/services/userService.js',
      'database/schema.sql'
    ];
    
    console.log('\n📄 Critical Files:');
    for (const file of criticalFiles) {
      try {
        const stats = fs.statSync(file);
        if (stats.isFile()) {
          fileSystemReport.files[file] = 'EXISTS';
          console.log(`   ✅ ${file}: EXISTS (${(stats.size / 1024).toFixed(1)} KB)`);
        } else {
          fileSystemReport.files[file] = 'NOT_FILE';
          fileSystemReport.issues.push(`${file} exists but is not a file`);
          console.log(`   ❌ ${file}: EXISTS BUT NOT A FILE`);
        }
      } catch (error) {
        fileSystemReport.files[file] = 'MISSING';
        fileSystemReport.issues.push(`${file} file missing`);
        console.log(`   ❌ ${file}: MISSING`);
      }
    }
    
    // Check uploads directory permissions
    try {
      const uploadsDir = 'uploads';
      if (fs.existsSync(uploadsDir)) {
        const stats = fs.statSync(uploadsDir);
        const permissions = (stats.mode & parseInt('777', 8)).toString(8);
        console.log(`   📁 Uploads directory permissions: ${permissions}`);
        
        if (permissions !== '755' && permissions !== '777') {
          fileSystemReport.issues.push('Uploads directory may have incorrect permissions');
          console.log('   ⚠️  WARNING: Uploads directory permissions may need adjustment');
        }
      }
    } catch (error) {
      fileSystemReport.issues.push('Cannot check uploads directory permissions');
    }
    
    this.reports.fileSystem = fileSystemReport;
    
    return fileSystemReport.issues.length === 0;
  }

  async checkDependencies() {
    console.log('\n' + '='.repeat(80));
    console.log('📦 DEPENDENCIES CHECK');
    console.log('='.repeat(80));
    
    try {
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      
      const dependenciesReport = {
        timestamp: new Date().toISOString(),
        dependencies: packageJson.dependencies || {},
        devDependencies: packageJson.devDependencies || {},
        scripts: packageJson.scripts || {},
        issues: []
      };
      
      console.log('📦 Production Dependencies:');
      const requiredDeps = [
        'express', 'cors', 'helmet', 'bcryptjs', 'jsonwebtoken',
        'pg', 'joi', 'winston', 'multer', 'sharp', 'dotenv'
      ];
      
      for (const dep of requiredDeps) {
        if (packageJson.dependencies[dep]) {
          console.log(`   ✅ ${dep}: ${packageJson.dependencies[dep]}`);
        } else {
          console.log(`   ❌ ${dep}: MISSING`);
          dependenciesReport.issues.push(`Missing required dependency: ${dep}`);
        }
      }
      
      console.log('\n🔧 Development Dependencies:');
      const requiredDevDeps = [
        'nodemon', 'jest', 'supertest', 'eslint'
      ];
      
      for (const dep of requiredDevDeps) {
        if (packageJson.devDependencies[dep]) {
          console.log(`   ✅ ${dep}: ${packageJson.devDependencies[dep]}`);
        } else {
          console.log(`   ⚠️  ${dep}: MISSING (optional)`);
        }
      }
      
      console.log('\n📜 Available Scripts:');
      for (const [script, command] of Object.entries(packageJson.scripts)) {
        console.log(`   📝 ${script}: ${command}`);
      }
      
      this.reports.dependencies = dependenciesReport;
      
      return dependenciesReport.issues.length === 0;
    } catch (error) {
      console.error('❌ Dependencies check error:', error.message);
      return false;
    }
  }

  generateComprehensiveReport() {
    console.log('\n' + '='.repeat(80));
    console.log('📊 COMPREHENSIVE SYSTEM DEBUG REPORT');
    console.log('='.repeat(80));
    
    const endTime = new Date();
    const duration = (endTime - this.startTime) / 1000;
    
    // Calculate overall status
    const allReports = Object.values(this.reports);
    const totalIssues = allReports.reduce((sum, report) => {
      return sum + (report.errors?.length || 0) + (report.issues?.length || 0) + (report.missing?.length || 0);
    }, 0);
    
    const totalWarnings = allReports.reduce((sum, report) => {
      return sum + (report.warnings?.length || 0);
    }, 0);
    
    console.log(`\n⏱️  Debug Duration: ${duration.toFixed(2)} seconds`);
    console.log(`📊 Total Issues Found: ${totalIssues}`);
    console.log(`⚠️  Total Warnings: ${totalWarnings}`);
    
    // Overall system status
    if (totalIssues === 0) {
      console.log('\n🎉 SYSTEM STATUS: EXCELLENT - All systems operational!');
    } else if (totalIssues <= 5) {
      console.log('\n✅ SYSTEM STATUS: GOOD - Minor issues detected');
    } else if (totalIssues <= 10) {
      console.log('\n⚠️  SYSTEM STATUS: FAIR - Several issues need attention');
    } else {
      console.log('\n❌ SYSTEM STATUS: POOR - Critical issues detected');
    }
    
    // Priority recommendations
    console.log('\n💡 PRIORITY RECOMMENDATIONS:');
    
    if (totalIssues === 0) {
      console.log('   🟢 System is ready for production deployment');
      console.log('   🟢 All security measures are in place');
      console.log('   🟢 Database schema is properly configured');
    } else {
      // Critical issues first
      const criticalIssues = [];
      
      if (this.reports.environment?.missing?.length > 0) {
        criticalIssues.push(`Fix ${this.reports.environment.missing.length} missing environment variables`);
      }
      
      if (this.reports.schemaValidation?.errors?.length > 0) {
        criticalIssues.push(`Fix ${this.reports.schemaValidation.errors.length} database schema issues`);
      }
      
      if (this.reports.securityTests?.errors?.length > 0) {
        criticalIssues.push(`Fix ${this.reports.securityTests.errors.length} security vulnerabilities`);
      }
      
      if (this.reports.backendTests?.errors?.length > 0) {
        criticalIssues.push(`Fix ${this.reports.backendTests.errors.length} backend functionality issues`);
      }
      
      criticalIssues.forEach(issue => {
        console.log(`   🔴 CRITICAL: ${issue}`);
      });
      
      // Warnings
      if (totalWarnings > 0) {
        console.log(`   🟡 MEDIUM: Address ${totalWarnings} warnings for better performance/security`);
      }
    }
    
    // Save comprehensive report
    const comprehensiveReport = {
      timestamp: new Date().toISOString(),
      duration: duration,
      summary: {
        totalIssues,
        totalWarnings,
        systemStatus: totalIssues === 0 ? 'EXCELLENT' : totalIssues <= 5 ? 'GOOD' : totalIssues <= 10 ? 'FAIR' : 'POOR'
      },
      reports: this.reports
    };
    
    fs.writeFileSync('comprehensive-debug-report.json', JSON.stringify(comprehensiveReport, null, 2));
    console.log(`\n📄 Comprehensive report saved to: comprehensive-debug-report.json`);
    
    console.log('\n' + '='.repeat(80));
  }

  async runFullSystemDebug() {
    console.log('🚀 Starting Comprehensive System Debug...\n');
    console.log('This will check all aspects of the Edufam backend system');
    console.log('='.repeat(80));
    
    const results = {
      environment: await this.checkEnvironmentConfiguration(),
      fileSystem: await this.checkFileSystem(),
      dependencies: await this.checkDependencies(),
      databaseHealth: await this.runDatabaseHealthCheck(),
      schemaValidation: await this.runSchemaValidation(),
      backendTests: await this.runBackendTests(),
      securityTests: await this.runSecurityTests()
    };
    
    this.generateComprehensiveReport();
    
    return results;
  }
}

// Run debug if script is executed directly
if (require.main === module) {
  const systemDebugger = new SystemDebugger();
  systemDebugger.runFullSystemDebug().catch(console.error);
}

module.exports = SystemDebugger; 