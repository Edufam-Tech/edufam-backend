const express = require('express');
const router = express.Router();
const internationalizationController = require('../controllers/internationalizationController');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { body, param, query } = require('express-validator');

/**
 * Internationalization (i18n) Routes
 * Handles multi-language support, translations, and localization
 */

// ====================================
// AUTHENTICATED ENDPOINTS
// ====================================

// Authentication middleware for all routes
router.use(authenticate);

// ====================================
// LANGUAGE MANAGEMENT
// ====================================

/**
 * Get available languages
 * GET /api/v1/i18n/languages
 */
router.get('/languages', [
  query('includeInactive').optional().isBoolean().withMessage('Include inactive must be boolean')
], validate, internationalizationController.getLanguages);

/**
 * Get specific language
 * GET /api/v1/i18n/languages/:languageCode
 */
router.get('/languages/:languageCode', [
  param('languageCode').isString().trim().isLength({ min: 2, max: 10 }).withMessage('Valid language code is required')
], validate, internationalizationController.getLanguage);

/**
 * Create new language
 * POST /api/v1/i18n/languages
 */
router.post('/languages', [
  requireRole(['super_admin', 'edufam_admin']),
  body('languageCode').isString().trim().isLength({ min: 2, max: 10 }).withMessage('Language code is required (2-10 characters)'),
  body('languageName').isString().trim().isLength({ min: 1, max: 100 }).withMessage('Language name is required (1-100 characters)'),
  body('englishName').isString().trim().isLength({ min: 1, max: 100 }).withMessage('English name is required (1-100 characters)'),
  body('direction').optional().isIn(['ltr', 'rtl']).withMessage('Direction must be ltr or rtl'),
  body('dateFormat').optional().isString().trim().withMessage('Date format must be a string'),
  body('timeFormat').optional().isString().trim().withMessage('Time format must be a string'),
  body('numberFormat').optional().isObject().withMessage('Number format must be an object'),
  body('currencyFormat').optional().isObject().withMessage('Currency format must be an object'),
  body('flagIcon').optional().isString().trim().withMessage('Flag icon must be a string'),
  body('locale').optional().isString().trim().withMessage('Locale must be a string'),
  body('pluralizationRules').optional().isObject().withMessage('Pluralization rules must be an object')
], validate, internationalizationController.createLanguage);

// ====================================
// TRANSLATION MANAGEMENT
// ====================================

/**
 * Get translations
 * GET /api/v1/i18n/translations
 */
router.get('/translations', [
  query('languageCode').optional().isString().trim().withMessage('Language code must be a string'),
  query('namespace').optional().isString().trim().withMessage('Namespace must be a string'),
  query('keyFilter').optional().isString().trim().withMessage('Key filter must be a string'),
  query('status').optional().isIn(['pending', 'translated', 'reviewed', 'approved']).withMessage('Invalid status'),
  query('includeContext').optional().isBoolean().withMessage('Include context must be boolean')
], validate, internationalizationController.getTranslations);

/**
 * Create or update translation
 * POST /api/v1/i18n/translations
 */
router.post('/translations', [
  requireRole(['super_admin', 'edufam_admin', 'translator', 'school_admin']),
  body('namespaceId').isUUID().withMessage('Valid namespace ID is required'),
  body('keyName').isString().trim().isLength({ min: 1, max: 255 }).withMessage('Key name is required (1-255 characters)'),
  body('languageCode').isString().trim().isLength({ min: 2, max: 10 }).withMessage('Language code is required'),
  body('translatedValue').isString().trim().isLength({ min: 1 }).withMessage('Translated value is required'),
  body('pluralForms').optional().isObject().withMessage('Plural forms must be an object'),
  body('translationNotes').optional().isString().trim().withMessage('Translation notes must be a string'),
  body('confidenceLevel').optional().isIn(['low', 'medium', 'high']).withMessage('Invalid confidence level')
], validate, internationalizationController.createTranslation);

