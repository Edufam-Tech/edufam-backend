const internationalizationService = require('../services/internationalizationService');
const { asyncHandler } = require('../middleware/errorHandler');
const { ValidationError } = require('../middleware/errorHandler');

/**
 * Internationalization Controller
 * Handles multi-language support, translations, and localization
 */
class InternationalizationController {

  /**
   * Language Management
   */

  // Get available languages
  getLanguages = asyncHandler(async (req, res) => {
    const { includeInactive } = req.query;

    const languages = await internationalizationService.getLanguages({
      includeInactive: includeInactive === 'true'
    });

    res.json({
      success: true,
      data: { languages },
      message: 'Languages retrieved successfully'
    });
  });

  // Get specific language
  getLanguage = asyncHandler(async (req, res) => {
    const { languageCode } = req.params;

    const language = await internationalizationService.getLanguage(languageCode);

    res.json({
      success: true,
      data: { language },
      message: 'Language retrieved successfully'
    });
  });

  // Create new language
  createLanguage = asyncHandler(async (req, res) => {
    const {
      languageCode,
      languageName,
      englishName,
      direction,
      dateFormat,
      timeFormat,
      numberFormat,
      currencyFormat,
      flagIcon,
      locale,
      pluralizationRules
    } = req.body;

    // Validate required fields
    if (!languageCode || !languageName || !englishName) {
      throw new ValidationError('Language code, language name, and English name are required');
    }

    const language = await internationalizationService.createLanguage({
      languageCode,
      languageName,
      englishName,
      direction,
      dateFormat,
      timeFormat,
      numberFormat,
      currencyFormat,
      flagIcon,
      locale,
      pluralizationRules
    });

    res.status(201).json({
      success: true,
      data: { language },
      message: 'Language created successfully'
    });
  });

  /**
   * Translation Management
   */

  // Get translations
  getTranslations = asyncHandler(async (req, res) => {
    const {
      languageCode,
      namespace,
      keyFilter,
      status,
      includeContext
    } = req.query;

    const translations = await internationalizationService.getTranslations({
      languageCode: languageCode || req.user.preferredLanguage || 'en',
      namespace,
      keyFilter,
      status,
      includeContext: includeContext === 'true'
    });

    // Record analytics
    if (languageCode) {
      try {
        await internationalizationService.recordLocalizationAnalytic({
          metricType: 'translation_requests',
          languageCode,
          schoolId: req.user.schoolId,
          userId: req.user.userId,
          platform: req.get('User-Agent')?.includes('Mobile') ? 'mobile' : 'web'
        });
      } catch (error) {
        console.error('Failed to record localization analytics:', error);
      }
    }

    res.json({
      success: true,
      data: { translations },
      message: 'Translations retrieved successfully'
    });
  });

  // Create or update translation
  createTranslation = asyncHandler(async (req, res) => {
    const {
      namespaceId,
      keyName,
      languageCode,
      translatedValue,
      pluralForms,
      translationNotes,
      confidenceLevel
    } = req.body;

    // Validate required fields
    if (!namespaceId || !keyName || !languageCode || !translatedValue) {
      throw new ValidationError('Namespace ID, key name, language code, and translated value are required');
    }

    // Get language ID
    const language = await internationalizationService.getLanguage(languageCode);

    const translation = await internationalizationService.createTranslation({
      namespaceId,
      keyName,
      languageId: language.id,
      translatedValue,
      pluralForms,
      translatorId: req.user.userId,
      translationNotes,
      confidenceLevel
    });

    // Add to translation memory
    try {
      await internationalizationService.addToTranslationMemory({
        sourceLanguageCode: 'en', // Assuming English as source
        targetLanguageCode: languageCode,
        sourceText: keyName, // Using key as source for simplicity
        targetText: translatedValue,
        contextType: 'ui_translation',
        createdBy: req.user.userId
      });
    } catch (error) {
      console.error('Failed to add to translation memory:', error);
    }

    res.status(201).json({
      success: true,
      data: { translation },
      message: 'Translation created successfully'
    });
  });

