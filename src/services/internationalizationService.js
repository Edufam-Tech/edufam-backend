const { query } = require('../config/database');
const { ValidationError, NotFoundError } = require('../middleware/errorHandler');

/**
 * Internationalization Service
 * Handles multi-language support, translations, and localization
 */
class InternationalizationService {

  /**
   * Language Management
   */
  async getLanguages({ includeInactive = false } = {}) {
    let whereClause = '';
    const params = [];

    if (!includeInactive) {
      whereClause = 'WHERE is_active = true';
    }

    const result = await query(`
      SELECT 
        l.*,
        (SELECT COUNT(*) FROM user_language_preferences ulp WHERE ulp.primary_language_id = l.id) as user_count,
        (SELECT COUNT(*) FROM school_language_settings sls WHERE l.id = ANY(sls.supported_languages)) as school_count
      FROM languages l
      ${whereClause}
      ORDER BY is_default DESC, language_name ASC
    `, params);

    return result.rows;
  }

  async getLanguage(languageCode) {
    const result = await query(`
      SELECT * FROM languages WHERE language_code = $1
    `, [languageCode]);

    if (result.rows.length === 0) {
      throw new NotFoundError('Language not found');
    }

    return result.rows[0];
  }

  async createLanguage({
    languageCode,
    languageName,
    englishName,
    direction = 'ltr',
    dateFormat,
    timeFormat,
    numberFormat,
    currencyFormat,
    flagIcon,
    locale,
    pluralizationRules
  }) {
    const result = await query(`
      INSERT INTO languages (
        language_code, language_name, english_name, direction,
        date_format, time_format, number_format, currency_format,
        flag_icon, locale, pluralization_rules
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [
      languageCode, languageName, englishName, direction,
      dateFormat, timeFormat, 
      numberFormat ? JSON.stringify(numberFormat) : null,
      currencyFormat ? JSON.stringify(currencyFormat) : null,
      flagIcon, locale,
      pluralizationRules ? JSON.stringify(pluralizationRules) : null
    ]);

    return result.rows[0];
  }

  /**
   * Translation Management
   */
  async getTranslations({
    languageCode,
    namespace,
    keyFilter,
    status,
    includeContext = false
  } = {}) {
    let whereConditions = [];
    let params = [];
    let paramCount = 0;

    if (languageCode) {
      whereConditions.push(`l.language_code = $${++paramCount}`);
      params.push(languageCode);
    }

    if (namespace) {
      whereConditions.push(`tn.namespace_name = $${++paramCount}`);
      params.push(namespace);
    }

    if (keyFilter) {
      whereConditions.push(`tk.key_name ILIKE $${++paramCount}`);
      params.push(`%${keyFilter}%`);
    }

    if (status) {
      whereConditions.push(`t.status = $${++paramCount}`);
      params.push(status);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const selectFields = includeContext 
      ? `t.*, tk.key_name, tk.key_description, tk.default_value, tk.context_info, tk.max_length, tk.is_html, tk.is_plural, tn.namespace_name, l.language_code, l.language_name`
      : `t.translated_value, tk.key_name, tn.namespace_name`;

    const result = await query(`
      SELECT ${selectFields}
      FROM translations t
      JOIN translation_keys tk ON t.translation_key_id = tk.id
      JOIN translation_namespaces tn ON tk.namespace_id = tn.id
      JOIN languages l ON t.language_id = l.id
      ${whereClause}
      ORDER BY tn.namespace_name, tk.key_name
    `, params);

    if (!includeContext) {
      // Return flat key-value structure for client use
      const translations = {};
      result.rows.forEach(row => {
        const fullKey = `${row.namespace_name}.${row.key_name}`;
        translations[fullKey] = row.translated_value;
      });
      return translations;
    }

    return result.rows;
  }

  async createTranslation({
    namespaceId,
    keyName,
    languageId,
    translatedValue,
    pluralForms,
    translatorId,
    translationNotes,
    confidenceLevel = 'medium'
  }) {
    // Get or create translation key
    let translationKey = await query(`
      SELECT id FROM translation_keys 
      WHERE namespace_id = $1 AND key_name = $2
    `, [namespaceId, keyName]);

    let translationKeyId;
    if (translationKey.rows.length === 0) {
      const newKey = await query(`
        INSERT INTO translation_keys (namespace_id, key_name, default_value)
        VALUES ($1, $2, $3)
        RETURNING id
      `, [namespaceId, keyName, translatedValue]);
      translationKeyId = newKey.rows[0].id;
    } else {
      translationKeyId = translationKey.rows[0].id;
    }

    const result = await query(`
      INSERT INTO translations (
        translation_key_id, language_id, translated_value, plural_forms,
        translator_id, translation_notes, confidence_level, status,
        translated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      ON CONFLICT (translation_key_id, language_id)
      DO UPDATE SET
        translated_value = EXCLUDED.translated_value,
        plural_forms = EXCLUDED.plural_forms,
        translator_id = EXCLUDED.translator_id,
        translation_notes = EXCLUDED.translation_notes,
        confidence_level = EXCLUDED.confidence_level,
        status = EXCLUDED.status,
        translated_at = NOW(),
        updated_at = NOW()
      RETURNING *
    `, [
      translationKeyId, languageId, translatedValue,
      pluralForms ? JSON.stringify(pluralForms) : null,
      translatorId, translationNotes, confidenceLevel, 'translated'
    ]);

    return result.rows[0];
  }

  async updateTranslation(translationId, {
    translatedValue,
    pluralForms,
    status,
    reviewerId,
    reviewNotes
  }) {
    let setClause = 'translated_value = $2';
    const params = [translationId, translatedValue];
    let paramCount = 2;

    if (pluralForms) {
      setClause += `, plural_forms = $${++paramCount}`;
      params.push(JSON.stringify(pluralForms));
    }

    if (status) {
      setClause += `, status = $${++paramCount}`;
      params.push(status);

      if (status === 'reviewed' && reviewerId) {
        setClause += `, reviewer_id = $${++paramCount}, reviewed_at = NOW()`;
        params.push(reviewerId);
      } else if (status === 'approved') {
        setClause += `, approved_at = NOW()`;
      }
    }

    if (reviewNotes) {
      setClause += `, review_notes = $${++paramCount}`;
      params.push(reviewNotes);
    }

    setClause += ', updated_at = NOW()';

    const result = await query(`
      UPDATE translations 
      SET ${setClause}
      WHERE id = $1
      RETURNING *
    `, params);

    if (result.rows.length === 0) {
      throw new NotFoundError('Translation not found');
    }

    return result.rows[0];
  }

  /**
   * Bulk Translation Operations
   */
  async importTranslations(languageCode, translations, options = {}) {
    const { overwriteExisting = false, markAsApproved = false } = options;

    const language = await this.getLanguage(languageCode);
    const results = [];

    for (const [fullKey, value] of Object.entries(translations)) {
      try {
        const [namespaceName, ...keyParts] = fullKey.split('.');
        const keyName = keyParts.join('.');

        // Get namespace
        const namespaceResult = await query(`
          SELECT id FROM translation_namespaces WHERE namespace_name = $1
        `, [namespaceName]);

        if (namespaceResult.rows.length === 0) {
          results.push({ key: fullKey, status: 'error', message: 'Namespace not found' });
          continue;
        }

        const namespaceId = namespaceResult.rows[0].id;

        // Check if translation exists
        const existingResult = await query(`
          SELECT t.id 
          FROM translations t
          JOIN translation_keys tk ON t.translation_key_id = tk.id
          WHERE tk.namespace_id = $1 AND tk.key_name = $2 AND t.language_id = $3
        `, [namespaceId, keyName, language.id]);

        if (existingResult.rows.length > 0 && !overwriteExisting) {
          results.push({ key: fullKey, status: 'skipped', message: 'Translation already exists' });
          continue;
        }

        // Create or update translation
        const translation = await this.createTranslation({
          namespaceId,
          keyName,
          languageId: language.id,
          translatedValue: value,
          confidenceLevel: 'high'
        });

        if (markAsApproved) {
          await this.updateTranslation(translation.id, { status: 'approved' });
        }

        results.push({ key: fullKey, status: 'success', translationId: translation.id });
      } catch (error) {
        results.push({ key: fullKey, status: 'error', message: error.message });
      }
    }

    return results;
  }

  async exportTranslations(languageCode, namespace = null) {
    const translations = await this.getTranslations({
      languageCode,
      namespace,
      status: 'approved'
    });

    return translations;
  }

  /**
   * User Language Preferences
   */
  async getUserLanguagePreference(userId) {
    const result = await query(`
      SELECT 
        ulp.*,
        pl.language_code as primary_language_code,
        pl.language_name as primary_language_name,
        fl.language_code as fallback_language_code,
        fl.language_name as fallback_language_name
      FROM user_language_preferences ulp
      JOIN languages pl ON ulp.primary_language_id = pl.id
      LEFT JOIN languages fl ON ulp.fallback_language_id = fl.id
      WHERE ulp.user_id = $1
    `, [userId]);

    if (result.rows.length === 0) {
      // Return default language preference
      const defaultLang = await query(`
        SELECT * FROM languages WHERE is_default = true LIMIT 1
      `);
      
      return {
        user_id: userId,
        primary_language_code: defaultLang.rows[0]?.language_code || 'en',
        primary_language_name: defaultLang.rows[0]?.language_name || 'English',
        fallback_language_code: 'en',
        auto_detect_language: true,
        browser_language_priority: true
      };
    }

    return result.rows[0];
  }

  async setUserLanguagePreference(userId, {
    primaryLanguageCode,
    fallbackLanguageCode,
    timezone,
    dateFormat,
    timeFormat,
    numberFormat,
    currencyFormat,
    autoDetectLanguage = true,
    browserLanguagePriority = true
  }) {
    // Get language IDs
    const primaryLang = await this.getLanguage(primaryLanguageCode);
    let fallbackLangId = null;

    if (fallbackLanguageCode) {
      const fallbackLang = await this.getLanguage(fallbackLanguageCode);
      fallbackLangId = fallbackLang.id;
    }

    const result = await query(`
      INSERT INTO user_language_preferences (
        user_id, primary_language_id, fallback_language_id, timezone,
        date_format, time_format, number_format, currency_format,
        auto_detect_language, browser_language_priority
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (user_id)
      DO UPDATE SET
        primary_language_id = EXCLUDED.primary_language_id,
        fallback_language_id = EXCLUDED.fallback_language_id,
        timezone = EXCLUDED.timezone,
        date_format = EXCLUDED.date_format,
        time_format = EXCLUDED.time_format,
        number_format = EXCLUDED.number_format,
        currency_format = EXCLUDED.currency_format,
        auto_detect_language = EXCLUDED.auto_detect_language,
        browser_language_priority = EXCLUDED.browser_language_priority,
        updated_at = NOW()
      RETURNING *
    `, [
      userId, primaryLang.id, fallbackLangId, timezone,
      dateFormat, timeFormat,
      numberFormat ? JSON.stringify(numberFormat) : null,
      currencyFormat ? JSON.stringify(currencyFormat) : null,
      autoDetectLanguage, browserLanguagePriority
    ]);

    return result.rows[0];
  }

  /**
   * School Language Settings
   */
  async getSchoolLanguageSettings(schoolId) {
    const result = await query(`
      SELECT 
        sls.*,
        dl.language_code as default_language_code,
        dl.language_name as default_language_name,
        il.language_code as instruction_language_code,
        il.language_name as instruction_language_name,
        pcl.language_code as parent_communication_language_code,
        pcl.language_name as parent_communication_language_name,
        drl.language_code as default_report_language_code,
        drl.language_name as default_report_language_name,
        (
          SELECT ARRAY_AGG(
            JSON_BUILD_OBJECT(
              'id', l.id,
              'code', l.language_code,
              'name', l.language_name,
              'flag', l.flag_icon
            )
          )
          FROM languages l
          WHERE l.id = ANY(sls.supported_languages)
        ) as supported_language_details
      FROM school_language_settings sls
      JOIN languages dl ON sls.default_language_id = dl.id
      LEFT JOIN languages il ON sls.instruction_language_id = il.id
      LEFT JOIN languages pcl ON sls.parent_communication_language_id = pcl.id
      LEFT JOIN languages drl ON sls.default_report_language_id = drl.id
      WHERE sls.school_id = $1
    `, [schoolId]);

    if (result.rows.length === 0) {
      // Return default settings
      const defaultLang = await query(`
        SELECT * FROM languages WHERE is_default = true LIMIT 1
      `);

      return {
        school_id: schoolId,
        default_language_code: defaultLang.rows[0]?.language_code || 'en',
        supported_language_details: [defaultLang.rows[0]] || []
      };
    }

    return result.rows[0];
  }

  async setSchoolLanguageSettings(schoolId, {
    defaultLanguageCode,
    supportedLanguageCodes,
    customTranslations,
    brandingTranslations,
    instructionLanguageCode,
    curriculumLanguageMapping,
    gradeLevelLanguageRequirements,
    parentCommunicationLanguageCode,
    defaultReportLanguageCode
  }) {
    // Get language IDs
    const defaultLang = await this.getLanguage(defaultLanguageCode);
    
    const supportedLanguageIds = [];
    for (const code of supportedLanguageCodes) {
      const lang = await this.getLanguage(code);
      supportedLanguageIds.push(lang.id);
    }

    let instructionLangId = null;
    if (instructionLanguageCode) {
      const instructionLang = await this.getLanguage(instructionLanguageCode);
      instructionLangId = instructionLang.id;
    }

    let parentCommLangId = null;
    if (parentCommunicationLanguageCode) {
      const parentCommLang = await this.getLanguage(parentCommunicationLanguageCode);
      parentCommLangId = parentCommLang.id;
    }

    let defaultReportLangId = null;
    if (defaultReportLanguageCode) {
      const defaultReportLang = await this.getLanguage(defaultReportLanguageCode);
      defaultReportLangId = defaultReportLang.id;
    }

    const result = await query(`
      INSERT INTO school_language_settings (
        school_id, default_language_id, supported_languages, custom_translations,
        branding_translations, instruction_language_id, curriculum_language_mapping,
        grade_level_language_requirements, parent_communication_language_id,
        default_report_language_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (school_id)
      DO UPDATE SET
        default_language_id = EXCLUDED.default_language_id,
        supported_languages = EXCLUDED.supported_languages,
        custom_translations = EXCLUDED.custom_translations,
        branding_translations = EXCLUDED.branding_translations,
        instruction_language_id = EXCLUDED.instruction_language_id,
        curriculum_language_mapping = EXCLUDED.curriculum_language_mapping,
        grade_level_language_requirements = EXCLUDED.grade_level_language_requirements,
        parent_communication_language_id = EXCLUDED.parent_communication_language_id,
        default_report_language_id = EXCLUDED.default_report_language_id,
        updated_at = NOW()
      RETURNING *
    `, [
      schoolId, defaultLang.id, supportedLanguageIds,
      customTranslations ? JSON.stringify(customTranslations) : null,
      brandingTranslations ? JSON.stringify(brandingTranslations) : null,
      instructionLangId,
      curriculumLanguageMapping ? JSON.stringify(curriculumLanguageMapping) : null,
      gradeLevelLanguageRequirements ? JSON.stringify(gradeLevelLanguageRequirements) : null,
      parentCommLangId, defaultReportLangId
    ]);

    return result.rows[0];
  }

  /**
   * Content Localization
   */
  async localizeContent({
    contentType,
    contentId,
    languageCode,
    schoolId,
    title,
    content,
    summary,
    metaDescription,
    keywords,
    customFields,
    localizedBy,
    localizationStatus = 'draft'
  }) {
    const language = await this.getLanguage(languageCode);

    const result = await query(`
      INSERT INTO content_localizations (
        content_type, content_id, language_id, school_id, title,
        content, summary, meta_description, keywords, custom_fields,
        localized_by, localization_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (content_type, content_id, language_id)
      DO UPDATE SET
        title = EXCLUDED.title,
        content = EXCLUDED.content,
        summary = EXCLUDED.summary,
        meta_description = EXCLUDED.meta_description,
        keywords = EXCLUDED.keywords,
        custom_fields = EXCLUDED.custom_fields,
        localized_by = EXCLUDED.localized_by,
        localization_status = EXCLUDED.localization_status,
        updated_at = NOW()
      RETURNING *
    `, [
      contentType, contentId, language.id, schoolId, title,
      content, summary, metaDescription, keywords,
      customFields ? JSON.stringify(customFields) : null,
      localizedBy, localizationStatus
    ]);

    return result.rows[0];
  }

  async getContentLocalizations({
    contentType,
    contentId,
    languageCode,
    schoolId,
    status = 'published'
  } = {}) {
    let whereConditions = [];
    let params = [];
    let paramCount = 0;

    if (contentType) {
      whereConditions.push(`cl.content_type = $${++paramCount}`);
      params.push(contentType);
    }

    if (contentId) {
      whereConditions.push(`cl.content_id = $${++paramCount}`);
      params.push(contentId);
    }

    if (languageCode) {
      whereConditions.push(`l.language_code = $${++paramCount}`);
      params.push(languageCode);
    }

    if (schoolId) {
      whereConditions.push(`cl.school_id = $${++paramCount}`);
      params.push(schoolId);
    }

    if (status) {
      whereConditions.push(`cl.localization_status = $${++paramCount}`);
      params.push(status);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const result = await query(`
      SELECT 
        cl.*,
        l.language_code,
        l.language_name,
        l.flag_icon
      FROM content_localizations cl
      JOIN languages l ON cl.language_id = l.id
      ${whereClause}
      ORDER BY cl.updated_at DESC
    `, params);

    return result.rows;
  }

  /**
   * Translation Memory and Auto-Translation
   */
  async addToTranslationMemory({
    sourceLanguageCode,
    targetLanguageCode,
    sourceText,
    targetText,
    contextType,
    createdBy,
    createdFrom = 'manual'
  }) {
    const sourceLang = await this.getLanguage(sourceLanguageCode);
    const targetLang = await this.getLanguage(targetLanguageCode);

    const result = await query(`
      INSERT INTO translation_memory (
        source_language_id, target_language_id, source_text, target_text,
        context_type, created_by, created_from
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (source_language_id, target_language_id, source_text)
      DO UPDATE SET
        target_text = EXCLUDED.target_text,
        usage_count = translation_memory.usage_count + 1,
        last_used = NOW(),
        updated_at = NOW()
      RETURNING *
    `, [
      sourceLang.id, targetLang.id, sourceText, targetText,
      contextType, createdBy, createdFrom
    ]);

    return result.rows[0];
  }

  async searchTranslationMemory(sourceText, sourceLanguageCode, targetLanguageCode) {
    const sourceLang = await this.getLanguage(sourceLanguageCode);
    const targetLang = await this.getLanguage(targetLanguageCode);

    const result = await query(`
      SELECT 
        tm.*,
        similarity(tm.source_text, $3) as similarity_score
      FROM translation_memory tm
      WHERE tm.source_language_id = $1 
        AND tm.target_language_id = $2
        AND (tm.source_text = $3 OR similarity(tm.source_text, $3) > 0.5)
      ORDER BY similarity_score DESC, usage_count DESC
      LIMIT 10
    `, [sourceLang.id, targetLang.id, sourceText]);

    return result.rows;
  }

  /**
   * Analytics and Reporting
   */
  async recordLocalizationAnalytic({
    metricType,
    languageCode,
    schoolId,
    userId,
    metricValue = 1,
    metricMetadata,
    contentType,
    platform = 'web'
  }) {
    let languageId = null;
    if (languageCode) {
      const language = await this.getLanguage(languageCode);
      languageId = language.id;
    }

    const result = await query(`
      INSERT INTO localization_analytics (
        metric_type, language_id, school_id, user_id, metric_date,
        metric_value, metric_metadata, content_type, platform
      ) VALUES ($1, $2, $3, $4, CURRENT_DATE, $5, $6, $7, $8)
      ON CONFLICT (metric_type, language_id, school_id, user_id, metric_date, content_type, platform)
      DO UPDATE SET
        metric_value = localization_analytics.metric_value + EXCLUDED.metric_value,
        metric_metadata = EXCLUDED.metric_metadata,
        created_at = NOW()
      RETURNING *
    `, [
      metricType, languageId, schoolId, userId, metricValue,
      metricMetadata ? JSON.stringify(metricMetadata) : null,
      contentType, platform
    ]);

    return result.rows[0];
  }

  async getLocalizationAnalytics({
    metricType,
    languageCode,
    schoolId,
    startDate,
    endDate
  } = {}) {
    let whereConditions = [];
    let params = [];
    let paramCount = 0;

    if (metricType) {
      whereConditions.push(`la.metric_type = $${++paramCount}`);
      params.push(metricType);
    }

    if (languageCode) {
      whereConditions.push(`l.language_code = $${++paramCount}`);
      params.push(languageCode);
    }

    if (schoolId) {
      whereConditions.push(`la.school_id = $${++paramCount}`);
      params.push(schoolId);
    }

    if (startDate) {
      whereConditions.push(`la.metric_date >= $${++paramCount}`);
      params.push(startDate);
    }

    if (endDate) {
      whereConditions.push(`la.metric_date <= $${++paramCount}`);
      params.push(endDate);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const result = await query(`
      SELECT 
        la.*,
        l.language_code,
        l.language_name,
        s.name as school_name
      FROM localization_analytics la
      LEFT JOIN languages l ON la.language_id = l.id
      LEFT JOIN schools s ON la.school_id = s.id
      ${whereClause}
      ORDER BY la.metric_date DESC, la.metric_value DESC
    `, params);

    return result.rows;
  }

  /**
   * Utility Functions
   */
  async detectLanguage(text) {
    // This would integrate with a language detection service
    // For now, return a simple heuristic
    const commonSwahiliWords = ['na', 'ya', 'wa', 'la', 'ni', 'kwa', 'za', 'kutoka', 'kwenda'];
    const commonFrenchWords = ['le', 'de', 'et', 'à', 'un', 'une', 'du', 'des', 'dans', 'pour'];
    const commonArabicPattern = /[\u0600-\u06FF]/;

    const words = text.toLowerCase().split(/\s+/);
    
    if (commonArabicPattern.test(text)) {
      return { languageCode: 'ar', confidence: 0.9 };
    }

    const swahiliMatches = words.filter(word => commonSwahiliWords.includes(word)).length;
    const frenchMatches = words.filter(word => commonFrenchWords.includes(word)).length;

    if (swahiliMatches > frenchMatches && swahiliMatches > 0) {
      return { languageCode: 'sw', confidence: Math.min(0.9, swahiliMatches / words.length + 0.3) };
    } else if (frenchMatches > 0) {
      return { languageCode: 'fr', confidence: Math.min(0.9, frenchMatches / words.length + 0.3) };
    }

    return { languageCode: 'en', confidence: 0.5 };
  }

  async formatMessage(messageKey, variables = {}, languageCode = 'en') {
    const translations = await this.getTranslations({ languageCode });
    let message = translations[messageKey] || messageKey;

    // Replace variables in the message
    for (const [key, value] of Object.entries(variables)) {
      message = message.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }

    return message;
  }
}

module.exports = new InternationalizationService();