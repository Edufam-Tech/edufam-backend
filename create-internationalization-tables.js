const { Pool } = require('pg');

/**
 * Create Internationalization Tables Directly
 */

async function createInternationalizationTables() {
  console.log('🚀 Creating Internationalization Tables');
  console.log('=======================================');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/edufam_db'
  });

  try {
    console.log('🔌 Testing database connection...');
    const client = await pool.connect();
    console.log('✅ Database connection successful');
    client.release();

    // Create tables one by one
    console.log('\n📄 Creating internationalization tables...');

    // 1. Supported Languages
    await pool.query(`
      CREATE TABLE IF NOT EXISTS languages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        language_code VARCHAR(10) UNIQUE NOT NULL,
        language_name VARCHAR(100) NOT NULL,
        english_name VARCHAR(100) NOT NULL,
        direction VARCHAR(3) DEFAULT 'ltr' CHECK (direction IN ('ltr', 'rtl')),
        is_default BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT true,
        completion_percentage DECIMAL(5,2) DEFAULT 0.00,
        date_format VARCHAR(50) DEFAULT 'DD/MM/YYYY',
        time_format VARCHAR(50) DEFAULT '24h',
        number_format JSONB DEFAULT '{"decimal": ".", "thousands": ","}',
        currency_format JSONB DEFAULT '{"symbol": "KES", "position": "before"}',
        flag_icon VARCHAR(10),
        locale VARCHAR(10),
        pluralization_rules JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('   ✅ languages table created');

    // 2. Translation Namespaces
    await pool.query(`
      CREATE TABLE IF NOT EXISTS translation_namespaces (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        namespace_name VARCHAR(100) UNIQUE NOT NULL,
        description TEXT,
        is_system BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('   ✅ translation_namespaces table created');

    // 3. Translation Keys
    await pool.query(`
      CREATE TABLE IF NOT EXISTS translation_keys (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        namespace_id UUID NOT NULL REFERENCES translation_namespaces(id) ON DELETE CASCADE,
        key_name VARCHAR(255) NOT NULL,
        key_description TEXT,
        default_value TEXT,
        context_info TEXT,
        max_length INTEGER,
        is_html BOOLEAN DEFAULT false,
        is_plural BOOLEAN DEFAULT false,
        tags TEXT[],
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(namespace_id, key_name)
      )
    `);
    console.log('   ✅ translation_keys table created');

    // 4. Translations
    await pool.query(`
      CREATE TABLE IF NOT EXISTS translations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        translation_key_id UUID NOT NULL REFERENCES translation_keys(id) ON DELETE CASCADE,
        language_id UUID NOT NULL REFERENCES languages(id) ON DELETE CASCADE,
        translated_value TEXT NOT NULL,
        plural_forms JSONB,
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'translated', 'reviewed', 'approved')),
        translator_id UUID REFERENCES users(id) ON DELETE SET NULL,
        reviewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
        translated_at TIMESTAMP,
        reviewed_at TIMESTAMP,
        approved_at TIMESTAMP,
        confidence_level VARCHAR(20) DEFAULT 'medium' CHECK (confidence_level IN ('low', 'medium', 'high')),
        translation_notes TEXT,
        review_notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(translation_key_id, language_id)
      )
    `);
    console.log('   ✅ translations table created');

    // 5. User Language Preferences
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_language_preferences (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
        primary_language_id UUID NOT NULL REFERENCES languages(id) ON DELETE RESTRICT,
        fallback_language_id UUID REFERENCES languages(id) ON DELETE SET NULL,
        timezone VARCHAR(50) DEFAULT 'Africa/Nairobi',
        date_format VARCHAR(50),
        time_format VARCHAR(50),
        number_format JSONB,
        currency_format JSONB,
        auto_detect_language BOOLEAN DEFAULT true,
        browser_language_priority BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id)
      )
    `);
    console.log('   ✅ user_language_preferences table created');

    // 6. School Language Settings
    await pool.query(`
      CREATE TABLE IF NOT EXISTS school_language_settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        default_language_id UUID NOT NULL REFERENCES languages(id) ON DELETE RESTRICT,
        supported_languages UUID[] NOT NULL,
        custom_translations JSONB DEFAULT '{}',
        branding_translations JSONB DEFAULT '{}',
        instruction_language_id UUID REFERENCES languages(id),
        curriculum_language_mapping JSONB,
        grade_level_language_requirements JSONB,
        parent_communication_language_id UUID REFERENCES languages(id),
        default_report_language_id UUID REFERENCES languages(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(school_id)
      )
    `);
    console.log('   ✅ school_language_settings table created');

    // 7. Content Localizations
    await pool.query(`
      CREATE TABLE IF NOT EXISTS content_localizations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        content_type VARCHAR(50) NOT NULL,
        content_id UUID NOT NULL,
        language_id UUID NOT NULL REFERENCES languages(id) ON DELETE CASCADE,
        school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
        title TEXT,
        content TEXT,
        summary TEXT,
        meta_description TEXT,
        keywords TEXT[],
        localized_by UUID REFERENCES users(id) ON DELETE SET NULL,
        reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
        localization_status VARCHAR(20) DEFAULT 'draft' CHECK (localization_status IN ('draft', 'translated', 'reviewed', 'published')),
        custom_fields JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(content_type, content_id, language_id)
      )
    `);
    console.log('   ✅ content_localizations table created');

    // 8. Translation Memory
    await pool.query(`
      CREATE TABLE IF NOT EXISTS translation_memory (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        source_language_id UUID NOT NULL REFERENCES languages(id) ON DELETE CASCADE,
        target_language_id UUID NOT NULL REFERENCES languages(id) ON DELETE CASCADE,
        source_text TEXT NOT NULL,
        target_text TEXT NOT NULL,
        context_type VARCHAR(50),
        usage_count INTEGER DEFAULT 1,
        confidence_score DECIMAL(5,4) DEFAULT 1.0000,
        created_from VARCHAR(50),
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        last_used TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(source_language_id, target_language_id, source_text)
      )
    `);
    console.log('   ✅ translation_memory table created');

    // 9. Localization Analytics
    await pool.query(`
      CREATE TABLE IF NOT EXISTS localization_analytics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        metric_type VARCHAR(50) NOT NULL,
        language_id UUID REFERENCES languages(id) ON DELETE CASCADE,
        school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        metric_date DATE NOT NULL,
        metric_value DECIMAL(15,4) NOT NULL,
        metric_metadata JSONB,
        content_type VARCHAR(50),
        platform VARCHAR(20),
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('   ✅ localization_analytics table created');

    // Create indexes
    console.log('\n📄 Creating indexes...');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_languages_code ON languages(language_code)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_languages_default ON languages(is_default) WHERE is_default = true');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_languages_active ON languages(is_active) WHERE is_active = true');

    await pool.query('CREATE INDEX IF NOT EXISTS idx_translation_namespaces_name ON translation_namespaces(namespace_name)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_translation_namespaces_system ON translation_namespaces(is_system)');

    await pool.query('CREATE INDEX IF NOT EXISTS idx_translation_keys_namespace ON translation_keys(namespace_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_translation_keys_name ON translation_keys(key_name)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_translation_keys_namespace_name ON translation_keys(namespace_id, key_name)');

    await pool.query('CREATE INDEX IF NOT EXISTS idx_translations_key ON translations(translation_key_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_translations_language ON translations(language_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_translations_status ON translations(status)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_translations_key_language ON translations(translation_key_id, language_id)');

    await pool.query('CREATE INDEX IF NOT EXISTS idx_user_language_preferences_user ON user_language_preferences(user_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_user_language_preferences_school ON user_language_preferences(school_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_user_language_preferences_language ON user_language_preferences(primary_language_id)');

    await pool.query('CREATE INDEX IF NOT EXISTS idx_school_language_settings_school ON school_language_settings(school_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_school_language_settings_default_lang ON school_language_settings(default_language_id)');

    await pool.query('CREATE INDEX IF NOT EXISTS idx_content_localizations_content ON content_localizations(content_type, content_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_content_localizations_language ON content_localizations(language_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_content_localizations_school ON content_localizations(school_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_content_localizations_status ON content_localizations(localization_status)');

    await pool.query('CREATE INDEX IF NOT EXISTS idx_translation_memory_source_target ON translation_memory(source_language_id, target_language_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_translation_memory_source_text ON translation_memory(source_text)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_translation_memory_usage ON translation_memory(usage_count DESC)');

    await pool.query('CREATE INDEX IF NOT EXISTS idx_localization_analytics_type ON localization_analytics(metric_type)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_localization_analytics_date ON localization_analytics(metric_date)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_localization_analytics_language ON localization_analytics(language_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_localization_analytics_school ON localization_analytics(school_id)');
    console.log('   ✅ Indexes created');

    // Insert initial data
    console.log('\n📄 Inserting initial internationalization data...');
    
    // Insert languages
    await pool.query(`
      INSERT INTO languages (language_code, language_name, english_name, is_default, is_active, direction, flag_icon, locale) VALUES
      ('en', 'English', 'English', true, true, 'ltr', '🇺🇸', 'en-US'),
      ('sw', 'Kiswahili', 'Swahili', false, true, 'ltr', '🇰🇪', 'sw-KE'),
      ('fr', 'Français', 'French', false, true, 'ltr', '🇫🇷', 'fr-FR'),
      ('ar', 'العربية', 'Arabic', false, true, 'rtl', '🇸🇦', 'ar-SA'),
      ('es', 'Español', 'Spanish', false, true, 'ltr', '🇪🇸', 'es-ES')
      ON CONFLICT (language_code) DO NOTHING
    `);
    console.log('   ✅ Languages inserted');

    // Insert translation namespaces
    await pool.query(`
      INSERT INTO translation_namespaces (namespace_name, description, is_system) VALUES
      ('common', 'Common UI elements and messages', true),
      ('auth', 'Authentication and authorization', true),
      ('navigation', 'Navigation menus and breadcrumbs', true),
      ('forms', 'Form labels, placeholders, and validation', true),
      ('academic', 'Academic-related content', true),
      ('financial', 'Financial and fee-related content', true),
      ('communication', 'Messages and communication', true),
      ('reports', 'Report labels and content', true),
      ('admin', 'Administration interface', true),
      ('mobile', 'Mobile app specific content', true),
      ('errors', 'Error messages and alerts', true),
      ('validation', 'Validation messages', true)
      ON CONFLICT (namespace_name) DO NOTHING
    `);
    console.log('   ✅ Translation namespaces inserted');

    // Insert basic translation keys and translations
    const commonNsResult = await pool.query("SELECT id FROM translation_namespaces WHERE namespace_name = 'common'");
    const authNsResult = await pool.query("SELECT id FROM translation_namespaces WHERE namespace_name = 'auth'");
    const formsNsResult = await pool.query("SELECT id FROM translation_namespaces WHERE namespace_name = 'forms'");
    
    if (commonNsResult.rows.length > 0 && authNsResult.rows.length > 0 && formsNsResult.rows.length > 0) {
      const commonNsId = commonNsResult.rows[0].id;
      const authNsId = authNsResult.rows[0].id;
      const formsNsId = formsNsResult.rows[0].id;

      // Insert translation keys
      await pool.query(`
        INSERT INTO translation_keys (namespace_id, key_name, default_value, key_description) VALUES
        ($1, 'welcome', 'Welcome', 'Welcome message'),
        ($1, 'save', 'Save', 'Save button text'),
        ($1, 'cancel', 'Cancel', 'Cancel button text'),
        ($1, 'delete', 'Delete', 'Delete button text'),
        ($1, 'edit', 'Edit', 'Edit button text'),
        ($1, 'view', 'View', 'View button text'),
        ($1, 'loading', 'Loading...', 'Loading indicator text'),
        ($1, 'success', 'Success', 'Success message'),
        ($1, 'error', 'Error', 'Error message'),
        ($1, 'warning', 'Warning', 'Warning message'),
        
        ($2, 'login', 'Login', 'Login button text'),
        ($2, 'logout', 'Logout', 'Logout button text'),
        ($2, 'email', 'Email', 'Email field label'),
        ($2, 'password', 'Password', 'Password field label'),
        ($2, 'forgot_password', 'Forgot Password?', 'Forgot password link text'),
        ($2, 'remember_me', 'Remember Me', 'Remember me checkbox label'),
        
        ($3, 'required_field', 'This field is required', 'Required field validation message'),
        ($3, 'invalid_email', 'Please enter a valid email address', 'Invalid email validation message'),
        ($3, 'password_too_short', 'Password must be at least 8 characters', 'Password length validation'),
        ($3, 'confirm_password', 'Confirm Password', 'Confirm password field label')
        ON CONFLICT (namespace_id, key_name) DO NOTHING
      `, [commonNsId, authNsId, formsNsId]);
      console.log('   ✅ Translation keys inserted');

      // Get language IDs
      const enResult = await pool.query("SELECT id FROM languages WHERE language_code = 'en'");
      const swResult = await pool.query("SELECT id FROM languages WHERE language_code = 'sw'");
      
      if (enResult.rows.length > 0 && swResult.rows.length > 0) {
        const enId = enResult.rows[0].id;
        const swId = swResult.rows[0].id;

        // Insert English translations (same as default values)
        await pool.query(`
          INSERT INTO translations (translation_key_id, language_id, translated_value, status) 
          SELECT tk.id, $1, tk.default_value, 'approved'
          FROM translation_keys tk
          ON CONFLICT (translation_key_id, language_id) DO NOTHING
        `, [enId]);

        // Insert Swahili translations
        const translations = [
          ['welcome', 'Karibu'],
          ['save', 'Hifadhi'],
          ['cancel', 'Ghairi'],
          ['delete', 'Futa'],
          ['edit', 'Hariri'],
          ['view', 'Ona'],
          ['loading', 'Inapakia...'],
          ['success', 'Mafanikio'],
          ['error', 'Kosa'],
          ['warning', 'Onyo'],
          ['login', 'Ingia'],
          ['logout', 'Toka'],
          ['email', 'Barua pepe'],
          ['password', 'Nenosiri'],
          ['forgot_password', 'Umesahau nenosiri?'],
          ['remember_me', 'Nikumbuke'],
          ['required_field', 'Sehemu hii inahitajika'],
          ['invalid_email', 'Tafadhali ingiza anwani sahihi ya barua pepe'],
          ['password_too_short', 'Nenosiri lazima liwe na angalau herufi 8'],
          ['confirm_password', 'Thibitisha Nenosiri']
        ];

        for (const [keyName, swTranslation] of translations) {
          await pool.query(`
            INSERT INTO translations (translation_key_id, language_id, translated_value, status)
            SELECT tk.id, $1, $2, 'approved'
            FROM translation_keys tk
            WHERE tk.key_name = $3
            ON CONFLICT (translation_key_id, language_id) DO NOTHING
          `, [swId, swTranslation, keyName]);
        }

        console.log('   ✅ Basic translations inserted');
      }
    }

    // Validate tables
    console.log('\n🔍 Validating tables...');
    const validation = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND (table_name LIKE 'language%' OR table_name LIKE 'translation%' OR table_name LIKE 'content_localizations%' OR table_name LIKE 'localization_%')
      ORDER BY table_name
    `);

    console.log('📋 Created Internationalization Tables:');
    validation.rows.forEach(row => {
      console.log(`   ✅ ${row.table_name}`);
    });

    // Get counts
    console.log('\n📊 Table Statistics:');
    for (const table of validation.rows) {
      try {
        const countResult = await pool.query(`SELECT COUNT(*) FROM ${table.table_name}`);
        console.log(`   📝 ${table.table_name}: ${countResult.rows[0].count} records`);
      } catch (error) {
        console.log(`   ❌ ${table.table_name}: Error getting count`);
      }
    }

    console.log('\n🎉 Internationalization Tables Created Successfully!');
    console.log('\n🌍 Ready for Multi-Language Features:');
    console.log('   • Multi-Language Support (5 languages)');
    console.log('   • Translation Management System');
    console.log('   • Content Localization Engine');
    console.log('   • User Language Preferences');
    console.log('   • School Language Settings');
    console.log('   • Translation Memory & Reuse');
    console.log('   • Language Detection & Auto-Translation');
    console.log('   • Localization Analytics & Reporting');
    console.log('   • Cultural Settings & Adaptation');
    console.log('   • Right-to-Left (RTL) Language Support');

    console.log('\n🗣️ Supported Languages:');
    console.log('   • English (en) - Default, LTR');
    console.log('   • Kiswahili (sw) - Kenyan primary language, LTR');
    console.log('   • Français (fr) - French, LTR');
    console.log('   • العربية (ar) - Arabic, RTL');
    console.log('   • Español (es) - Spanish, LTR');

    console.log('\n📝 Translation Namespaces:');
    console.log('   • common - UI elements');
    console.log('   • auth - Authentication');
    console.log('   • navigation - Menus & navigation');
    console.log('   • forms - Form labels & validation');
    console.log('   • academic - Academic content');
    console.log('   • financial - Financial content');
    console.log('   • communication - Messages');
    console.log('   • reports - Report labels');
    console.log('   • admin - Administration interface');
    console.log('   • mobile - Mobile app content');
    console.log('   • errors - Error messages');
    console.log('   • validation - Validation messages');

  } catch (error) {
    console.error('❌ Error creating internationalization tables:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
    console.log('\n🔒 Database connection closed');
  }
}

// Load environment variables
require('dotenv').config();

// Run the creation
createInternationalizationTables();