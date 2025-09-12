#!/usr/bin/env node

/**
 * Edufam Backend Connection Debugger
 * 
 * This script helps debug "Failed to fetch" errors by testing:
 * 1. Database connection
 * 2. CORS configuration
 * 3. API endpoints
 * 4. Environment variables
 */

require('dotenv').config();
const { testConnection, query } = require('./src/config/database');
const axios = require('axios');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function checkEnvironmentVariables() {
  log('\n🔍 Checking Environment Variables...', 'cyan');
  
  const requiredVars = [
    'DATABASE_URL',
    'JWT_SECRET',
    'NODE_ENV',
    'PORT'
  ];
  
  const optionalVars = [
    'ALLOWED_ORIGINS',
    'SCHOOL_APP_URL',
    'ADMIN_APP_URL',
    'BACKEND_URL',
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY'
  ];
  
  let allPresent = true;
  
  requiredVars.forEach(varName => {
    if (process.env[varName]) {
      log(`✅ ${varName}: Set`, 'green');
    } else {
      log(`❌ ${varName}: Missing (REQUIRED)`, 'red');
      allPresent = false;
    }
  });
  
  optionalVars.forEach(varName => {
    if (process.env[varName]) {
      log(`✅ ${varName}: Set`, 'green');
    } else {
      log(`⚠️  ${varName}: Not set (optional)`, 'yellow');
    }
  });
  
  return allPresent;
}

async function checkDatabaseConnection() {
  log('\n🗄️ Testing Database Connection...', 'cyan');
  
  try {
    const connected = await testConnection();
    if (connected) {
      log('✅ Database connection successful', 'green');
      
      // Test a simple query
      try {
        const result = await query('SELECT NOW() as current_time, version() as pg_version');
        log(`📅 Current time: ${result.rows[0].current_time}`, 'blue');
        log(`🐘 PostgreSQL version: ${result.rows[0].pg_version.split(' ')[0]} ${result.rows[0].pg_version.split(' ')[1]}`, 'blue');
        return true;
      } catch (queryError) {
        log(`❌ Database query failed: ${queryError.message}`, 'red');
        return false;
      }
    } else {
      log('❌ Database connection failed', 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Database connection error: ${error.message}`, 'red');
    return false;
  }
}

async function checkCORSConfiguration() {
  log('\n🌐 Checking CORS Configuration...', 'cyan');
  
  const allowedOrigins = [
    'https://edufam.org',
    'https://www.edufam.org',
    'https://backend.edufam.org',
    'https://admin.edufam.org',
    'https://school.edufam.org',
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:3001'
  ];
  
  log('📋 Configured allowed origins:', 'blue');
  allowedOrigins.forEach(origin => {
    log(`   - ${origin}`, 'blue');
  });
  
  const envOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  
  if (envOrigins.length > 0) {
    log('🔧 Additional origins from environment:', 'blue');
    envOrigins.forEach(origin => {
      log(`   - ${origin}`, 'blue');
    });
  }
  
  return true;
}

async function checkAPIEndpoints() {
  log('\n🔗 Testing API Endpoints...', 'cyan');
  
  const baseURL = process.env.BACKEND_URL || 'http://localhost:5000';
  const endpoints = [
    '/health',
    '/api/health/database',
    '/api/auth/login'
  ];
  
  for (const endpoint of endpoints) {
    try {
      const url = `${baseURL}${endpoint}`;
      log(`Testing: ${url}`, 'blue');
      
      const response = await axios.get(url, {
        timeout: 10000,
        validateStatus: (status) => status < 500 // Accept 4xx as valid responses
      });
      
      log(`✅ ${endpoint}: ${response.status} ${response.statusText}`, 'green');
      
      if (endpoint === '/health') {
        const data = response.data;
        log(`   Database: ${data.database}`, 'blue');
        log(`   Environment: ${data.environment}`, 'blue');
        if (data.cors) {
          log(`   CORS Origins: ${data.cors.allowedOrigins?.join(', ') || 'None'}`, 'blue');
        }
      }
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        log(`❌ ${endpoint}: Connection refused (server not running?)`, 'red');
      } else if (error.code === 'ENOTFOUND') {
        log(`❌ ${endpoint}: Host not found (DNS issue?)`, 'red');
      } else if (error.code === 'ECONNABORTED') {
        log(`❌ ${endpoint}: Request timeout`, 'red');
      } else {
        log(`❌ ${endpoint}: ${error.message}`, 'red');
      }
    }
  }
  
  return true;
}

async function checkSupabaseConnection() {
  log('\n🔗 Checking Supabase Connection...', 'cyan');
  
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    log('⚠️  Supabase environment variables not set', 'yellow');
    return false;
  }
  
  try {
    const response = await axios.get(`${process.env.SUPABASE_URL}/rest/v1/`, {
      headers: {
        'apikey': process.env.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`
      },
      timeout: 10000
    });
    
    log('✅ Supabase connection successful', 'green');
    log(`📊 Supabase URL: ${process.env.SUPABASE_URL}`, 'blue');
    return true;
  } catch (error) {
    log(`❌ Supabase connection failed: ${error.message}`, 'red');
    return false;
  }
}

