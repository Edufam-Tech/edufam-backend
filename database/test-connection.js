const { testConnection, closePool } = require('../src/config/database');

const runConnectionTest = async () => {
  console.log('🧪 Testing Supabase PostgreSQL connection...\n');
  
  try {
    const isConnected = await testConnection();
    
    if (isConnected) {
      console.log('\n🎉 Database connection test PASSED!');
      console.log('📋 Next steps:');
      console.log('   1. Update your .env file with actual Supabase DATABASE_URL');
      console.log('   2. Run this test again to verify connection');
      console.log('   3. Proceed to database schema creation');
    } else {
      console.log('\n❌ Database connection test FAILED!');
      console.log('📋 Troubleshooting:');
      console.log('   1. Check your DATABASE_URL in .env file');
      console.log('   2. Verify Supabase project is active');
      console.log('   3. Ensure database password is correct');
      console.log('   4. Check if IP is whitelisted in Supabase');
    }
  } catch (error) {
    console.error('\n💥 Connection test error:', error.message);
  } finally {
    await closePool();
    process.exit(0);
  }
};

// Run the test
runConnectionTest(); 