  // Update translation
  updateTranslation = asyncHandler(async (req, res) => {
    const { translationId } = req.params;
    const {
      translatedValue,
      pluralForms,
      status,
      reviewNotes
    } = req.body;

    if (!translatedValue) {
      throw new ValidationError('Translated value is required');
    }

    const translation = await internationalizationService.updateTranslation(translationId, {
      translatedValue,
      pluralForms,
      status,
      reviewerId: req.user.userId,
      reviewNotes
    });

    res.json({
      success: true,
      data: { translation },
      message: 'Translation updated successfully'
    });
  });

  // Import translations
  importTranslations = asyncHandler(async (req, res) => {
    const {
      languageCode,
      translations,
      overwriteExisting,
      markAsApproved
    } = req.body;

    // Validate required fields
    if (!languageCode || !translations || typeof translations !== 'object') {
      throw new ValidationError('Language code and translations object are required');
    }

    const results = await internationalizationService.importTranslations(
      languageCode,
      translations,
      { overwriteExisting, markAsApproved }
    );

    const summary = {
      total: results.length,
      success: results.filter(r => r.status === 'success').length,
      skipped: results.filter(r => r.status === 'skipped').length,
      errors: results.filter(r => r.status === 'error').length
    };

    res.json({
      success: true,
      data: { results, summary },
      message: `Translation import completed. ${summary.success} successful, ${summary.errors} errors`
    });
  });

  // Export translations
  exportTranslations = asyncHandler(async (req, res) => {
    const { languageCode, namespace } = req.query;

    if (!languageCode) {
      throw new ValidationError('Language code is required');
    }

    const translations = await internationalizationService.exportTranslations(
      languageCode,
      namespace
    );

    res.json({
      success: true,
      data: { translations },
      message: 'Translations exported successfully'
    });
  });

  /**
   * User Language Preferences
   */

  // Get user language preference
  getUserLanguagePreference = asyncHandler(async (req, res) => {
    const preference = await internationalizationService.getUserLanguagePreference(req.user.userId);

    res.json({
      success: true,
      data: { preference },
      message: 'User language preference retrieved successfully'
    });
  });

  // Set user language preference
  setUserLanguagePreference = asyncHandler(async (req, res) => {
    const {
      primaryLanguageCode,
      fallbackLanguageCode,
      timezone,
      dateFormat,
      timeFormat,
      numberFormat,
      currencyFormat,
      autoDetectLanguage,
      browserLanguagePriority
    } = req.body;

    if (!primaryLanguageCode) {
      throw new ValidationError('Primary language code is required');
    }

    const preference = await internationalizationService.setUserLanguagePreference(req.user.userId, {
      primaryLanguageCode,
      fallbackLanguageCode,
      timezone,
      dateFormat,
      timeFormat,
      numberFormat,
      currencyFormat,
      autoDetectLanguage,
      browserLanguagePriority
    });

    // Record analytics
    try {
      await internationalizationService.recordLocalizationAnalytic({
        metricType: 'language_preference_change',
        languageCode: primaryLanguageCode,
        schoolId: req.user.schoolId,
        userId: req.user.userId,
        metricMetadata: { previousLanguage: req.user.preferredLanguage }
      });
    } catch (error) {
      console.error('Failed to record preference change analytics:', error);
    }

    res.json({
      success: true,
      data: { preference },
      message: 'User language preference updated successfully'
    });
  });

  /**
   * School Language Settings
   */

  // Get school language settings
  getSchoolLanguageSettings = asyncHandler(async (req, res) => {
    const schoolId = req.params.schoolId || req.user.schoolId;

    const settings = await internationalizationService.getSchoolLanguageSettings(schoolId);

    res.json({
      success: true,
      data: { settings },
      message: 'School language settings retrieved successfully'
    });
  });

