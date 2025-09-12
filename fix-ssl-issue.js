#!/usr/bin/env node

/**
 * Quick Fix for SSL Certificate Issue
 * 
 * This script sets up the environment to fix the SSL certificate error
 * Run with: node fix-ssl-issue.js
 */

const fs = require('fs');
const path = require('path');

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

function main() {
  log('\n🔧 Fixing SSL Certificate Issue\n', 'bold');
  
  try {
    // Set environment variable for SSL
    process.env.SSL_REJECT_UNAUTHORIZED = 'false';
    process.env.NODE_ENV = 'development';
    
    log('✅ Environment variables set:', 'green');
    log('   SSL_REJECT_UNAUTHORIZED=false', 'blue');
    log('   NODE_ENV=development', 'blue');
    
    // Check if .env file exists
    const envPath = path.join(__dirname, '.env');
    if (fs.existsSync(envPath)) {
      log('\n📁 .env file found, updating SSL configuration...', 'blue');
      
      let envContent = fs.readFileSync(envPath, 'utf8');
      
      // Add or update SSL configuration
      if (envContent.includes('SSL_REJECT_UNAUTHORIZED')) {
        envContent = envContent.replace(
          /SSL_REJECT_UNAUTHORIZED=.*/,
          'SSL_REJECT_UNAUTHORIZED=false'
        );
        log('   ✅ Updated existing SSL_REJECT_UNAUTHORIZED setting', 'green');
      } else {
        envContent += '\n# SSL Configuration for local development\nSSL_REJECT_UNAUTHORIZED=false\n';
        log('   ✅ Added SSL_REJECT_UNAUTHORIZED setting', 'green');
      }
      
      fs.writeFileSync(envPath, envContent);
    } else {
      log('\n📁 Creating .env file with SSL configuration...', 'blue');
      
      const envContent = `# SSL Configuration for local development
SSL_REJECT_UNAUTHORIZED=false
NODE_ENV=development

# Add your database URLs here
# DATABASE_URL_SESSION=postgresql://user:password@host:5432/database
# JWT_SECRET=your-super-secret-jwt-key-here
# JWT_REFRESH_SECRET=your-super-secret-refresh-key-here
`;
      
      fs.writeFileSync(envPath, envContent);
      log('   ✅ .env file created', 'green');
    }
    
    log('\n🎉 SSL issue fixed!', 'bold');
    log('==================', 'bold');
    
    log('\n💡 Now you can run:', 'yellow');
    log('   node test-migration.js', 'yellow');
    log('   node run-migration.js', 'yellow');
    
    log('\n⚠️  Important notes:', 'blue');
    log('• This disables SSL certificate verification for local development', 'blue');
    log('• For production, set SSL_REJECT_UNAUTHORIZED=true or remove it', 'blue');
    log('• Make sure your database URLs are correct in .env file', 'blue');
    
  } catch (error) {
    log(`\n💥 Fix failed: ${error.message}`, 'red');
    process.exit(1);
  }
}

// Run the fix
main();
