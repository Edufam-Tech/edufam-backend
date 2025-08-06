const multiSchoolDirectorService = require('../services/multiSchoolDirectorService');
const { asyncHandler } = require('../middleware/errorHandler');
const { ValidationError, AuthorizationError } = require('../middleware/errorHandler');

/**
 * Multi-School Director Controller
 * Handles API endpoints for school context switching and multi-school management
 */
class MultiSchoolDirectorController {

  /**
   * Get all schools accessible to the director
   * GET /api/v1/director/schools/portfolio
   */
  getPortfolio = asyncHandler(async (req, res) => {
    const directorId = req.user.userId;
    
    // Validate user is a director
    if (!req.user.role.includes('director')) {
      throw new AuthorizationError('Only directors can access school portfolio');
    }

    const schools = await multiSchoolDirectorService.getDirectorSchools(directorId);

    res.json({
      success: true,
      data: {
        schools,
        totalSchools: schools.length,
        activeContext: schools.find(school => school.is_active_context),
        favorites: schools.filter(school => school.is_favorite)
      },
      message: 'Portfolio retrieved successfully'
    });
  });

  /**
   * Switch school context
   * POST /api/v1/director/switch-school
   */
  switchSchool = asyncHandler(async (req, res) => {
    const directorId = req.user.userId;
    const { schoolId, reason } = req.body;

    if (!schoolId) {
      throw new ValidationError('School ID is required');
    }

    if (!req.user.role.includes('director')) {
      throw new AuthorizationError('Only directors can switch school context');
    }

    const sessionInfo = {
      sessionToken: req.sessionId || req.headers['x-session-id'],
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      reason: reason || 'Manual context switch'
    };

    const result = await multiSchoolDirectorService.switchSchoolContext(
      directorId, 
      schoolId, 
      sessionInfo
    );

    // Update session context if using sessions
    if (req.session) {
      req.session.activeSchoolId = schoolId;
    }

    res.json({
      success: true,
      data: result,
      message: 'School context switched successfully'
    });
  });

  /**
   * Get current school context
   * GET /api/v1/director/schools/:id/context
   */
  getSchoolContext = asyncHandler(async (req, res) => {
    const directorId = req.user.userId;
    const { id: schoolId } = req.params;

    if (!req.user.role.includes('director')) {
      throw new AuthorizationError('Only directors can access school context');
    }

    // Validate access to requested school
    const hasAccess = await multiSchoolDirectorService.validateDirectorAccess(
      directorId, 
      schoolId
    );

    if (!hasAccess) {
      throw new AuthorizationError('Access denied to requested school');
    }

    const schoolDetails = await multiSchoolDirectorService.getSchoolDetails(schoolId);
    const currentContext = await multiSchoolDirectorService.getCurrentContext(directorId);

    res.json({
      success: true,
      data: {
        school: schoolDetails,
        isActiveContext: currentContext?.active_school_id === schoolId,
        contextInfo: currentContext
      },
      message: 'School context retrieved successfully'
    });
  });

  /**
   * Get current active context
   * GET /api/v1/director/context/current
   */
  getCurrentContext = asyncHandler(async (req, res) => {
    const directorId = req.user.userId;

    if (!req.user.role.includes('director')) {
      throw new AuthorizationError('Only directors can access context information');
    }

    const context = await multiSchoolDirectorService.getCurrentContext(directorId);

    res.json({
      success: true,
      data: {
        context,
        hasActiveContext: !!context
      },
      message: 'Current context retrieved successfully'
    });
  });

  /**
   * Grant director access to a school
   * POST /api/v1/director/schools/grant-access
   */
  grantSchoolAccess = asyncHandler(async (req, res) => {
    const grantorId = req.user.userId;
    const { directorId, schoolId, accessLevel, expiresAt, reason } = req.body;

    if (!directorId || !schoolId || !accessLevel) {
      throw new ValidationError('Director ID, School ID, and access level are required');
    }

    // Validate access level
    const validLevels = ['read_only', 'academic_only', 'financial_only', 'full'];
    if (!validLevels.includes(accessLevel)) {
      throw new ValidationError('Invalid access level');
    }

    const result = await multiSchoolDirectorService.grantSchoolAccess(
      directorId,
      schoolId,
      accessLevel,
      grantorId,
      { expiresAt, reason }
    );

    res.status(201).json({
      success: true,
      data: result,
      message: 'School access granted successfully'
    });
  });

