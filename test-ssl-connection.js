#!/usr/bin/env node

/**
 * SSL Connection Test Script
 * 
 * This script tests the database SSL configuration to ensure
 * Supabase connections work properly with self-signed certificates.
 * 
 * Usage: node test-ssl-connection.js
 */

require('dotenv').config();
const { testConnection, sessionPool, transactionPool } = require('./src/config/database');

async function testSSLConnection() {
  console.log('🧪 Testing SSL Database Connection...\n');
  
  try {
    // Test the connection
    const isConnected = await testConnection();
    
    if (isConnected) {
      console.log('\n✅ SSL Connection Test PASSED');
      console.log('🔒 Database is properly configured for SSL connections');
      
      // Show pool configuration
      console.log('\n📊 Pool Configuration:');
      console.log(`Session Pool SSL: ${JSON.stringify(sessionPool.options.ssl)}`);
      if (transactionPool) {
        console.log(`Transaction Pool SSL: ${JSON.stringify(transactionPool.options.ssl)}`);
      }
      
      process.exit(0);
    } else {
      console.log('\n❌ SSL Connection Test FAILED');
      console.log('🔧 Check your DATABASE_URL configuration');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n💥 SSL Connection Test ERROR:', error.message);
    console.error('🔧 Error details:', error.code || 'No error code');
    
    if (error.code === 'SELF_SIGNED_CERT_IN_CHAIN') {
      console.error('\n🔒 SSL Certificate Error Detected');
      console.error('🔧 Solution: Ensure your DATABASE_URL includes ?sslmode=require');
      console.error('🔧 Example: postgresql://user:pass@host:port/db?sslmode=require');
    }
    
    process.exit(1);
  }
}

// Run the test
testSSLConnection();
