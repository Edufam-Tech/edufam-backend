const { query } = require('../config/database');
const { DatabaseError, AuthorizationError, ValidationError } = require('../middleware/errorHandler');

/**
 * Multi-School Director Service
 * Handles school context switching, access management, and cross-school operations
 */
class MultiSchoolDirectorService {
  
  /**
   * Get all schools accessible to a director
   */
  async getDirectorSchools(directorId) {
    try {
      const result = await query(`
        SELECT 
          s.id,
          s.name,
          s.type as school_type,
          s.address,
          s.phone,
          s.email,
          s.logo_url,
          s.established_date,
          s.currency,
          dsa.access_level,
          dsa.granted_at,
          dsa.expires_at,
          -- Check if this is the current active school
          CASE WHEN dac.active_school_id = s.id THEN true ELSE false END as is_active_context,
          -- Check if this is a favorite school
          CASE WHEN dfs.school_id IS NOT NULL THEN true ELSE false END as is_favorite,
          dfs.display_order as favorite_order
        FROM director_school_access dsa
        JOIN schools s ON s.id = dsa.school_id
        LEFT JOIN director_active_contexts dac ON dac.director_id = dsa.director_id
        LEFT JOIN director_favorite_schools dfs ON dfs.director_id = dsa.director_id AND dfs.school_id = s.id
        WHERE dsa.director_id = $1
          AND dsa.is_active = true
          AND (dsa.expires_at IS NULL OR dsa.expires_at > NOW())
        ORDER BY 
          dfs.display_order ASC NULLS LAST,
          s.name ASC
      `, [directorId]);

      return result.rows;
    } catch (error) {
      throw new DatabaseError('Failed to fetch director schools', error);
    }
  }

  /**
   * Switch school context for a director
   */
  async switchSchoolContext(directorId, targetSchoolId, sessionInfo = {}) {
    try {
      // Validate director has access to target school
      const hasAccess = await this.validateDirectorAccess(directorId, targetSchoolId);
      if (!hasAccess) {
        throw new AuthorizationError('Access denied to requested school');
      }

      // Get current context
      const currentContext = await this.getCurrentContext(directorId);
      const fromSchoolId = currentContext?.active_school_id || null;

      // Log the switch
      const auditResult = await query(`
        SELECT log_school_switch($1, $2, $3, $4, $5, $6, $7) as audit_id
      `, [
        directorId,
        fromSchoolId,
        targetSchoolId,
        sessionInfo.sessionToken || null,
        sessionInfo.ipAddress || null,
        sessionInfo.userAgent || null,
        sessionInfo.reason || 'Manual context switch'
      ]);

      // Get updated context
      const newContext = await this.getCurrentContext(directorId);
      
      // Get school details
      const schoolDetails = await this.getSchoolDetails(targetSchoolId);

      return {
        success: true,
        auditId: auditResult.rows[0].audit_id,
        previousSchool: fromSchoolId,
        currentSchool: targetSchoolId,
        schoolDetails: schoolDetails,
        switchedAt: new Date().toISOString()
      };
    } catch (error) {
      if (error instanceof AuthorizationError) {
        throw error;
      }
      throw new DatabaseError('Failed to switch school context', error);
    }
  }

  /**
   * Validate director access to a school
   */
  async validateDirectorAccess(directorId, schoolId, requiredAccessLevel = 'read_only') {
    try {
      const result = await query(`
        SELECT validate_director_school_access($1, $2, $3) as has_access
      `, [directorId, schoolId, requiredAccessLevel]);

      return result.rows[0]?.has_access || false;
    } catch (error) {
      throw new DatabaseError('Failed to validate director access', error);
    }
  }

