-- ====================================
-- INTERNATIONALIZATION (i18n) SYSTEM
-- ====================================
-- Multi-language support, localization, and cultural adaptation
-- Supports dynamic language switching and content localization

-- Supported Languages
CREATE TABLE languages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    language_code VARCHAR(10) UNIQUE NOT NULL, -- ISO 639-1 (e.g., 'en', 'sw') or with region (e.g., 'en-US', 'sw-KE')
    language_name VARCHAR(100) NOT NULL, -- Native name (e.g., 'English', 'Kiswahili')
    english_name VARCHAR(100) NOT NULL, -- English name for admin interface
    direction VARCHAR(3) DEFAULT 'ltr' CHECK (direction IN ('ltr', 'rtl')), -- Text direction
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    completion_percentage DECIMAL(5,2) DEFAULT 0.00, -- Translation completion percentage
    
    -- Regional/Cultural settings
    date_format VARCHAR(50) DEFAULT 'DD/MM/YYYY', -- Date display format
    time_format VARCHAR(50) DEFAULT '24h', -- 12h or 24h
    number_format JSONB DEFAULT '{"decimal": ".", "thousands": ","}', -- Number formatting
    currency_format JSONB DEFAULT '{"symbol": "KES", "position": "before"}', -- Currency formatting
    
    -- Metadata
    flag_icon VARCHAR(10), -- Unicode flag emoji or icon code
    locale VARCHAR(10), -- Full locale code (e.g., 'en-KE', 'sw-KE')
    pluralization_rules JSONB, -- Plural form rules for this language
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Translation Namespaces (for organizing translations)
CREATE TABLE translation_namespaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    namespace_name VARCHAR(100) UNIQUE NOT NULL, -- e.g., 'common', 'auth', 'academic', 'financial'
    description TEXT,
    is_system BOOLEAN DEFAULT false, -- System namespaces vs custom ones
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Translation Keys
CREATE TABLE translation_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    namespace_id UUID NOT NULL REFERENCES translation_namespaces(id) ON DELETE CASCADE,
    key_name VARCHAR(255) NOT NULL, -- Hierarchical key like 'auth.login.email_placeholder'
    key_description TEXT, -- Description for translators
    default_value TEXT, -- Default/fallback text (usually English)
    context_info TEXT, -- Context to help translators
    max_length INTEGER, -- Maximum allowed length for UI constraints
    is_html BOOLEAN DEFAULT false, -- Whether the text contains HTML
    is_plural BOOLEAN DEFAULT false, -- Whether this key supports pluralization
    tags TEXT[], -- Tags for categorization and filtering
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(namespace_id, key_name)
);

-- Translations
CREATE TABLE translations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    translation_key_id UUID NOT NULL REFERENCES translation_keys(id) ON DELETE CASCADE,
    language_id UUID NOT NULL REFERENCES languages(id) ON DELETE CASCADE,
    translated_value TEXT NOT NULL,
    
    -- Pluralization support
    plural_forms JSONB, -- Different plural forms for languages that need them
    
    -- Translation metadata
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'translated', 'reviewed', 'approved')),
    translator_id UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    translated_at TIMESTAMP,
    reviewed_at TIMESTAMP,
    approved_at TIMESTAMP,
    
    -- Quality and context
    confidence_level VARCHAR(20) DEFAULT 'medium' CHECK (confidence_level IN ('low', 'medium', 'high')),
    translation_notes TEXT, -- Notes from translator
    review_notes TEXT, -- Notes from reviewer
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(translation_key_id, language_id)
);

-- User Language Preferences
CREATE TABLE user_language_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    primary_language_id UUID NOT NULL REFERENCES languages(id) ON DELETE RESTRICT,
    fallback_language_id UUID REFERENCES languages(id) ON DELETE SET NULL,
    
    -- Regional preferences
    timezone VARCHAR(50) DEFAULT 'Africa/Nairobi',
    date_format VARCHAR(50), -- Override default date format
    time_format VARCHAR(50), -- Override default time format
    number_format JSONB, -- Override default number format
    currency_format JSONB, -- Override default currency format
    
    -- Auto-detection settings
    auto_detect_language BOOLEAN DEFAULT true,
    browser_language_priority BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id)
);