/**
 * Update translation
 * PUT /api/v1/i18n/translations/:translationId
 */
router.put('/translations/:translationId', [
  requireRole(['super_admin', 'edufam_admin', 'translator', 'reviewer']),
  param('translationId').isUUID().withMessage('Valid translation ID is required'),
  body('translatedValue').isString().trim().isLength({ min: 1 }).withMessage('Translated value is required'),
  body('pluralForms').optional().isObject().withMessage('Plural forms must be an object'),
  body('status').optional().isIn(['pending', 'translated', 'reviewed', 'approved']).withMessage('Invalid status'),
  body('reviewNotes').optional().isString().trim().withMessage('Review notes must be a string')
], validate, internationalizationController.updateTranslation);

/**
 * Import translations
 * POST /api/v1/i18n/translations/import
 */
router.post('/translations/import', [
  requireRole(['super_admin', 'edufam_admin']),
  body('languageCode').isString().trim().isLength({ min: 2, max: 10 }).withMessage('Language code is required'),
  body('translations').isObject().withMessage('Translations object is required'),
  body('overwriteExisting').optional().isBoolean().withMessage('Overwrite existing must be boolean'),
  body('markAsApproved').optional().isBoolean().withMessage('Mark as approved must be boolean')
], validate, internationalizationController.importTranslations);

/**
 * Export translations
 * GET /api/v1/i18n/translations/export
 */
router.get('/translations/export', [
  requireRole(['super_admin', 'edufam_admin', 'translator']),
  query('languageCode').isString().trim().isLength({ min: 2, max: 10 }).withMessage('Language code is required'),
  query('namespace').optional().isString().trim().withMessage('Namespace must be a string')
], validate, internationalizationController.exportTranslations);

// ====================================
// USER LANGUAGE PREFERENCES
// ====================================

/**
 * Get user language preference
 * GET /api/v1/i18n/preferences
 */
router.get('/preferences', internationalizationController.getUserLanguagePreference);

/**
 * Set user language preference
 * PUT /api/v1/i18n/preferences
 */
router.put('/preferences', [
  body('primaryLanguageCode').isString().trim().isLength({ min: 2, max: 10 }).withMessage('Primary language code is required'),
  body('fallbackLanguageCode').optional().isString().trim().isLength({ min: 2, max: 10 }).withMessage('Fallback language code must be 2-10 characters'),
  body('timezone').optional().isString().trim().withMessage('Timezone must be a string'),
  body('dateFormat').optional().isString().trim().withMessage('Date format must be a string'),
  body('timeFormat').optional().isString().trim().withMessage('Time format must be a string'),
  body('numberFormat').optional().isObject().withMessage('Number format must be an object'),
  body('currencyFormat').optional().isObject().withMessage('Currency format must be an object'),
  body('autoDetectLanguage').optional().isBoolean().withMessage('Auto detect language must be boolean'),
  body('browserLanguagePriority').optional().isBoolean().withMessage('Browser language priority must be boolean')
], validate, internationalizationController.setUserLanguagePreference);

// ====================================
// SCHOOL LANGUAGE SETTINGS
// ====================================

/**
 * Get school language settings
 * GET /api/v1/i18n/schools/settings
 * GET /api/v1/i18n/schools/:schoolId/settings
 */
router.get('/schools/settings', internationalizationController.getSchoolLanguageSettings);
router.get('/schools/:schoolId/settings', [
  requireRole(['super_admin', 'edufam_admin']),
  param('schoolId').isUUID().withMessage('Valid school ID is required')
], validate, internationalizationController.getSchoolLanguageSettings);

/**
 * Set school language settings
 * PUT /api/v1/i18n/schools/settings
 * PUT /api/v1/i18n/schools/:schoolId/settings
 */