  /**
   * Get current active context for director
   */
  async getCurrentContext(directorId) {
    try {
      const result = await query(`
        SELECT 
          dac.*,
          s.name as school_name,
          s.type as school_type,
          s.currency
        FROM director_active_contexts dac
        LEFT JOIN schools s ON s.id = dac.active_school_id
        WHERE dac.director_id = $1
      `, [directorId]);

      return result.rows[0] || null;
    } catch (error) {
      throw new DatabaseError('Failed to get current context', error);
    }
  }

  /**
   * Get school details by ID
   */
  async getSchoolDetails(schoolId) {
    try {
      const result = await query(`
        SELECT 
          id,
          name,
          type,
          address,
          phone,
          email,
          logo_url,
          established_date,
          currency,
          timezone,
          academic_year_start,
          academic_year_end
        FROM schools
        WHERE id = $1
      `, [schoolId]);

      return result.rows[0] || null;
    } catch (error) {
      throw new DatabaseError('Failed to get school details', error);
    }
  }

  /**
   * Grant director access to a school
   */
  async grantSchoolAccess(directorId, schoolId, accessLevel, grantedBy, options = {}) {
    try {
      // Validate access level
      const validAccessLevels = ['read_only', 'academic_only', 'financial_only', 'full'];
      if (!validAccessLevels.includes(accessLevel)) {
        throw new ValidationError('Invalid access level');
      }

      // Validate grantor has permission (should be super_admin or school owner)
      const grantorValidation = await this.validateGrantorPermissions(grantedBy, schoolId);
      if (!grantorValidation.canGrant) {
        throw new AuthorizationError('Insufficient permissions to grant access');
      }

      const result = await query(`
        INSERT INTO director_school_access (
          director_id,
          school_id,
          access_level,
          granted_by,
          expires_at,
          access_reason
        ) VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (director_id, school_id) DO UPDATE SET
          access_level = EXCLUDED.access_level,
          granted_by = EXCLUDED.granted_by,
          granted_at = NOW(),
          expires_at = EXCLUDED.expires_at,
          access_reason = EXCLUDED.access_reason,
          is_active = true,
          updated_at = NOW()
        RETURNING *
      `, [
        directorId,
        schoolId,
        accessLevel,
        grantedBy,
        options.expiresAt || null,
        options.reason || null
      ]);

      return result.rows[0];
    } catch (error) {
      if (error instanceof ValidationError || error instanceof AuthorizationError) {
        throw error;
      }
      throw new DatabaseError('Failed to grant school access', error);
    }
  }

  /**
   * Revoke director access to a school
   */
  async revokeSchoolAccess(directorId, schoolId, revokedBy) {
    try {
      // Validate revoker has permission
      const revokerValidation = await this.validateGrantorPermissions(revokedBy, schoolId);
      if (!revokerValidation.canGrant) {
        throw new AuthorizationError('Insufficient permissions to revoke access');
      }

      const result = await query(`
        UPDATE director_school_access
        SET 
          is_active = false,
          updated_at = NOW()
        WHERE director_id = $1 AND school_id = $2
        RETURNING *
      `, [directorId, schoolId]);

      // If this was the active context, clear it
      if (result.rows.length > 0) {
        await query(`
          DELETE FROM director_active_contexts
          WHERE director_id = $1 AND active_school_id = $2
        `, [directorId, schoolId]);
      }

      return result.rows[0];
    } catch (error) {
      if (error instanceof AuthorizationError) {
        throw error;
      }
      throw new DatabaseError('Failed to revoke school access', error);
    }
  }