-- School Language Settings
CREATE TABLE school_language_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    default_language_id UUID NOT NULL REFERENCES languages(id) ON DELETE RESTRICT,
    supported_languages UUID[] NOT NULL, -- Array of supported language IDs
    
    -- School-specific customizations
    custom_translations JSONB DEFAULT '{}', -- School-specific translation overrides
    branding_translations JSONB DEFAULT '{}', -- School name, motto, etc. in different languages
    
    -- Academic settings
    instruction_language_id UUID REFERENCES languages(id), -- Primary instruction language
    curriculum_language_mapping JSONB, -- Map curricula to languages
    grade_level_language_requirements JSONB, -- Language requirements by grade
    
    -- Communication preferences
    parent_communication_language_id UUID REFERENCES languages(id),
    default_report_language_id UUID REFERENCES languages(id),
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(school_id)
);

-- Content Localization (for dynamic content)
CREATE TABLE content_localizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_type VARCHAR(50) NOT NULL, -- 'announcement', 'policy', 'curriculum', 'assessment', etc.
    content_id UUID NOT NULL, -- ID of the original content
    language_id UUID NOT NULL REFERENCES languages(id) ON DELETE CASCADE,
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    
    -- Localized content fields
    title TEXT,
    content TEXT,
    summary TEXT,
    meta_description TEXT,
    keywords TEXT[],
    
    -- Localization metadata
    localized_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    localization_status VARCHAR(20) DEFAULT 'draft' CHECK (localization_status IN ('draft', 'translated', 'reviewed', 'published')),
    
    -- Content-specific fields
    custom_fields JSONB, -- Additional localized fields specific to content type
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(content_type, content_id, language_id)
);

-- Translation Tasks and Workflow
CREATE TABLE translation_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_name VARCHAR(255) NOT NULL,
    task_type VARCHAR(30) NOT NULL CHECK (task_type IN ('new_translation', 'update_translation', 'review', 'bulk_import', 'quality_check')),
    description TEXT,
    
    -- Task scope
    namespace_ids UUID[], -- Specific namespaces to translate
    language_ids UUID[], -- Target languages
    key_filters JSONB, -- Filters for translation keys
    
    -- Assignment and status
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'review', 'completed', 'cancelled')),
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    
    -- Progress tracking
    total_keys INTEGER DEFAULT 0,
    completed_keys INTEGER DEFAULT 0,
    reviewed_keys INTEGER DEFAULT 0,
    progress_percentage DECIMAL(5,2) DEFAULT 0.00,
    
    -- Deadlines and timing
    due_date DATE,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    
    -- Task details
    instructions TEXT, -- Instructions for translators
    reference_materials JSONB, -- Links to reference materials
    quality_requirements JSONB, -- Quality criteria and requirements
    
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Translation Memory (for consistency and efficiency)
CREATE TABLE translation_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_language_id UUID NOT NULL REFERENCES languages(id) ON DELETE CASCADE,
    target_language_id UUID NOT NULL REFERENCES languages(id) ON DELETE CASCADE,
    source_text TEXT NOT NULL,
    target_text TEXT NOT NULL,
    
    -- Memory metadata
    context_type VARCHAR(50), -- Domain/context (academic, financial, etc.)
    usage_count INTEGER DEFAULT 1,
    confidence_score DECIMAL(5,4) DEFAULT 1.0000, -- How confident we are in this translation
    
    -- Source tracking
    created_from VARCHAR(50), -- 'manual', 'import', 'ai_suggestion', etc.
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    last_used TIMESTAMP DEFAULT NOW(),
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(source_language_id, target_language_id, source_text)
);

-- Language Detection and Auto-Translation
CREATE TABLE auto_translation_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_text TEXT NOT NULL,
    source_language_id UUID NOT NULL REFERENCES languages(id) ON DELETE CASCADE,
    target_language_id UUID NOT NULL REFERENCES languages(id) ON DELETE CASCADE,
    translated_text TEXT NOT NULL,
    
    -- Translation service info
    translation_service VARCHAR(50) NOT NULL, -- 'google', 'azure', 'aws', 'custom_ai'
    service_confidence DECIMAL(5,4), -- Confidence from translation service
    
    -- Usage and validation
    usage_count INTEGER DEFAULT 1,
    human_validated BOOLEAN DEFAULT false,
    validation_score DECIMAL(5,4), -- Human validation score
    
    -- Caching metadata
    expires_at TIMESTAMP, -- When this cached translation expires
    last_used TIMESTAMP DEFAULT NOW(),
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(source_text, source_language_id, target_language_id)
);