  /**
   * Revoke director access to a school
   * DELETE /api/v1/director/schools/:schoolId/access/:directorId
   */
  revokeSchoolAccess = asyncHandler(async (req, res) => {
    const revokedBy = req.user.userId;
    const { schoolId, directorId } = req.params;

    const result = await multiSchoolDirectorService.revokeSchoolAccess(
      directorId,
      schoolId,
      revokedBy
    );

    res.json({
      success: true,
      data: result,
      message: 'School access revoked successfully'
    });
  });

  /**
   * Add school to favorites
   * POST /api/v1/director/schools/favorite
   */
  addFavoriteSchool = asyncHandler(async (req, res) => {
    const directorId = req.user.userId;
    const { schoolId, displayOrder } = req.body;

    if (!schoolId) {
      throw new ValidationError('School ID is required');
    }

    if (!req.user.role.includes('director')) {
      throw new AuthorizationError('Only directors can manage favorite schools');
    }

    const result = await multiSchoolDirectorService.addFavoriteSchool(
      directorId,
      schoolId,
      displayOrder
    );

    res.status(201).json({
      success: true,
      data: result,
      message: 'School added to favorites successfully'
    });
  });

  /**
   * Remove school from favorites
   * DELETE /api/v1/director/schools/:schoolId/favorite
   */
  removeFavoriteSchool = asyncHandler(async (req, res) => {
    const directorId = req.user.userId;
    const { schoolId } = req.params;

    if (!req.user.role.includes('director')) {
      throw new AuthorizationError('Only directors can manage favorite schools');
    }

    const result = await multiSchoolDirectorService.removeFavoriteSchool(
      directorId,
      schoolId
    );

    res.json({
      success: true,
      data: result,
      message: 'School removed from favorites successfully'
    });
  });

  /**
   * Get cross-school portfolio analytics
   * GET /api/v1/director/analytics/portfolio
   */
  getPortfolioAnalytics = asyncHandler(async (req, res) => {
    const directorId = req.user.userId;
    const { schoolIds, forceRefresh, cacheMinutes } = req.query;

    if (!req.user.role.includes('director')) {
      throw new AuthorizationError('Only directors can access portfolio analytics');
    }

    const options = {
      forceRefresh: forceRefresh === 'true',
      cacheMinutes: parseInt(cacheMinutes) || 30
    };

    const parsedSchoolIds = schoolIds ? schoolIds.split(',') : null;

    const analytics = await multiSchoolDirectorService.getCrossSchoolAnalytics(
      directorId,
      'portfolio_summary',
      parsedSchoolIds,
      options
    );

    res.json({
      success: true,
      data: analytics,
      message: 'Portfolio analytics retrieved successfully'
    });
  });

  /**
   * Get school performance comparison
   * GET /api/v1/director/analytics/school-comparison
   */
  getSchoolComparison = asyncHandler(async (req, res) => {
    const directorId = req.user.userId;
    const { schoolIds, metrics, period } = req.query;

    if (!req.user.role.includes('director')) {
      throw new AuthorizationError('Only directors can access comparison analytics');
    }

    const options = {
      metrics: metrics ? metrics.split(',') : ['performance', 'attendance'],
      period: period || 'last_3_months'
    };

    const parsedSchoolIds = schoolIds ? schoolIds.split(',') : null;

    const analytics = await multiSchoolDirectorService.getCrossSchoolAnalytics(
      directorId,
      'performance_comparison',
      parsedSchoolIds,
      options
    );

    res.json({
      success: true,
      data: analytics,
      message: 'School comparison analytics retrieved successfully'
    });
  });

  /**
   * Get consolidated financial reports
   * GET /api/v1/director/analytics/consolidated-reports
   */
  getConsolidatedReports = asyncHandler(async (req, res) => {
    const directorId = req.user.userId;
    const { schoolIds, reportType, period } = req.query;

    if (!req.user.role.includes('director')) {
      throw new AuthorizationError('Only directors can access consolidated reports');
    }

    const options = {
      reportType: reportType || 'financial',
      period: period || 'last_12_months'
    };

    const parsedSchoolIds = schoolIds ? schoolIds.split(',') : null;

    const analytics = await multiSchoolDirectorService.getCrossSchoolAnalytics(
      directorId,
      'financial_overview',
      parsedSchoolIds,
      options
    );

    res.json({
      success: true,
      data: analytics,
      message: 'Consolidated reports retrieved successfully'
    });
  });