  /**
   * Add school to favorites
   */
  async addFavoriteSchool(directorId, schoolId, displayOrder = null) {
    try {
      // Validate director has access to school
      const hasAccess = await this.validateDirectorAccess(directorId, schoolId);
      if (!hasAccess) {
        throw new AuthorizationError('Cannot add school to favorites - no access');
      }

      // Get next display order if not provided
      if (displayOrder === null) {
        const orderResult = await query(`
          SELECT COALESCE(MAX(display_order), 0) + 1 as next_order
          FROM director_favorite_schools
          WHERE director_id = $1
        `, [directorId]);
        displayOrder = orderResult.rows[0].next_order;
      }

      const result = await query(`
        INSERT INTO director_favorite_schools (director_id, school_id, display_order)
        VALUES ($1, $2, $3)
        ON CONFLICT (director_id, school_id) DO UPDATE SET
          display_order = EXCLUDED.display_order,
          added_at = NOW()
        RETURNING *
      `, [directorId, schoolId, displayOrder]);

      return result.rows[0];
    } catch (error) {
      if (error instanceof AuthorizationError) {
        throw error;
      }
      throw new DatabaseError('Failed to add favorite school', error);
    }
  }

  /**
   * Remove school from favorites
   */
  async removeFavoriteSchool(directorId, schoolId) {
    try {
      const result = await query(`
        DELETE FROM director_favorite_schools
        WHERE director_id = $1 AND school_id = $2
        RETURNING *
      `, [directorId, schoolId]);

      return result.rows[0];
    } catch (error) {
      throw new DatabaseError('Failed to remove favorite school', error);
    }
  }