-- Localization Analytics
CREATE TABLE localization_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_type VARCHAR(50) NOT NULL, -- 'language_usage', 'translation_requests', 'missing_translations'
    language_id UUID REFERENCES languages(id) ON DELETE CASCADE,
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Metric data
    metric_date DATE NOT NULL,
    metric_value DECIMAL(15,4) NOT NULL,
    metric_metadata JSONB, -- Additional metric details
    
    -- Context
    content_type VARCHAR(50), -- What type of content was accessed
    platform VARCHAR(20), -- web, mobile, api
    user_agent TEXT,
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- Regional and Cultural Settings
CREATE TABLE cultural_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    language_id UUID NOT NULL REFERENCES languages(id) ON DELETE CASCADE,
    country_code VARCHAR(2), -- ISO 3166-1 alpha-2 country code
    region_name VARCHAR(100),
    
    -- Calendar and time settings
    calendar_system VARCHAR(50) DEFAULT 'gregorian', -- gregorian, islamic, etc.
    week_start_day INTEGER DEFAULT 1 CHECK (week_start_day >= 0 AND week_start_day <= 6), -- 0 = Sunday, 1 = Monday
    weekend_days INTEGER[] DEFAULT '{0,6}', -- Weekend days (0-6)
    
    -- Academic calendar
    academic_year_start_month INTEGER DEFAULT 1, -- Month when academic year starts
    holiday_calendar JSONB, -- National/religious holidays
    
    -- Educational preferences
    grading_system VARCHAR(50), -- Letter grades, percentage, etc.
    assessment_traditions JSONB, -- Cultural assessment preferences
    
    -- Communication norms
    formal_address_required BOOLEAN DEFAULT false,
    honorific_titles JSONB, -- Cultural titles and honorifics
    communication_etiquette JSONB, -- Cultural communication norms
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(language_id, country_code)
);

-- Indexes for performance
CREATE INDEX idx_languages_code ON languages(language_code);
CREATE INDEX idx_languages_default ON languages(is_default) WHERE is_default = true;
CREATE INDEX idx_languages_active ON languages(is_active) WHERE is_active = true;

CREATE INDEX idx_translation_namespaces_name ON translation_namespaces(namespace_name);
CREATE INDEX idx_translation_namespaces_system ON translation_namespaces(is_system);

CREATE INDEX idx_translation_keys_namespace ON translation_keys(namespace_id);
CREATE INDEX idx_translation_keys_name ON translation_keys(key_name);
CREATE INDEX idx_translation_keys_namespace_name ON translation_keys(namespace_id, key_name);

CREATE INDEX idx_translations_key ON translations(translation_key_id);
CREATE INDEX idx_translations_language ON translations(language_id);
CREATE INDEX idx_translations_status ON translations(status);
CREATE INDEX idx_translations_key_language ON translations(translation_key_id, language_id);

CREATE INDEX idx_user_language_preferences_user ON user_language_preferences(user_id);
CREATE INDEX idx_user_language_preferences_school ON user_language_preferences(school_id);
CREATE INDEX idx_user_language_preferences_language ON user_language_preferences(primary_language_id);

CREATE INDEX idx_school_language_settings_school ON school_language_settings(school_id);
CREATE INDEX idx_school_language_settings_default_lang ON school_language_settings(default_language_id);

CREATE INDEX idx_content_localizations_content ON content_localizations(content_type, content_id);
CREATE INDEX idx_content_localizations_language ON content_localizations(language_id);
CREATE INDEX idx_content_localizations_school ON content_localizations(school_id);
CREATE INDEX idx_content_localizations_status ON content_localizations(localization_status);

CREATE INDEX idx_translation_tasks_assigned ON translation_tasks(assigned_to);
CREATE INDEX idx_translation_tasks_status ON translation_tasks(status);
CREATE INDEX idx_translation_tasks_priority ON translation_tasks(priority);
CREATE INDEX idx_translation_tasks_due_date ON translation_tasks(due_date);

CREATE INDEX idx_translation_memory_source_target ON translation_memory(source_language_id, target_language_id);
CREATE INDEX idx_translation_memory_source_text ON translation_memory(source_text);
CREATE INDEX idx_translation_memory_usage ON translation_memory(usage_count DESC);

CREATE INDEX idx_auto_translation_cache_source_target ON auto_translation_cache(source_language_id, target_language_id);
CREATE INDEX idx_auto_translation_cache_expires ON auto_translation_cache(expires_at);
CREATE INDEX idx_auto_translation_cache_last_used ON auto_translation_cache(last_used DESC);

CREATE INDEX idx_localization_analytics_type ON localization_analytics(metric_type);
CREATE INDEX idx_localization_analytics_date ON localization_analytics(metric_date);
CREATE INDEX idx_localization_analytics_language ON localization_analytics(language_id);
CREATE INDEX idx_localization_analytics_school ON localization_analytics(school_id);

CREATE INDEX idx_cultural_settings_language ON cultural_settings(language_id);
CREATE INDEX idx_cultural_settings_country ON cultural_settings(country_code);

