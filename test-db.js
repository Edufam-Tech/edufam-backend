const { testConnection } = require('./src/config/database');

async function testDatabase() {
  console.log('🔍 Testing Database Connection...\n');

  try {
    const connected = await testConnection();
    if (connected) {
      console.log('✅ Database connection successful');
    } else {
      console.log('❌ Database connection failed');
    }
  } catch (error) {
    console.log('❌ Database test failed:', error.message);
  }
}

testDatabase();
