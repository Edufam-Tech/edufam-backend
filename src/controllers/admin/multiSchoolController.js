const { query } = require('../../config/database');
const { ValidationError, NotFoundError, ConflictError } = require('../../middleware/errorHandler');

class MultiSchoolController {
  // =============================================================================
  // SCHOOL ONBOARDING MANAGEMENT
  // =============================================================================

  // Create onboarding request
  static async createOnboardingRequest(req, res, next) {
    try {
      const {
        schoolName,
        principalName,
        principalEmail,
        principalPhone,
        schoolAddress,
        regionId,
        schoolType,
        curriculumType,
        expectedStudents,
        expectedStaff,
        preferredPlan,
        documentsSubmitted = []
      } = req.body;

      if (!schoolName || !principalName || !principalEmail) {
        throw new ValidationError('School name, principal name, and principal email are required');
      }

      // Check if email already exists
      const existingRequest = await query(`
        SELECT id FROM school_onboarding_requests 
        WHERE principal_email = $1 AND status != 'rejected'
      `, [principalEmail]);

      if (existingRequest.rows.length > 0) {
        throw new ConflictError('An onboarding request with this email already exists');
      }

      // Generate request number
      const requestCount = await query(`
        SELECT COUNT(*) as count FROM school_onboarding_requests 
        WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE)
      `);
      
      const currentYear = new Date().getFullYear();
      const sequence = parseInt(requestCount.rows[0].count) + 1;
      const requestNumber = `ONB-${currentYear}-${sequence.toString().padStart(4, '0')}`;

      const result = await query(`
        INSERT INTO school_onboarding_requests (
          request_number, school_name, principal_name, principal_email, principal_phone,
          school_address, region_id, school_type, curriculum_type, expected_students,
          expected_staff, preferred_plan, documents_submitted
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
      `, [
        requestNumber, schoolName, principalName, principalEmail, principalPhone,
        schoolAddress, regionId, schoolType, curriculumType, expectedStudents,
        expectedStaff, preferredPlan, JSON.stringify(documentsSubmitted)
      ]);

      res.status(201).json({
        success: true,
        message: 'Onboarding request created successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  // Get onboarding requests
  static async getOnboardingRequests(req, res, next) {
    try {
      const { 
        status, 
        regionId, 
        assignedTo, 
        startDate, 
        endDate,
        limit = 20, 
        offset = 0 
      } = req.query;

      let whereClause = 'WHERE 1=1';
      const params = [];

      if (status) {
        whereClause += ` AND sor.status = $${params.length + 1}`;
        params.push(status);
      }

      if (regionId) {
        whereClause += ` AND sor.region_id = $${params.length + 1}`;
        params.push(regionId);
      }

      if (assignedTo) {
        whereClause += ` AND sor.assigned_to = $${params.length + 1}`;
        params.push(assignedTo);
      }

      if (startDate) {
        whereClause += ` AND sor.submitted_at >= $${params.length + 1}`;
        params.push(startDate);
      }

      if (endDate) {
        whereClause += ` AND sor.submitted_at <= $${params.length + 1}`;
        params.push(endDate);
      }

      const result = await query(`
        SELECT 
          sor.*,
          pr.region_name,
          pa.first_name as assigned_admin_first_name,
          pa.last_name as assigned_admin_last_name
        FROM school_onboarding_requests sor
        LEFT JOIN platform_regions pr ON sor.region_id = pr.id
        LEFT JOIN platform_admins pa ON sor.assigned_to = pa.id
        ${whereClause}
        ORDER BY sor.submitted_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `, [...params, limit, offset]);

      res.json({
        success: true,
        data: result.rows,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: result.rows.length
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Assign onboarding request to admin
  static async assignOnboardingRequest(req, res, next) {
    try {
      const { id } = req.params;
      const { assignedTo } = req.body;

      if (!assignedTo) {
        throw new ValidationError('Admin ID is required for assignment');
      }

      // Verify admin exists
      const adminResult = await query(`
        SELECT id FROM platform_admins WHERE id = $1 AND status = 'active'
      `, [assignedTo]);

      if (adminResult.rows.length === 0) {
        throw new NotFoundError('Admin not found or inactive');
      }

      const result = await query(`
        UPDATE school_onboarding_requests 
        SET assigned_to = $1, status = 'under_review', updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
      `, [assignedTo, id]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Onboarding request not found');
      }

      res.json({
        success: true,
        message: 'Onboarding request assigned successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  // Review onboarding request
  static async reviewOnboardingRequest(req, res, next) {
    try {
      const { id } = req.params;
      const { 
        decision, // 'approve' or 'reject'
        rejectionReason,
        verificationStatus,
        onboardingProgress = {}
      } = req.body;

      if (!decision || !['approve', 'reject'].includes(decision)) {
        throw new ValidationError('Decision must be either "approve" or "reject"');
      }

      if (decision === 'reject' && !rejectionReason) {
        throw new ValidationError('Rejection reason is required when rejecting a request');
      }

      const status = decision === 'approve' ? 'approved' : 'rejected';
      
      const result = await query(`
        UPDATE school_onboarding_requests 
        SET status = $1, 
            rejection_reason = $2,
            verification_status = $3,
            onboarding_progress = $4,
            reviewed_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $5
        RETURNING *
      `, [
        status, 
        rejectionReason, 
        verificationStatus || 'verified', 
        JSON.stringify(onboardingProgress), 
        id
      ]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Onboarding request not found');
      }

      res.json({
        success: true,
        message: `Onboarding request ${decision}d successfully`,
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  // Complete onboarding (create actual school)
  static async completeOnboarding(req, res, next) {
    try {
      const { id } = req.params;
      const { subscriptionPlan } = req.body;

      // Get onboarding request
      const requestResult = await query(`
        SELECT * FROM school_onboarding_requests 
        WHERE id = $1 AND status = 'approved'
      `, [id]);

      if (requestResult.rows.length === 0) {
        throw new NotFoundError('Approved onboarding request not found');
      }

      const request = requestResult.rows[0];

      // Create school
      const schoolResult = await query(`
        INSERT INTO schools (
          name, code, address, phone, email, 
          subscription_type, currency, max_students, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
        RETURNING *
      `, [
        request.school_name,
        `SCH-${Date.now()}`, // Generate unique code
        request.school_address,
        request.principal_phone,
        request.principal_email,
        subscriptionPlan || 'monthly',
        'USD', // Default currency
        request.expected_students || 500
      ]);

      const school = schoolResult.rows[0];

      // Create principal user
      const bcrypt = require('bcrypt');
      const tempPassword = Math.random().toString(36).slice(-8);
      const hashedPassword = await bcrypt.hash(tempPassword, 10);

      await query(`
        INSERT INTO users (
          school_id, first_name, last_name, email, phone, 
          password_hash, user_type, role, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, 'school_user', 'principal', true)
      `, [
        school.id,
        request.principal_name.split(' ')[0],
        request.principal_name.split(' ').slice(1).join(' '),
        request.principal_email,
        request.principal_phone,
        hashedPassword
      ]);

      // Update onboarding request
      await query(`
        UPDATE school_onboarding_requests 
        SET status = 'completed', 
            completed_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [id]);

      res.status(201).json({
        success: true,
        message: 'School onboarding completed successfully',
        data: {
          school: school,
          temporaryPassword: tempPassword,
          principalEmail: request.principal_email
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // SCHOOL MANAGEMENT
  // =============================================================================

  // Get all schools
  static async getAllSchools(req, res, next) {
    try {
      const { 
        regionId, 
        status, 
        subscriptionType,
        search,
        limit = 20, 
        offset = 0 
      } = req.query;

      let whereClause = 'WHERE 1=1';
      const params = [];

      if (regionId) {
        whereClause += ` AND sor.region_id = $${params.length + 1}`;
        params.push(regionId);
      }

      if (status) {
        whereClause += ` AND s.is_active = $${params.length + 1}`;
        params.push(status === 'active');
      }

      if (subscriptionType) {
        whereClause += ` AND s.subscription_type = $${params.length + 1}`;
        params.push(subscriptionType);
      }

      if (search) {
        whereClause += ` AND (s.name ILIKE $${params.length + 1} OR s.code ILIKE $${params.length + 1})`;
        params.push(`%${search}%`);
      }

      const result = await query(`
        SELECT 
          s.*,
          COUNT(DISTINCT u.id) FILTER (WHERE u.user_type = 'school_user') as total_users,
          COUNT(DISTINCT st.id) as total_students,
          COUNT(DISTINCT staff.id) as total_staff,
          ss.subscription_status,
          ss.next_billing_date,
          pr.region_name
        FROM schools s
        LEFT JOIN users u ON s.id = u.school_id AND u.is_active = true
        LEFT JOIN students st ON s.id = st.school_id
        LEFT JOIN staff ON s.id = staff.school_id AND staff.is_active = true
        LEFT JOIN school_subscriptions ss ON s.id = ss.school_id
        LEFT JOIN school_onboarding_requests sor ON s.email = sor.principal_email
        LEFT JOIN platform_regions pr ON sor.region_id = pr.id
        ${whereClause}
        GROUP BY s.id, ss.subscription_status, ss.next_billing_date, pr.region_name
        ORDER BY s.created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `, [...params, limit, offset]);

      res.json({
        success: true,
        data: result.rows,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: result.rows.length
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Get school details
  static async getSchoolDetails(req, res, next) {
    try {
      const { id } = req.params;

      const [schoolResult, metricsResult, oversightResult] = await Promise.all([
        query(`
          SELECT 
            s.*,
            COUNT(DISTINCT u.id) FILTER (WHERE u.user_type = 'school_user') as total_users,
            COUNT(DISTINCT st.id) as total_students,
            COUNT(DISTINCT staff.id) as total_staff,
            COUNT(DISTINCT c.id) as total_classes,
            ss.subscription_status,
            ss.next_billing_date,
            ss.monthly_cost,
            pr.region_name
          FROM schools s
          LEFT JOIN users u ON s.id = u.school_id AND u.is_active = true
          LEFT JOIN students st ON s.id = st.school_id
          LEFT JOIN staff ON s.id = staff.school_id AND staff.is_active = true
          LEFT JOIN classes c ON s.id = c.school_id
          LEFT JOIN school_subscriptions ss ON s.id = ss.school_id
          LEFT JOIN school_onboarding_requests sor ON s.email = sor.principal_email
          LEFT JOIN platform_regions pr ON sor.region_id = pr.id
          WHERE s.id = $1
          GROUP BY s.id, ss.subscription_status, ss.next_billing_date, ss.monthly_cost, pr.region_name
        `, [id]),

        query(`
          SELECT * FROM school_analytics_summary 
          WHERE school_id = $1 
          ORDER BY summary_date DESC 
          LIMIT 30
        `, [id]),

        query(`
          SELECT * FROM school_oversight 
          WHERE school_id = $1 
          ORDER BY last_review_date DESC
        `, [id])
      ]);

      if (schoolResult.rows.length === 0) {
        throw new NotFoundError('School not found');
      }

      const schoolDetails = {
        ...schoolResult.rows[0],
        recentMetrics: metricsResult.rows,
        oversight: oversightResult.rows
      };

      res.json({
        success: true,
        data: schoolDetails
      });
    } catch (error) {
      next(error);
    }
  }

  // Suspend school
  static async suspendSchool(req, res, next) {
    try {
      const { id } = req.params;
      const { reason, suspensionDuration } = req.body;

      if (!reason) {
        throw new ValidationError('Suspension reason is required');
      }

      // Update school status
      const result = await query(`
        UPDATE schools 
        SET is_active = false, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `, [id]);

      if (result.rows.length === 0) {
        throw new NotFoundError('School not found');
      }

      // Log the suspension action
      await query(`
        INSERT INTO admin_activity_logs (
          admin_id, activity_type, target_type, target_id, action_description
        ) VALUES ($1, 'suspension', 'school', $2, $3)
      `, [req.user.userId, id, `School suspended: ${reason}`]);

      res.json({
        success: true,
        message: 'School suspended successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  // Reactivate school
  static async reactivateSchool(req, res, next) {
    try {
      const { id } = req.params;
      const { reactivationNotes } = req.body;

      const result = await query(`
        UPDATE schools 
        SET is_active = true, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `, [id]);

      if (result.rows.length === 0) {
        throw new NotFoundError('School not found');
      }

      // Log the reactivation action
      await query(`
        INSERT INTO admin_activity_logs (
          admin_id, activity_type, target_type, target_id, action_description
        ) VALUES ($1, 'reactivation', 'school', $2, $3)
      `, [req.user.userId, id, `School reactivated: ${reactivationNotes || 'No notes provided'}`]);

      res.json({
        success: true,
        message: 'School reactivated successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // SCHOOL OVERSIGHT
  // =============================================================================

  // Create oversight record
  static async createOversightRecord(req, res, next) {
    try {
      const { schoolId } = req.params;
      const {
        oversightType,
        status,
        complianceScore,
        performanceScore,
        financialHealthScore,
        issuesIdentified = [],
        actionItems = [],
        notes
      } = req.body;

      if (!oversightType || !status) {
        throw new ValidationError('Oversight type and status are required');
      }

      const result = await query(`
        INSERT INTO school_oversight (
          school_id, oversight_type, status, last_review_date, next_review_date,
          compliance_score, performance_score, financial_health_score,
          issues_identified, action_items, assigned_admin_id, notes
        ) VALUES ($1, $2, $3, CURRENT_DATE, CURRENT_DATE + INTERVAL '90 days', $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `, [
        schoolId, oversightType, status, complianceScore, performanceScore,
        financialHealthScore, JSON.stringify(issuesIdentified),
        JSON.stringify(actionItems), req.user.userId, notes
      ]);

      res.status(201).json({
        success: true,
        message: 'Oversight record created successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  // Get oversight records
  static async getOversightRecords(req, res, next) {
    try {
      const { schoolId } = req.params;
      const { oversightType, status } = req.query;

      let whereClause = 'WHERE so.school_id = $1';
      const params = [schoolId];

      if (oversightType) {
        whereClause += ` AND so.oversight_type = $${params.length + 1}`;
        params.push(oversightType);
      }

      if (status) {
        whereClause += ` AND so.status = $${params.length + 1}`;
        params.push(status);
      }

      const result = await query(`
        SELECT 
          so.*,
          s.name as school_name,
          pa.first_name as admin_first_name,
          pa.last_name as admin_last_name
        FROM school_oversight so
        JOIN schools s ON so.school_id = s.id
        LEFT JOIN platform_admins pa ON so.assigned_admin_id = pa.id
        ${whereClause}
        ORDER BY so.last_review_date DESC
      `, params);

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      next(error);
    }
  }

  // Update oversight record
  static async updateOversightRecord(req, res, next) {
    try {
      const { id } = req.params;
      const updates = req.body;

      const allowedFields = [
        'status', 'compliance_score', 'performance_score', 'financial_health_score',
        'issues_identified', 'action_items', 'notes', 'next_review_date'
      ];

      const setClause = [];
      const values = [];
      let paramIndex = 1;

      Object.keys(updates).forEach(key => {
        if (allowedFields.includes(key)) {
          if (['issues_identified', 'action_items'].includes(key)) {
            setClause.push(`${key} = $${paramIndex}`);
            values.push(JSON.stringify(updates[key]));
          } else {
            setClause.push(`${key} = $${paramIndex}`);
            values.push(updates[key]);
          }
          paramIndex++;
        }
      });

      if (setClause.length === 0) {
        throw new ValidationError('No valid fields provided for update');
      }

      setClause.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(id);

      const result = await query(`
        UPDATE school_oversight 
        SET ${setClause.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `, values);

      if (result.rows.length === 0) {
        throw new NotFoundError('Oversight record not found');
      }

      res.json({
        success: true,
        message: 'Oversight record updated successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // PLATFORM REGIONS
  // =============================================================================

  // Get platform regions
  static async getPlatformRegions(req, res, next) {
    try {
      const { isActive, country } = req.query;

      let whereClause = 'WHERE 1=1';
      const params = [];

      if (isActive !== undefined) {
        whereClause += ` AND is_active = $${params.length + 1}`;
        params.push(isActive === 'true');
      }

      if (country) {
        whereClause += ` AND country = $${params.length + 1}`;
        params.push(country);
      }

      const result = await query(`
        SELECT 
          pr.*,
          COUNT(sor.id) as onboarding_requests_count,
          COUNT(s.id) as active_schools_count
        FROM platform_regions pr
        LEFT JOIN school_onboarding_requests sor ON pr.id = sor.region_id
        LEFT JOIN school_onboarding_requests sor2 ON pr.id = sor2.region_id AND sor2.status = 'completed'
        LEFT JOIN schools s ON s.email IN (SELECT principal_email FROM school_onboarding_requests WHERE region_id = pr.id)
        ${whereClause}
        GROUP BY pr.id
        ORDER BY pr.region_name
      `, params);

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      next(error);
    }
  }

  // Create platform region
  static async createPlatformRegion(req, res, next) {
    try {
      const {
        regionName,
        regionCode,
        country,
        stateProvince,
        timezone = 'UTC',
        currency = 'USD',
        language = 'en',
        regionalManagerId
      } = req.body;

      if (!regionName || !regionCode || !country) {
        throw new ValidationError('Region name, region code, and country are required');
      }

      const result = await query(`
        INSERT INTO platform_regions (
          region_name, region_code, country, state_province, timezone,
          currency, language, regional_manager_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `, [
        regionName, regionCode, country, stateProvince, timezone,
        currency, language, regionalManagerId
      ]);

      res.status(201).json({
        success: true,
        message: 'Platform region created successfully',
        data: result.rows[0]
      });
    } catch (error) {
      if (error.code === '23505') {
        next(new ConflictError('Region code already exists'));
      } else {
        next(error);
      }
    }
  }
}

module.exports = MultiSchoolController;