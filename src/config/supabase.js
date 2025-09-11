const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Supabase configuration for production deployment
const supabaseConfig = {
  url: process.env.SUPABASE_URL,
  anonKey: process.env.SUPABASE_ANON_KEY,
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
};

// Validate required environment variables
if (!supabaseConfig.url || !supabaseConfig.serviceRoleKey) {
  console.warn('⚠️  Supabase configuration incomplete. Some features may not work.');
  console.warn('Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
}

// Create Supabase client with service role key for backend operations
const supabase = createClient(
  supabaseConfig.url,
  supabaseConfig.serviceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    },
    db: {
      schema: 'public'
    }
  }
);

// Create Supabase client with anon key for public operations
const supabaseAnon = createClient(
  supabaseConfig.url,
  supabaseConfig.anonKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    }
  }
);

/**
 * Validate Supabase JWT token from frontend
 * @param {string} token - JWT token from frontend
 * @returns {Promise<Object>} - Decoded user data
 */
const validateSupabaseJWT = async (token) => {
  try {
    if (!supabaseConfig.url || !supabaseConfig.serviceRoleKey) {
      throw new Error('Supabase not configured');
    }

    // Use Supabase client to verify the JWT
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error) {
      throw new Error(`Supabase JWT validation failed: ${error.message}`);
    }

    if (!user) {
      throw new Error('No user found in Supabase JWT');
    }

    return {
      id: user.id,
      email: user.email,
      role: user.user_metadata?.role || 'user',
      userType: user.user_metadata?.user_type || 'school_user',
      schoolId: user.user_metadata?.school_id || null,
      firstName: user.user_metadata?.first_name || '',
      lastName: user.user_metadata?.last_name || '',
      isActive: user.user_metadata?.is_active !== false,
      activationStatus: user.user_metadata?.activation_status || 'active'
    };
  } catch (error) {
    throw new Error(`Supabase JWT validation error: ${error.message}`);
  }
};

/**
 * Get Supabase client for database operations with service role
 * @returns {Object} - Supabase client
 */
const getSupabaseClient = () => supabase;

/**
 * Get Supabase client for public operations
 * @returns {Object} - Supabase anon client
 */
const getSupabaseAnonClient = () => supabaseAnon;

module.exports = {
  supabase,
  supabaseAnon,
  validateSupabaseJWT,
  getSupabaseClient,
  getSupabaseAnonClient,
  config: supabaseConfig
};