-- RLS Policies for internationalization tables
ALTER TABLE user_language_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_language_preferences_own_access ON user_language_preferences 
    FOR ALL USING (user_id = current_setting('app.current_user_id')::UUID);

ALTER TABLE school_language_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY school_language_settings_school_access ON school_language_settings 
    FOR ALL USING (school_id = current_setting('app.current_school_id')::UUID OR current_setting('app.current_user_role') IN ('super_admin', 'edufam_admin'));

ALTER TABLE content_localizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY content_localizations_school_access ON content_localizations 
    FOR ALL USING (school_id IS NULL OR school_id = current_setting('app.current_school_id')::UUID OR current_setting('app.current_user_role') IN ('super_admin', 'edufam_admin'));

ALTER TABLE translation_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY translation_tasks_assigned_access ON translation_tasks 
    FOR ALL USING (assigned_to = current_setting('app.current_user_id')::UUID OR created_by = current_setting('app.current_user_id')::UUID OR current_setting('app.current_user_role') IN ('super_admin', 'edufam_admin'));

ALTER TABLE localization_analytics ENABLE ROW LEVEL SECURITY;
CREATE POLICY localization_analytics_school_access ON localization_analytics 
    FOR ALL USING (school_id IS NULL OR school_id = current_setting('app.current_school_id')::UUID OR current_setting('app.current_user_role') IN ('super_admin', 'edufam_admin'));

-- Initial data for languages and localization
INSERT INTO languages (language_code, language_name, english_name, is_default, is_active, direction, flag_icon, locale) VALUES
('en', 'English', 'English', true, true, 'ltr', '🇺🇸', 'en-US'),
('sw', 'Kiswahili', 'Swahili', false, true, 'ltr', '🇰🇪', 'sw-KE'),
('fr', 'Français', 'French', false, true, 'ltr', '🇫🇷', 'fr-FR'),
('ar', 'العربية', 'Arabic', false, true, 'rtl', '🇸🇦', 'ar-SA'),
('es', 'Español', 'Spanish', false, true, 'ltr', '🇪🇸', 'es-ES')
ON CONFLICT (language_code) DO NOTHING;

-- Create translation namespaces
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
ON CONFLICT (namespace_name) DO NOTHING;

-- Insert some basic translation keys
DO $$
DECLARE
    common_ns_id UUID;
    auth_ns_id UUID;
    forms_ns_id UUID;
BEGIN
    -- Get namespace IDs
    SELECT id INTO common_ns_id FROM translation_namespaces WHERE namespace_name = 'common';
    SELECT id INTO auth_ns_id FROM translation_namespaces WHERE namespace_name = 'auth';
    SELECT id INTO forms_ns_id FROM translation_namespaces WHERE namespace_name = 'forms';
    
    -- Common translations
    INSERT INTO translation_keys (namespace_id, key_name, default_value, key_description) VALUES
    (common_ns_id, 'welcome', 'Welcome', 'Welcome message'),
    (common_ns_id, 'save', 'Save', 'Save button text'),
    (common_ns_id, 'cancel', 'Cancel', 'Cancel button text'),
    (common_ns_id, 'delete', 'Delete', 'Delete button text'),
    (common_ns_id, 'edit', 'Edit', 'Edit button text'),
    (common_ns_id, 'view', 'View', 'View button text'),
    (common_ns_id, 'loading', 'Loading...', 'Loading indicator text'),
    (common_ns_id, 'success', 'Success', 'Success message'),
    (common_ns_id, 'error', 'Error', 'Error message'),
    (common_ns_id, 'warning', 'Warning', 'Warning message'),
    
    -- Auth translations
    (auth_ns_id, 'login', 'Login', 'Login button text'),
    (auth_ns_id, 'logout', 'Logout', 'Logout button text'),
    (auth_ns_id, 'email', 'Email', 'Email field label'),
    (auth_ns_id, 'password', 'Password', 'Password field label'),
    (auth_ns_id, 'forgot_password', 'Forgot Password?', 'Forgot password link text'),
    (auth_ns_id, 'remember_me', 'Remember Me', 'Remember me checkbox label'),
    
    -- Form translations
    (forms_ns_id, 'required_field', 'This field is required', 'Required field validation message'),
    (forms_ns_id, 'invalid_email', 'Please enter a valid email address', 'Invalid email validation message'),
    (forms_ns_id, 'password_too_short', 'Password must be at least 8 characters', 'Password length validation'),
    (forms_ns_id, 'confirm_password', 'Confirm Password', 'Confirm password field label')
    ON CONFLICT (namespace_id, key_name) DO NOTHING;
END $$;