router.put('/schools/settings', [
  requireRole(['super_admin', 'edufam_admin', 'school_admin', 'principal']),
  body('defaultLanguageCode').isString().trim().isLength({ min: 2, max: 10 }).withMessage('Default language code is required'),
  body('supportedLanguageCodes').isArray().withMessage('Supported language codes must be an array'),
  body('supportedLanguageCodes.*').isString().trim().isLength({ min: 2, max: 10 }).withMessage('Each supported language code must be 2-10 characters'),
  body('customTranslations').optional().isObject().withMessage('Custom translations must be an object'),
  body('brandingTranslations').optional().isObject().withMessage('Branding translations must be an object'),
  body('instructionLanguageCode').optional().isString().trim().withMessage('Instruction language code must be a string'),
  body('curriculumLanguageMapping').optional().isObject().withMessage('Curriculum language mapping must be an object'),
  body('gradeLevelLanguageRequirements').optional().isObject().withMessage('Grade level language requirements must be an object'),
  body('parentCommunicationLanguageCode').optional().isString().trim().withMessage('Parent communication language code must be a string'),
  body('defaultReportLanguageCode').optional().isString().trim().withMessage('Default report language code must be a string')
], validate, internationalizationController.setSchoolLanguageSettings);

router.put('/schools/:schoolId/settings', [
  requireRole(['super_admin', 'edufam_admin']),
  param('schoolId').isUUID().withMessage('Valid school ID is required'),
  body('defaultLanguageCode').isString().trim().isLength({ min: 2, max: 10 }).withMessage('Default language code is required'),
  body('supportedLanguageCodes').isArray().withMessage('Supported language codes must be an array'),
  body('supportedLanguageCodes.*').isString().trim().isLength({ min: 2, max: 10 }).withMessage('Each supported language code must be 2-10 characters'),
  body('customTranslations').optional().isObject().withMessage('Custom translations must be an object'),
  body('brandingTranslations').optional().isObject().withMessage('Branding translations must be an object'),
  body('instructionLanguageCode').optional().isString().trim().withMessage('Instruction language code must be a string'),
  body('curriculumLanguageMapping').optional().isObject().withMessage('Curriculum language mapping must be an object'),
  body('gradeLevelLanguageRequirements').optional().isObject().withMessage('Grade level language requirements must be an object'),
  body('parentCommunicationLanguageCode').optional().isString().trim().withMessage('Parent communication language code must be a string'),
  body('defaultReportLanguageCode').optional().isString().trim().withMessage('Default report language code must be a string')
], validate, internationalizationController.setSchoolLanguageSettings);

// ====================================
// CONTENT LOCALIZATION
// ====================================

/**
 * Localize content
 * POST /api/v1/i18n/content/localize
 */
router.post('/content/localize', [
  requireRole(['super_admin', 'edufam_admin', 'translator', 'school_admin', 'teacher']),
  body('contentType').isString().trim().isLength({ min: 1, max: 50 }).withMessage('Content type is required (1-50 characters)'),
  body('contentId').isUUID().withMessage('Valid content ID is required'),
  body('languageCode').isString().trim().isLength({ min: 2, max: 10 }).withMessage('Language code is required'),
  body('title').optional().isString().trim().withMessage('Title must be a string'),
  body('content').optional().isString().trim().withMessage('Content must be a string'),
  body('summary').optional().isString().trim().withMessage('Summary must be a string'),
  body('metaDescription').optional().isString().trim().withMessage('Meta description must be a string'),
  body('keywords').optional().isArray().withMessage('Keywords must be an array'),
  body('customFields').optional().isObject().withMessage('Custom fields must be an object'),
  body('localizationStatus').optional().isIn(['draft', 'translated', 'reviewed', 'published']).withMessage('Invalid localization status')
], validate, internationalizationController.localizeContent);

/**
 * Get content localizations
 * GET /api/v1/i18n/content/localizations
 */
router.get('/content/localizations', [
  query('contentType').optional().isString().trim().withMessage('Content type must be a string'),
  query('contentId').optional().isUUID().withMessage('Content ID must be valid UUID'),
  query('languageCode').optional().isString().trim().withMessage('Language code must be a string'),
  query('status').optional().isIn(['draft', 'translated', 'reviewed', 'published']).withMessage('Invalid status')
], validate, internationalizationController.getContentLocalizations);