  /**
   * Get performance trends across schools
   * GET /api/v1/director/analytics/performance-trends
   */
  getPerformanceTrends = asyncHandler(async (req, res) => {
    const directorId = req.user.userId;
    const { schoolIds, timeframe, metrics } = req.query;

    if (!req.user.role.includes('director')) {
      throw new AuthorizationError('Only directors can access performance trends');
    }

    const options = {
      timeframe: timeframe || 'last_12_months',
      metrics: metrics ? metrics.split(',') : ['enrollment', 'performance', 'attendance']
    };

    const parsedSchoolIds = schoolIds ? schoolIds.split(',') : null;

    const analytics = await multiSchoolDirectorService.getCrossSchoolAnalytics(
      directorId,
      'enrollment_trends',
      parsedSchoolIds,
      options
    );

    res.json({
      success: true,
      data: analytics,
      message: 'Performance trends retrieved successfully'
    });
  });

  /**
   * Create custom analytics report
   * POST /api/v1/director/analytics/custom-report
   */
  createCustomReport = asyncHandler(async (req, res) => {
    const directorId = req.user.userId;
    const { reportConfig, schoolIds, parameters } = req.body;

    if (!req.user.role.includes('director')) {
      throw new AuthorizationError('Only directors can create custom reports');
    }

    if (!reportConfig) {
      throw new ValidationError('Report configuration is required');
    }

    // This would generate a custom report based on the configuration
    // Implementation would depend on specific requirements
    
    res.json({
      success: true,
      data: {
        reportId: `custom-${Date.now()}`,
        status: 'generating',
        estimatedCompletion: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes
      },
      message: 'Custom report generation started'
    });
  });

  /**
   * Get director switch history
   * GET /api/v1/director/history/switches
   */
  getSwitchHistory = asyncHandler(async (req, res) => {
    const directorId = req.user.userId;
    const { limit } = req.query;

    if (!req.user.role.includes('director')) {
      throw new AuthorizationError('Only directors can access switch history');
    }

    const history = await multiSchoolDirectorService.getDirectorSwitchHistory(
      directorId,
      parseInt(limit) || 50
    );

    res.json({
      success: true,
      data: {
        history,
        totalRecords: history.length
      },
      message: 'Switch history retrieved successfully'
    });
  });

  /**
   * Get recent schools (frequently accessed)
   * GET /api/v1/director/schools/recent
   */
  getRecentSchools = asyncHandler(async (req, res) => {
    const directorId = req.user.userId;
    const { limit } = req.query;

    if (!req.user.role.includes('director')) {
      throw new AuthorizationError('Only directors can access recent schools');
    }

    const recentSwitches = await multiSchoolDirectorService.getDirectorSwitchHistory(
      directorId,
      parseInt(limit) || 10
    );

    // Extract unique schools from recent switches
    const recentSchoolIds = [...new Set(recentSwitches.map(s => s.to_school_id))];
    
    // Get school details for recent schools
    const schools = await multiSchoolDirectorService.getDirectorSchools(directorId);
    const recentSchools = schools.filter(school => 
      recentSchoolIds.includes(school.id)
    );

    res.json({
      success: true,
      data: {
        schools: recentSchools,
        lastAccessed: recentSwitches.slice(0, 5)
      },
      message: 'Recent schools retrieved successfully'
    });
  });

  /**
   * Validate access to a specific school
   * GET /api/v1/director/schools/:schoolId/validate-access
   */
  validateAccess = asyncHandler(async (req, res) => {
    const directorId = req.user.userId;
    const { schoolId } = req.params;
    const { accessLevel } = req.query;

    if (!req.user.role.includes('director')) {
      throw new AuthorizationError('Only directors can validate school access');
    }

    const hasAccess = await multiSchoolDirectorService.validateDirectorAccess(
      directorId,
      schoolId,
      accessLevel || 'read_only'
    );

    res.json({
      success: true,
      data: {
        hasAccess,
        schoolId,
        accessLevel: accessLevel || 'read_only',
        validatedAt: new Date().toISOString()
      },
      message: 'Access validation completed'
    });
  });
}

module.exports = new MultiSchoolDirectorController();