-- Insert basic translations for Swahili
DO $$
DECLARE
    en_id UUID;
    sw_id UUID;
    common_ns_id UUID;
    auth_ns_id UUID;
    forms_ns_id UUID;
BEGIN
    -- Get language IDs
    SELECT id INTO en_id FROM languages WHERE language_code = 'en';
    SELECT id INTO sw_id FROM languages WHERE language_code = 'sw';
    
    -- Get namespace IDs
    SELECT id INTO common_ns_id FROM translation_namespaces WHERE namespace_name = 'common';
    SELECT id INTO auth_ns_id FROM translation_namespaces WHERE namespace_name = 'auth';
    SELECT id INTO forms_ns_id FROM translation_namespaces WHERE namespace_name = 'forms';
    
    -- English translations (same as default values)
    INSERT INTO translations (translation_key_id, language_id, translated_value, status) 
    SELECT tk.id, en_id, tk.default_value, 'approved'
    FROM translation_keys tk
    ON CONFLICT (translation_key_id, language_id) DO NOTHING;
    
    -- Swahili translations
    INSERT INTO translations (translation_key_id, language_id, translated_value, status) VALUES
    ((SELECT id FROM translation_keys WHERE key_name = 'welcome' AND namespace_id = common_ns_id), sw_id, 'Karibu', 'approved'),
    ((SELECT id FROM translation_keys WHERE key_name = 'save' AND namespace_id = common_ns_id), sw_id, 'Hifadhi', 'approved'),
    ((SELECT id FROM translation_keys WHERE key_name = 'cancel' AND namespace_id = common_ns_id), sw_id, 'Ghairi', 'approved'),
    ((SELECT id FROM translation_keys WHERE key_name = 'delete' AND namespace_id = common_ns_id), sw_id, 'Futa', 'approved'),
    ((SELECT id FROM translation_keys WHERE key_name = 'edit' AND namespace_id = common_ns_id), sw_id, 'Hariri', 'approved'),
    ((SELECT id FROM translation_keys WHERE key_name = 'view' AND namespace_id = common_ns_id), sw_id, 'Ona', 'approved'),
    ((SELECT id FROM translation_keys WHERE key_name = 'loading' AND namespace_id = common_ns_id), sw_id, 'Inapakia...', 'approved'),
    ((SELECT id FROM translation_keys WHERE key_name = 'success' AND namespace_id = common_ns_id), sw_id, 'Mafanikio', 'approved'),
    ((SELECT id FROM translation_keys WHERE key_name = 'error' AND namespace_id = common_ns_id), sw_id, 'Kosa', 'approved'),
    ((SELECT id FROM translation_keys WHERE key_name = 'warning' AND namespace_id = common_ns_id), sw_id, 'Onyo', 'approved'),
    
    ((SELECT id FROM translation_keys WHERE key_name = 'login' AND namespace_id = auth_ns_id), sw_id, 'Ingia', 'approved'),
    ((SELECT id FROM translation_keys WHERE key_name = 'logout' AND namespace_id = auth_ns_id), sw_id, 'Toka', 'approved'),
    ((SELECT id FROM translation_keys WHERE key_name = 'email' AND namespace_id = auth_ns_id), sw_id, 'Barua pepe', 'approved'),
    ((SELECT id FROM translation_keys WHERE key_name = 'password' AND namespace_id = auth_ns_id), sw_id, 'Nenosiri', 'approved'),
    ((SELECT id FROM translation_keys WHERE key_name = 'forgot_password' AND namespace_id = auth_ns_id), sw_id, 'Umesahau nenosiri?', 'approved'),
    ((SELECT id FROM translation_keys WHERE key_name = 'remember_me' AND namespace_id = auth_ns_id), sw_id, 'Nikumbuke', 'approved'),
    
    ((SELECT id FROM translation_keys WHERE key_name = 'required_field' AND namespace_id = forms_ns_id), sw_id, 'Sehemu hii inahitajika', 'approved'),
    ((SELECT id FROM translation_keys WHERE key_name = 'invalid_email' AND namespace_id = forms_ns_id), sw_id, 'Tafadhali ingiza anwani sahihi ya barua pepe', 'approved'),
    ((SELECT id FROM translation_keys WHERE key_name = 'password_too_short' AND namespace_id = forms_ns_id), sw_id, 'Nenosiri lazima liwe na angalau herufi 8', 'approved'),
    ((SELECT id FROM translation_keys WHERE key_name = 'confirm_password' AND namespace_id = forms_ns_id), sw_id, 'Thibitisha Nenosiri', 'approved')
    ON CONFLICT (translation_key_id, language_id) DO NOTHING;
END $$;