// ====================================
// TRANSLATION MEMORY
// ====================================

/**
 * Search translation memory
 * GET /api/v1/i18n/memory/search
 */
router.get('/memory/search', [
  requireRole(['super_admin', 'edufam_admin', 'translator']),
  query('sourceText').isString().trim().isLength({ min: 1 }).withMessage('Source text is required'),
  query('sourceLanguageCode').isString().trim().isLength({ min: 2, max: 10 }).withMessage('Source language code is required'),
  query('targetLanguageCode').isString().trim().isLength({ min: 2, max: 10 }).withMessage('Target language code is required')
], validate, internationalizationController.searchTranslationMemory);

/**
 * Add to translation memory
 * POST /api/v1/i18n/memory
 */
router.post('/memory', [
  requireRole(['super_admin', 'edufam_admin', 'translator']),
  body('sourceLanguageCode').isString().trim().isLength({ min: 2, max: 10 }).withMessage('Source language code is required'),
  body('targetLanguageCode').isString().trim().isLength({ min: 2, max: 10 }).withMessage('Target language code is required'),
  body('sourceText').isString().trim().isLength({ min: 1 }).withMessage('Source text is required'),
  body('targetText').isString().trim().isLength({ min: 1 }).withMessage('Target text is required'),
  body('contextType').optional().isString().trim().withMessage('Context type must be a string')
], validate, internationalizationController.addToTranslationMemory);

// ====================================
// LANGUAGE DETECTION AND UTILITIES
// ====================================

/**
 * Detect language
 * POST /api/v1/i18n/detect
 */
router.post('/detect', [
  body('text').isString().trim().isLength({ min: 1 }).withMessage('Text is required for language detection')
], validate, internationalizationController.detectLanguage);

/**
 * Format message with variables
 * POST /api/v1/i18n/format
 */
router.post('/format', [
  body('messageKey').isString().trim().isLength({ min: 1 }).withMessage('Message key is required'),
  body('variables').optional().isObject().withMessage('Variables must be an object'),
  body('languageCode').optional().isString().trim().isLength({ min: 2, max: 10 }).withMessage('Language code must be 2-10 characters')
], validate, internationalizationController.formatMessage);

// ====================================
// ANALYTICS AND REPORTING
// ====================================

/**
 * Get localization analytics
 * GET /api/v1/i18n/analytics
 */
router.get('/analytics', [
  requireRole(['super_admin', 'edufam_admin', 'school_admin', 'principal']),
  query('metricType').optional().isString().trim().withMessage('Metric type must be a string'),
  query('languageCode').optional().isString().trim().withMessage('Language code must be a string'),
  query('startDate').optional().isISO8601().withMessage('Start date must be valid ISO date'),
  query('endDate').optional().isISO8601().withMessage('End date must be valid ISO date')
], validate, internationalizationController.getLocalizationAnalytics);

// ====================================
// ADMIN FUNCTIONS
// ====================================

/**
 * Get translation dashboard
 * GET /api/v1/i18n/dashboard
 */
router.get('/dashboard', [
  requireRole(['super_admin', 'edufam_admin', 'translator']),
  query('languageCode').optional().isString().trim().withMessage('Language code must be a string')
], validate, internationalizationController.getTranslationDashboard);

// ====================================
// HEALTH CHECK
// ====================================

/**
 * Internationalization service health check
 * GET /api/v1/i18n/health
 */
router.get('/health', internationalizationController.getInternationalizationHealth);

// ====================================
// ERROR HANDLING
// ====================================

// Global error handler for i18n routes
router.use((error, req, res, next) => {
  console.error('Internationalization route error:', error);
  
  res.status(error.statusCode || 500).json({
    success: false,
    error: {
      code: error.code || 'I18N_ERROR',
      message: error.message || 'An error occurred in internationalization'
    }
  });
});

module.exports = router;