  // Set school language settings
  setSchoolLanguageSettings = asyncHandler(async (req, res) => {
    const schoolId = req.params.schoolId || req.user.schoolId;
    const {
      defaultLanguageCode,
      supportedLanguageCodes,
      customTranslations,
      brandingTranslations,
      instructionLanguageCode,
      curriculumLanguageMapping,
      gradeLevelLanguageRequirements,
      parentCommunicationLanguageCode,
      defaultReportLanguageCode
    } = req.body;

    // Validate required fields
    if (!defaultLanguageCode || !supportedLanguageCodes || !Array.isArray(supportedLanguageCodes)) {
      throw new ValidationError('Default language code and supported language codes array are required');
    }

    const settings = await internationalizationService.setSchoolLanguageSettings(schoolId, {
      defaultLanguageCode,
      supportedLanguageCodes,
      customTranslations,
      brandingTranslations,
      instructionLanguageCode,
      curriculumLanguageMapping,
      gradeLevelLanguageRequirements,
      parentCommunicationLanguageCode,
      defaultReportLanguageCode
    });

    res.json({
      success: true,
      data: { settings },
      message: 'School language settings updated successfully'
    });
  });

  /**
   * Content Localization
   */

  // Localize content
  localizeContent = asyncHandler(async (req, res) => {
    const {
      contentType,
      contentId,
      languageCode,
      title,
      content,
      summary,
      metaDescription,
      keywords,
      customFields,
      localizationStatus
    } = req.body;

    // Validate required fields
    if (!contentType || !contentId || !languageCode) {
      throw new ValidationError('Content type, content ID, and language code are required');
    }

    const localization = await internationalizationService.localizeContent({
      contentType,
      contentId,
      languageCode,
      schoolId: req.user.schoolId,
      title,
      content,
      summary,
      metaDescription,
      keywords,
      customFields,
      localizedBy: req.user.userId,
      localizationStatus
    });

    res.status(201).json({
      success: true,
      data: { localization },
      message: 'Content localized successfully'
    });
  });

  // Get content localizations
  getContentLocalizations = asyncHandler(async (req, res) => {
    const {
      contentType,
      contentId,
      languageCode,
      status
    } = req.query;

    const localizations = await internationalizationService.getContentLocalizations({
      contentType,
      contentId,
      languageCode,
      schoolId: req.user.schoolId,
      status
    });

    res.json({
      success: true,
      data: { localizations },
      message: 'Content localizations retrieved successfully'
    });
  });

  /**
   * Translation Memory and Auto-Translation
   */

  // Search translation memory
  searchTranslationMemory = asyncHandler(async (req, res) => {
    const {
      sourceText,
      sourceLanguageCode,
      targetLanguageCode
    } = req.query;

    // Validate required fields
    if (!sourceText || !sourceLanguageCode || !targetLanguageCode) {
      throw new ValidationError('Source text, source language code, and target language code are required');
    }

    const suggestions = await internationalizationService.searchTranslationMemory(
      sourceText,
      sourceLanguageCode,
      targetLanguageCode
    );

    res.json({
      success: true,
      data: { suggestions },
      message: 'Translation memory search completed'
    });
  });

  // Add to translation memory
  addToTranslationMemory = asyncHandler(async (req, res) => {
    const {
      sourceLanguageCode,
      targetLanguageCode,
      sourceText,
      targetText,
      contextType
    } = req.body;

    // Validate required fields
    if (!sourceLanguageCode || !targetLanguageCode || !sourceText || !targetText) {
      throw new ValidationError('Source language, target language, source text, and target text are required');
    }

    const memoryEntry = await internationalizationService.addToTranslationMemory({
      sourceLanguageCode,
      targetLanguageCode,
      sourceText,
      targetText,
      contextType,
      createdBy: req.user.userId
    });

    res.status(201).json({
      success: true,
      data: { memoryEntry },
      message: 'Translation added to memory successfully'
    });
  });

  /**
   * Language Detection and Utilities
   */

  // Detect language
  detectLanguage = asyncHandler(async (req, res) => {
    const { text } = req.body;

    if (!text) {
      throw new ValidationError('Text is required for language detection');
    }

    const detection = await internationalizationService.detectLanguage(text);

    res.json({
      success: true,
      data: { detection },
      message: 'Language detection completed'
    });
  });