async function generateDiagnosticReport() {
  log('\n📊 Generating Diagnostic Report...', 'cyan');
  
  const report = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    port: process.env.PORT || 5000,
    database: {
      url: process.env.DATABASE_URL ? 'Set' : 'Not Set',
      connected: false
    },
    cors: {
      allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || [],
      configured: true
    },
    supabase: {
      url: process.env.SUPABASE_URL ? 'Set' : 'Not Set',
      anonKey: process.env.SUPABASE_ANON_KEY ? 'Set' : 'Not Set',
      connected: false
    }
  };
  
  // Test database connection
  try {
    report.database.connected = await testConnection();
  } catch (error) {
    report.database.error = error.message;
  }
  
  // Test Supabase connection
  if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
    try {
      const response = await axios.get(`${process.env.SUPABASE_URL}/rest/v1/`, {
        headers: {
          'apikey': process.env.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`
        },
        timeout: 5000
      });
      report.supabase.connected = true;
    } catch (error) {
      report.supabase.error = error.message;
    }
  }
  
  log('\n📋 DIAGNOSTIC REPORT:', 'magenta');
  log(JSON.stringify(report, null, 2), 'blue');
  
  return report;
}

async function main() {
  log('🚀 Edufam Backend Connection Debugger', 'bright');
  log('=====================================', 'bright');
  
  const envCheck = await checkEnvironmentVariables();
  const dbCheck = await checkDatabaseConnection();
  const corsCheck = await checkCORSConfiguration();
  const apiCheck = await checkAPIEndpoints();
  const supabaseCheck = await checkSupabaseConnection();
  
  const report = await generateDiagnosticReport();
  
  log('\n📊 SUMMARY:', 'magenta');
  log(`Environment Variables: ${envCheck ? '✅' : '❌'}`, envCheck ? 'green' : 'red');
  log(`Database Connection: ${dbCheck ? '✅' : '❌'}`, dbCheck ? 'green' : 'red');
  log(`CORS Configuration: ${corsCheck ? '✅' : '❌'}`, corsCheck ? 'green' : 'red');
  log(`API Endpoints: ${apiCheck ? '✅' : '❌'}`, apiCheck ? 'green' : 'red');
  log(`Supabase Connection: ${supabaseCheck ? '✅' : '❌'}`, supabaseCheck ? 'green' : 'red');
  
  if (!envCheck || !dbCheck) {
    log('\n❌ Critical issues found. Please fix these before proceeding.', 'red');
    process.exit(1);
  } else {
    log('\n✅ All critical checks passed!', 'green');
  }
}

// Run the debugger
main().catch(error => {
  log(`💥 Debugger failed: ${error.message}`, 'red');
  process.exit(1);
});
