#!/usr/bin/env node

/**
 * Environment Setup Script
 * 
 * This script helps set up environment variables for local development
 * Run with: node setup-env.js
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

function createEnvFile() {
  const envPath = path.join(__dirname, '.env');
  
  // Check if .env file already exists
  if (fs.existsSync(envPath)) {
    log('⚠️  .env file already exists', 'yellow');
    log('💡 Backing up existing .env to .env.backup', 'yellow');
    fs.copyFileSync(envPath, path.join(__dirname, '.env.backup'));
  }
  
  // Create .env file with SSL configuration
  const envContent = `# Database Configuration
# Set this to your session pooler URL (port 5432)
DATABASE_URL_SESSION=postgresql://user:password@host:5432/database

# Optional: Set this to your transaction pooler URL (port 6453)
# DATABASE_URL_TRANSACTION=postgresql://user:password@host:6453/database

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here-change-this-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-key-here-change-this-in-production

# Authentication Mode
# Set to 'true' for cookie-based sessions, 'false' for JWT-only
USE_COOKIE_SESSIONS=false

# CORS Configuration
ALLOWED_ORIGINS=https://www.edufam.org,https://admin.edufam.org,https://school.edufam.org,http://localhost:3000,http://localhost:5173

# Database Pool Configuration
DB_POOL_MAX=10
DB_POOL_MIN=1
DB_IDLE_TIMEOUT_MS=30000
DB_CONN_TIMEOUT_MS=60000

# JWT Token Expiration
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Environment
NODE_ENV=development

# SSL Configuration for local development
# Set to 'false' to disable SSL verification for local development
# Set to 'true' or remove this line for production
SSL_REJECT_UNAUTHORIZED=false
`;

  fs.writeFileSync(envPath, envContent);
  log('✅ .env file created successfully', 'green');
  
  return envPath;
}

function updateDatabaseConfig() {
  const dbConfigPath = path.join(__dirname, 'src', 'config', 'database.js');
  
  if (!fs.existsSync(dbConfigPath)) {
    log('❌ Database config file not found', 'red');
    return false;
  }
  
  let content = fs.readFileSync(dbConfigPath, 'utf8');
  
  // Update SSL configuration to use environment variable
  const sslConfig = `      ssl: process.env.SSL_REJECT_UNAUTHORIZED === 'false' ? false : { rejectUnauthorized: false }`;
  
  // Replace the SSL configuration in the pool creation
  content = content.replace(
    /ssl:\s*{\s*rejectUnauthorized:\s*false\s*}/g,
    sslConfig
  );
  
  fs.writeFileSync(dbConfigPath, content);
  log('✅ Database config updated with SSL environment variable', 'green');
  
  return true;
}

function main() {
  log('\n🔧 Setting up Environment for Local Development\n', 'bold');
  
  try {
    // Create .env file
    const envPath = createEnvFile();
    log(`📁 Environment file created: ${envPath}`, 'blue');
    
    // Update database config
    if (updateDatabaseConfig()) {
      log('📁 Database config updated', 'blue');
    }
    
    log('\n🎉 Environment setup completed!', 'bold');
    log('================================', 'bold');
    
    log('\n📋 Next steps:', 'yellow');
    log('1. Edit .env file with your actual database URLs', 'yellow');
    log('2. Set your JWT secrets (use strong, random strings)', 'yellow');
    log('3. Run: node test-migration.js', 'yellow');
    log('4. Run: node run-migration.js (if needed)', 'yellow');
    
    log('\n💡 Important notes:', 'blue');
    log('• SSL_REJECT_UNAUTHORIZED=false is set for local development', 'blue');
    log('• Change this to true or remove it for production', 'blue');
    log('• Make sure your database URLs are correct', 'blue');
    log('• JWT secrets should be strong and unique', 'blue');
    
  } catch (error) {
    log(`\n💥 Setup failed: ${error.message}`, 'red');
    process.exit(1);
  }
}

// Run the setup
main();