  // Format message with variables
  formatMessage = asyncHandler(async (req, res) => {
    const {
      messageKey,
      variables,
      languageCode
    } = req.body;

    if (!messageKey) {
      throw new ValidationError('Message key is required');
    }

    const formattedMessage = await internationalizationService.formatMessage(
      messageKey,
      variables || {},
      languageCode || req.user.preferredLanguage || 'en'
    );

    res.json({
      success: true,
      data: { formattedMessage },
      message: 'Message formatted successfully'
    });
  });

  /**
   * Analytics and Reporting
   */

  // Get localization analytics
  getLocalizationAnalytics = asyncHandler(async (req, res) => {
    const {
      metricType,
      languageCode,
      startDate,
      endDate
    } = req.query;

    const analytics = await internationalizationService.getLocalizationAnalytics({
      metricType,
      languageCode,
      schoolId: req.user.schoolId,
      startDate,
      endDate
    });

    res.json({
      success: true,
      data: { analytics },
      message: 'Localization analytics retrieved successfully'
    });
  });

  /**
   * Admin Functions
   */

  // Get translation dashboard
  getTranslationDashboard = asyncHandler(async (req, res) => {
    const { languageCode } = req.query;

    // Get various translation metrics
    const [
      languages,
      translationStats,
      recentActivity
    ] = await Promise.all([
      internationalizationService.getLanguages(),
      internationalizationService.getTranslations({
        languageCode,
        includeContext: true
      }),
      internationalizationService.getLocalizationAnalytics({
        metricType: 'translation_requests',
        schoolId: req.user.schoolId
      })
    ]);

    // Calculate statistics
    const stats = Array.isArray(translationStats) ? {
      total: translationStats.length,
      approved: translationStats.filter(t => t.status === 'approved').length,
      pending: translationStats.filter(t => t.status === 'pending').length,
      translated: translationStats.filter(t => t.status === 'translated').length,
      reviewed: translationStats.filter(t => t.status === 'reviewed').length
    } : { total: Object.keys(translationStats).length };

    const dashboard = {
      languages,
      translationStats: stats,
      recentActivity: recentActivity.slice(0, 10),
      summary: {
        totalLanguages: languages.length,
        activeLanguages: languages.filter(l => l.is_active).length,
        completionRate: stats.total > 0 ? ((stats.approved / stats.total) * 100).toFixed(2) : 0,
        pendingTranslations: stats.pending || 0
      }
    };

    res.json({
      success: true,
      data: { dashboard },
      message: 'Translation dashboard retrieved successfully'
    });
  });

  /**
   * Health Check
   */

  // Get internationalization service health
  getInternationalizationHealth = asyncHandler(async (req, res) => {
    const languages = await internationalizationService.getLanguages();
    const analytics = await internationalizationService.getLocalizationAnalytics({
      schoolId: req.user.schoolId
    });

    res.json({
      success: true,
      data: {
        service: 'Internationalization Service',
        status: 'healthy',
        features: [
          'multi_language_support',
          'translation_management',
          'content_localization',
          'user_preferences',
          'school_settings',
          'translation_memory',
          'language_detection',
          'localization_analytics',
          'cultural_settings',
          'auto_translation_cache'
        ],
        metrics: {
          totalLanguages: languages.length,
          activeLanguages: languages.filter(l => l.is_active).length,
          defaultLanguage: languages.find(l => l.is_default)?.language_code || 'en',
          totalAnalyticsRecords: analytics.length,
          supportedDirections: ['ltr', 'rtl'],
          translationStatuses: ['pending', 'translated', 'reviewed', 'approved']
        },
        supportedLanguages: languages.map(l => ({
          code: l.language_code,
          name: l.language_name,
          englishName: l.english_name,
          direction: l.direction,
          active: l.is_active,
          default: l.is_default,
          completionPercentage: l.completion_percentage
        })),
        timestamp: new Date().toISOString()
      },
      message: 'Internationalization service health check completed'
    });
  });
}

module.exports = new InternationalizationController();