  /**
   * Get cross-school analytics
   */
  async getCrossSchoolAnalytics(directorId, analyticsType, schoolIds = null, options = {}) {
    try {
      // If no school IDs provided, get all accessible schools
      if (!schoolIds) {
        const schools = await this.getDirectorSchools(directorId);
        schoolIds = schools.map(school => school.id);
      }

      // Validate director has access to all requested schools
      for (const schoolId of schoolIds) {
        const hasAccess = await this.validateDirectorAccess(directorId, schoolId);
        if (!hasAccess) {
          throw new AuthorizationError(`Access denied to school: ${schoolId}`);
        }
      }

      // Check for cached analytics
      const cacheKey = `${analyticsType}-${schoolIds.sort().join('-')}`;
      const cachedResult = await query(`
        SELECT data, generated_at
        FROM cross_school_analytics
        WHERE director_id = $1 
          AND analytics_type = $2
          AND school_ids = $3
          AND expires_at > NOW()
        ORDER BY generated_at DESC
        LIMIT 1
      `, [directorId, analyticsType, schoolIds]);

      if (cachedResult.rows.length > 0 && !options.forceRefresh) {
        return {
          ...cachedResult.rows[0].data,
          cached: true,
          generatedAt: cachedResult.rows[0].generated_at
        };
      }

      // Generate fresh analytics
      const analyticsData = await this.generateAnalytics(analyticsType, schoolIds, options);

      // Cache the results
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + (options.cacheMinutes || 30));

      await query(`
        INSERT INTO cross_school_analytics (
          director_id,
          analytics_type,
          school_ids,
          data,
          parameters,
          expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        directorId,
        analyticsType,
        schoolIds,
        analyticsData,
        options,
        expiresAt
      ]);

      return {
        ...analyticsData,
        cached: false,
        generatedAt: new Date()
      };
    } catch (error) {
      if (error instanceof AuthorizationError) {
        throw error;
      }
      throw new DatabaseError('Failed to get cross-school analytics', error);
    }
  }

  /**
   * Generate analytics data
   */
  async generateAnalytics(analyticsType, schoolIds, options = {}) {
    try {
      switch (analyticsType) {
        case 'portfolio_summary':
          return await this.generatePortfolioSummary(schoolIds, options);
        case 'performance_comparison':
          return await this.generatePerformanceComparison(schoolIds, options);
        case 'financial_overview':
          return await this.generateFinancialOverview(schoolIds, options);
        case 'enrollment_trends':
          return await this.generateEnrollmentTrends(schoolIds, options);
        default:
          throw new ValidationError(`Unknown analytics type: ${analyticsType}`);
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * Generate portfolio summary analytics
   */
  async generatePortfolioSummary(schoolIds, options = {}) {
    const result = await query(`
      SELECT 
        COUNT(DISTINCT s.id) as total_schools,
        SUM(stats.total_students) as total_students,
        SUM(stats.total_staff) as total_staff,
        SUM(stats.total_classes) as total_classes,
        AVG(stats.avg_class_size) as avg_class_size,
        array_agg(DISTINCT s.type) as school_types,
        array_agg(DISTINCT s.currency) as currencies
      FROM schools s
      LEFT JOIN LATERAL (
        SELECT 
          (SELECT COUNT(*) FROM students WHERE school_id = s.id AND is_active = true) as total_students,
          (SELECT COUNT(*) FROM staff WHERE school_id = s.id AND employment_status = 'active') as total_staff,
          (SELECT COUNT(*) FROM classes WHERE school_id = s.id AND is_active = true) as total_classes,
          (SELECT AVG(student_count) FROM (
            SELECT COUNT(*) as student_count 
            FROM students 
            WHERE school_id = s.id AND is_active = true 
            GROUP BY class_id
          ) class_sizes) as avg_class_size
      ) stats ON true
      WHERE s.id = ANY($1)
    `, [schoolIds]);

    const summary = result.rows[0];

    // Get individual school data
    const schoolsData = await query(`
      SELECT 
        s.id,
        s.name,
        s.type,
        s.currency,
        (SELECT COUNT(*) FROM students WHERE school_id = s.id AND is_active = true) as student_count,
        (SELECT COUNT(*) FROM staff WHERE school_id = s.id AND employment_status = 'active') as staff_count,
        (SELECT COUNT(*) FROM classes WHERE school_id = s.id AND is_active = true) as class_count
      FROM schools s
      WHERE s.id = ANY($1)
      ORDER BY s.name
    `, [schoolIds]);

    return {
      summary: {
        totalSchools: parseInt(summary.total_schools) || 0,
        totalStudents: parseInt(summary.total_students) || 0,
        totalStaff: parseInt(summary.total_staff) || 0,
        totalClasses: parseInt(summary.total_classes) || 0,
        avgClassSize: parseFloat(summary.avg_class_size) || 0,
        schoolTypes: summary.school_types || [],
        currencies: summary.currencies || []
      },
      schools: schoolsData.rows,
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Generate performance comparison analytics
   */
  async generatePerformanceComparison(schoolIds, options = {}) {
    // This would include academic performance, attendance rates, etc.
    // Implementation depends on your specific academic data structure
    const result = await query(`
      SELECT 
        s.id,
        s.name,
        -- Add performance metrics based on your schema
        COALESCE(performance_stats.avg_grade, 0) as avg_performance,
        COALESCE(attendance_stats.avg_attendance, 0) as avg_attendance
      FROM schools s
      LEFT JOIN LATERAL (
        -- Example performance calculation - adjust based on your grade structure
        SELECT AVG(grade_value) as avg_grade
        FROM grades g
        JOIN students st ON st.id = g.student_id
        WHERE st.school_id = s.id
          AND g.created_at >= NOW() - INTERVAL '3 months'
      ) performance_stats ON true
      LEFT JOIN LATERAL (
        -- Example attendance calculation
        SELECT AVG(
          CASE WHEN status = 'present' THEN 100.0 
               WHEN status = 'late' THEN 75.0 
               ELSE 0.0 END
        ) as avg_attendance
        FROM attendance a
        JOIN students st ON st.id = a.student_id
        WHERE st.school_id = s.id
          AND a.date >= CURRENT_DATE - INTERVAL '30 days'
      ) attendance_stats ON true
      WHERE s.id = ANY($1)
      ORDER BY s.name
    `, [schoolIds]);

    return {
      schools: result.rows,
      comparisonDate: new Date().toISOString(),
      metrics: ['avg_performance', 'avg_attendance']
    };
  }

  /**
   * Generate financial overview analytics
   */
  async generateFinancialOverview(schoolIds, options = {}) {
    const result = await query(`
      SELECT 
        s.id,
        s.name,
        s.currency,
        COALESCE(revenue_stats.total_revenue, 0) as total_revenue,
        COALESCE(revenue_stats.outstanding_fees, 0) as outstanding_fees,
        COALESCE(expense_stats.total_expenses, 0) as total_expenses
      FROM schools s
      LEFT JOIN LATERAL (
        SELECT 
          SUM(CASE WHEN payment_status = 'completed' THEN amount ELSE 0 END) as total_revenue,
          SUM(CASE WHEN payment_status = 'pending' THEN amount ELSE 0 END) as outstanding_fees
        FROM fee_payments fp
        WHERE fp.school_id = s.id
          AND fp.created_at >= NOW() - INTERVAL '1 year'
      ) revenue_stats ON true
      LEFT JOIN LATERAL (
        SELECT SUM(amount) as total_expenses
        FROM expenses e
        WHERE e.school_id = s.id
          AND e.status = 'approved'
          AND e.created_at >= NOW() - INTERVAL '1 year'
      ) expense_stats ON true
      WHERE s.id = ANY($1)
      ORDER BY s.name
    `, [schoolIds]);

    return {
      schools: result.rows,
      period: 'last_12_months',
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Generate enrollment trends analytics
   */
  async generateEnrollmentTrends(schoolIds, options = {}) {
    const result = await query(`
      SELECT 
        s.id,
        s.name,
        enrollment_data.monthly_enrollment
      FROM schools s
      LEFT JOIN LATERAL (
        SELECT json_agg(
          json_build_object(
            'month', enrollment_month,
            'student_count', student_count,
            'new_enrollments', new_enrollments
          ) ORDER BY enrollment_month
        ) as monthly_enrollment
        FROM (
          SELECT 
            DATE_TRUNC('month', created_at) as enrollment_month,
            COUNT(*) as student_count,
            COUNT(*) FILTER (WHERE created_at >= DATE_TRUNC('month', created_at)) as new_enrollments
          FROM students
          WHERE school_id = s.id
            AND created_at >= NOW() - INTERVAL '12 months'
          GROUP BY DATE_TRUNC('month', created_at)
        ) monthly_data
      ) enrollment_data ON true
      WHERE s.id = ANY($1)
      ORDER BY s.name
    `, [schoolIds]);

    return {
      schools: result.rows,
      period: 'last_12_months',
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Validate grantor permissions
   */
  async validateGrantorPermissions(grantorId, schoolId) {
    try {
      const result = await query(`
        SELECT 
          u.role,
          CASE 
            WHEN u.role IN ('super_admin', 'edufam_admin') THEN true
            WHEN u.role = 'school_director' AND u.school_id = $2 THEN true
            WHEN u.role = 'school_director' AND EXISTS (
              SELECT 1 FROM director_school_access 
              WHERE director_id = $1 AND school_id = $2 AND access_level = 'full' AND is_active = true
            ) THEN true
            ELSE false
          END as can_grant
        FROM users u
        WHERE u.id = $1
      `, [grantorId, schoolId]);

      return result.rows[0] || { canGrant: false };
    } catch (error) {
      throw new DatabaseError('Failed to validate grantor permissions', error);
    }
  }

  /**
   * Get director switch history
   */
  async getDirectorSwitchHistory(directorId, limit = 50) {
    try {
      const result = await query(`
        SELECT 
          ssa.*,
          fs.name as from_school_name,
          ts.name as to_school_name
        FROM school_switch_audit ssa
        LEFT JOIN schools fs ON fs.id = ssa.from_school_id
        LEFT JOIN schools ts ON ts.id = ssa.to_school_id
        WHERE ssa.director_id = $1
        ORDER BY ssa.switch_timestamp DESC
        LIMIT $2
      `, [directorId, limit]);

      return result.rows;
    } catch (error) {
      throw new DatabaseError('Failed to get switch history', error);
    }
  }
}

module.exports = new MultiSchoolDirectorService();