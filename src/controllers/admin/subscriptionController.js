const { query } = require('../../config/database');
const { ValidationError, NotFoundError, ConflictError } = require('../../middleware/errorHandler');

class SubscriptionController {
  // =============================================================================
  // SUBSCRIPTION PLANS MANAGEMENT
  // =============================================================================

  // Create subscription plan
  static async createSubscriptionPlan(req, res, next) {
    try {
      const {
        planName,
        planCode,
        description,
        planType,
        billingCycle,
        basePrice,
        pricePerStudent,
        maxStudents,
        maxStaff,
        features = [],
        moduleAccess = [],
        storageLimitGb = 10,
        apiRateLimit = 1000,
        supportLevel = 'standard',
        trialPeriodDays = 30,
        setupFee = 0
      } = req.body;

      if (!planName || !planCode || !planType || !billingCycle) {
        throw new ValidationError('Plan name, code, type, and billing cycle are required');
      }

      const result = await query(`
        INSERT INTO subscription_plans (
          plan_name, plan_code, description, plan_type, billing_cycle,
          base_price, price_per_student, max_students, max_staff, features,
          module_access, storage_limit_gb, api_rate_limit, support_level,
          trial_period_days, setup_fee
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING *
      `, [
        planName, planCode, description, planType, billingCycle,
        basePrice, pricePerStudent, maxStudents, maxStaff, JSON.stringify(features),
        JSON.stringify(moduleAccess), storageLimitGb, apiRateLimit, supportLevel,
        trialPeriodDays, setupFee
      ]);

      res.status(201).json({
        success: true,
        message: 'Subscription plan created successfully',
        data: result.rows[0]
      });
    } catch (error) {
      if (error.code === '23505') {
        next(new ConflictError('Plan code already exists'));
      } else {
        next(error);
      }
    }
  }

  // Get subscription plans
  static async getSubscriptionPlans(req, res, next) {
    try {
      const { isActive, planType } = req.query;

      let whereClause = 'WHERE 1=1';
      const params = [];

      if (isActive !== undefined) {
        whereClause += ` AND is_active = $${params.length + 1}`;
        params.push(isActive === 'true');
      }

      if (planType) {
        whereClause += ` AND plan_type = $${params.length + 1}`;
        params.push(planType);
      }

      const result = await query(`
        SELECT 
          sp.*,
          COUNT(ss.id) as active_subscriptions,
          SUM(CASE WHEN ss.subscription_status = 'active' THEN ss.monthly_cost ELSE 0 END) as monthly_revenue
        FROM subscription_plans sp
        LEFT JOIN school_subscriptions ss ON sp.id = ss.plan_id AND ss.subscription_status = 'active'
        ${whereClause}
        GROUP BY sp.id
        ORDER BY sp.plan_type, sp.base_price
      `, params);

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      next(error);
    }
  }

  // Update subscription plan
  static async updateSubscriptionPlan(req, res, next) {
    try {
      const { id } = req.params;
      const updates = req.body;

      const allowedFields = [
        'plan_name', 'description', 'base_price', 'price_per_student',
        'max_students', 'max_staff', 'features', 'module_access',
        'storage_limit_gb', 'api_rate_limit', 'support_level',
        'trial_period_days', 'setup_fee', 'is_active', 'is_default'
      ];

      const setClause = [];
      const values = [];
      let paramIndex = 1;

      Object.keys(updates).forEach(key => {
        if (allowedFields.includes(key)) {
          if (['features', 'module_access'].includes(key)) {
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

      // If setting as default, unset other defaults
      if (updates.is_default === true) {
        await query(`UPDATE subscription_plans SET is_default = false WHERE id != $1`, [id]);
      }

      const result = await query(`
        UPDATE subscription_plans 
        SET ${setClause.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `, values);

      if (result.rows.length === 0) {
        throw new NotFoundError('Subscription plan not found');
      }

      res.json({
        success: true,
        message: 'Subscription plan updated successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // SCHOOL SUBSCRIPTIONS MANAGEMENT
  // =============================================================================

  // Create school subscription
  static async createSchoolSubscription(req, res, next) {
    try {
      const {
        schoolId,
        planId,
        billingCycle,
        startDate,
        endDate,
        trialEndDate,
        autoRenew = true,
        paymentMethod,
        billingContactEmail,
        billingAddress,
        taxExempt = false,
        taxRate = 0,
        discountPercentage = 0,
        customPricing
      } = req.body;

      if (!schoolId || !planId || !startDate) {
        throw new ValidationError('School ID, plan ID, and start date are required');
      }

      // Check if school already has an active subscription
      const existingSubscription = await query(`
        SELECT id FROM school_subscriptions 
        WHERE school_id = $1 AND subscription_status IN ('active', 'trial')
      `, [schoolId]);

      if (existingSubscription.rows.length > 0) {
        throw new ConflictError('School already has an active subscription');
      }

      // Get plan details for pricing calculation
      const planResult = await query(`
        SELECT * FROM subscription_plans WHERE id = $1
      `, [planId]);

      if (planResult.rows.length === 0) {
        throw new NotFoundError('Subscription plan not found');
      }

      const plan = planResult.rows[0];

      // Get school's current student and staff count
      const schoolStatsResult = await query(`
        SELECT 
          COUNT(DISTINCT st.id) as student_count,
          COUNT(DISTINCT staff.id) as staff_count
        FROM schools s
        LEFT JOIN students st ON s.id = st.school_id
        LEFT JOIN staff ON s.id = staff.school_id AND staff.is_active = true
        WHERE s.id = $1
      `, [schoolId]);

      const schoolStats = schoolStatsResult.rows[0];
      const currentStudents = parseInt(schoolStats.student_count) || 0;
      const currentStaff = parseInt(schoolStats.staff_count) || 0;

      // Calculate pricing
      const baseCost = plan.base_price || 0;
      const studentCost = (plan.price_per_student || 0) * currentStudents;
      const monthlyCost = customPricing ? customPricing.monthly : baseCost + studentCost;
      const yearlyCost = customPricing ? customPricing.yearly : monthlyCost * 12;

      // Apply discount if any
      const discountedMonthlyCost = monthlyCost * (1 - discountPercentage / 100);
      const discountedYearlyCost = yearlyCost * (1 - discountPercentage / 100);

      // Calculate next billing date
      const nextBillingDate = SubscriptionController.calculateNextBillingDate(startDate, billingCycle);

      const result = await query(`
        INSERT INTO school_subscriptions (
          school_id, plan_id, subscription_status, billing_cycle, start_date, end_date,
          trial_end_date, current_students, current_staff, monthly_cost, yearly_cost,
          auto_renew, payment_method, billing_contact_email, billing_address,
          tax_exempt, tax_rate, discount_percentage, custom_pricing, next_billing_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
        RETURNING *
      `, [
        schoolId, planId, trialEndDate ? 'trial' : 'active', billingCycle, startDate, endDate,
        trialEndDate, currentStudents, currentStaff, discountedMonthlyCost, discountedYearlyCost,
        autoRenew, paymentMethod, billingContactEmail, billingAddress,
        taxExempt, taxRate, discountPercentage, customPricing ? JSON.stringify(customPricing) : null,
        nextBillingDate
      ]);

      res.status(201).json({
        success: true,
        message: 'School subscription created successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  // Get school subscriptions
  static async getSchoolSubscriptions(req, res, next) {
    try {
      const { 
        schoolId, 
        status, 
        planType, 
        billingCycle,
        expiringWithinDays,
        limit = 20, 
        offset = 0 
      } = req.query;

      let whereClause = 'WHERE 1=1';
      const params = [];

      if (schoolId) {
        whereClause += ` AND ss.school_id = $${params.length + 1}`;
        params.push(schoolId);
      }

      if (status) {
        whereClause += ` AND ss.subscription_status = $${params.length + 1}`;
        params.push(status);
      }

      if (planType) {
        whereClause += ` AND sp.plan_type = $${params.length + 1}`;
        params.push(planType);
      }

      if (billingCycle) {
        whereClause += ` AND ss.billing_cycle = $${params.length + 1}`;
        params.push(billingCycle);
      }

      if (expiringWithinDays) {
        whereClause += ` AND ss.end_date <= CURRENT_DATE + INTERVAL '${parseInt(expiringWithinDays)} days'`;
      }

      const result = await query(`
        SELECT 
          ss.*,
          s.name as school_name,
          s.code as school_code,
          sp.plan_name,
          sp.plan_type,
          CASE 
            WHEN ss.end_date < CURRENT_DATE THEN 'expired'
            WHEN ss.trial_end_date < CURRENT_DATE AND ss.subscription_status = 'trial' THEN 'trial_expired'
            ELSE ss.subscription_status
          END as computed_status
        FROM school_subscriptions ss
        JOIN schools s ON ss.school_id = s.id
        JOIN subscription_plans sp ON ss.plan_id = sp.id
        ${whereClause}
        ORDER BY ss.created_at DESC
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

  // Update subscription status
  static async updateSubscriptionStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { status, reason } = req.body;

      if (!status) {
        throw new ValidationError('Status is required');
      }

      const validStatuses = ['trial', 'active', 'suspended', 'cancelled', 'expired'];
      if (!validStatuses.includes(status)) {
        throw new ValidationError(`Status must be one of: ${validStatuses.join(', ')}`);
      }

      const updateFields = {
        subscription_status: status,
        updated_at: 'CURRENT_TIMESTAMP'
      };

      if (status === 'cancelled') {
        updateFields.cancelled_at = 'CURRENT_TIMESTAMP';
        updateFields.cancelled_by = req.user.userId;
        updateFields.cancellation_reason = reason;
      }

      const setClause = Object.keys(updateFields).map((key, index) => {
        return key === 'updated_at' || key === 'cancelled_at' 
          ? `${key} = CURRENT_TIMESTAMP`
          : `${key} = $${index + 1}`;
      });

      const values = Object.values(updateFields).filter(value => 
        value !== 'CURRENT_TIMESTAMP'
      );
      values.push(id);

      const result = await query(`
        UPDATE school_subscriptions 
        SET ${setClause.join(', ')}
        WHERE id = $${values.length}
        RETURNING *
      `, values);

      if (result.rows.length === 0) {
        throw new NotFoundError('Subscription not found');
      }

      res.json({
        success: true,
        message: 'Subscription status updated successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // SUBSCRIPTION INVOICING
  // =============================================================================

  // Generate subscription invoice
  static async generateSubscriptionInvoice(req, res, next) {
    try {
      const { subscriptionId } = req.params;
      const { billingPeriodStart, billingPeriodEnd, forceRegenerate = false } = req.body;

      // Get subscription details
      const subscriptionResult = await query(`
        SELECT 
          ss.*,
          s.name as school_name,
          s.email as school_email,
          sp.plan_name
        FROM school_subscriptions ss
        JOIN schools s ON ss.school_id = s.id
        JOIN subscription_plans sp ON ss.plan_id = sp.id
        WHERE ss.id = $1
      `, [subscriptionId]);

      if (subscriptionResult.rows.length === 0) {
        throw new NotFoundError('Subscription not found');
      }

      const subscription = subscriptionResult.rows[0];

      // Check if invoice already exists for this period
      if (!forceRegenerate) {
        const existingInvoice = await query(`
          SELECT id FROM subscription_invoices 
          WHERE subscription_id = $1 
            AND billing_period_start = $2 
            AND billing_period_end = $3
        `, [subscriptionId, billingPeriodStart, billingPeriodEnd]);

        if (existingInvoice.rows.length > 0) {
          throw new ConflictError('Invoice already exists for this billing period');
        }
      }

      // Generate invoice number
      const invoiceCount = await query(`
        SELECT COUNT(*) as count FROM subscription_invoices 
        WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE)
      `);
      
      const currentYear = new Date().getFullYear();
      const sequence = parseInt(invoiceCount.rows[0].count) + 1;
      const invoiceNumber = `SUB-${currentYear}-${sequence.toString().padStart(6, '0')}`;

      // Calculate invoice amounts
      const baseAmount = subscription.monthly_cost || 0;
      const studentCharges = subscription.current_students * (subscription.price_per_student || 0);
      const subtotal = baseAmount + studentCharges;
      const taxAmount = subtotal * (subscription.tax_rate || 0);
      const totalAmount = subtotal + taxAmount;

      // Create invoice
      const result = await query(`
        INSERT INTO subscription_invoices (
          school_id, subscription_id, invoice_number, invoice_date, due_date,
          billing_period_start, billing_period_end, student_count, staff_count,
          base_amount, student_charges, tax_amount, total_amount, balance_due
        ) VALUES ($1, $2, $3, CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `, [
        subscription.school_id, subscriptionId, invoiceNumber, billingPeriodStart,
        billingPeriodEnd, subscription.current_students, subscription.current_staff,
        baseAmount, studentCharges, taxAmount, totalAmount, totalAmount
      ]);

      // Update subscription's last billing date
      await query(`
        UPDATE school_subscriptions 
        SET last_billing_date = CURRENT_DATE,
            next_billing_date = CURRENT_DATE + INTERVAL '1 month'
        WHERE id = $1
      `, [subscriptionId]);

      res.status(201).json({
        success: true,
        message: 'Subscription invoice generated successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  // Get subscription invoices
  static async getSubscriptionInvoices(req, res, next) {
    try {
      const { 
        schoolId, 
        subscriptionId, 
        status, 
        startDate, 
        endDate,
        overdue,
        limit = 20, 
        offset = 0 
      } = req.query;

      let whereClause = 'WHERE 1=1';
      const params = [];

      if (schoolId) {
        whereClause += ` AND si.school_id = $${params.length + 1}`;
        params.push(schoolId);
      }

      if (subscriptionId) {
        whereClause += ` AND si.subscription_id = $${params.length + 1}`;
        params.push(subscriptionId);
      }

      if (status) {
        whereClause += ` AND si.status = $${params.length + 1}`;
        params.push(status);
      }

      if (startDate) {
        whereClause += ` AND si.invoice_date >= $${params.length + 1}`;
        params.push(startDate);
      }

      if (endDate) {
        whereClause += ` AND si.invoice_date <= $${params.length + 1}`;
        params.push(endDate);
      }

      if (overdue === 'true') {
        whereClause += ` AND si.due_date < CURRENT_DATE AND si.status != 'paid'`;
      }

      const result = await query(`
        SELECT 
          si.*,
          s.name as school_name,
          sp.plan_name,
          CASE 
            WHEN si.due_date < CURRENT_DATE AND si.status != 'paid' THEN 'overdue'
            ELSE si.status
          END as computed_status
        FROM subscription_invoices si
        JOIN schools s ON si.school_id = s.id
        JOIN school_subscriptions ss ON si.subscription_id = ss.id
        JOIN subscription_plans sp ON ss.plan_id = sp.id
        ${whereClause}
        ORDER BY si.invoice_date DESC
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

  // Mark invoice as paid
  static async markInvoiceAsPaid(req, res, next) {
    try {
      const { id } = req.params;
      const { paymentAmount, paymentMethod, transactionId, paymentDate } = req.body;

      if (!paymentAmount) {
        throw new ValidationError('Payment amount is required');
      }

      const result = await query(`
        UPDATE subscription_invoices 
        SET status = 'paid',
            amount_paid = $1,
            balance_due = total_amount - $1,
            paid_at = $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
        RETURNING *
      `, [paymentAmount, paymentDate || new Date(), id]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Invoice not found');
      }

      res.json({
        success: true,
        message: 'Invoice marked as paid successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // SUBSCRIPTION ANALYTICS
  // =============================================================================

  // Get subscription analytics
  static async getSubscriptionAnalytics(req, res, next) {
    try {
      const { startDate, endDate, planType, billingCycle } = req.query;

      let dateFilter = '';
      let planFilter = '';
      let billingFilter = '';
      const params = [];

      if (startDate && endDate) {
        dateFilter = ` AND ss.created_at BETWEEN $${params.length + 1} AND $${params.length + 2}`;
        params.push(startDate, endDate);
      }

      if (planType) {
        planFilter = ` AND sp.plan_type = $${params.length + 1}`;
        params.push(planType);
      }

      if (billingCycle) {
        billingFilter = ` AND ss.billing_cycle = $${params.length + 1}`;
        params.push(billingCycle);
      }

      const [overviewResult, revenueResult, churnResult, planDistributionResult] = await Promise.all([
        // Overview metrics
        query(`
          SELECT 
            COUNT(*) as total_subscriptions,
            COUNT(CASE WHEN ss.subscription_status = 'active' THEN 1 END) as active_subscriptions,
            COUNT(CASE WHEN ss.subscription_status = 'trial' THEN 1 END) as trial_subscriptions,
            COUNT(CASE WHEN ss.subscription_status = 'cancelled' THEN 1 END) as cancelled_subscriptions,
            AVG(ss.monthly_cost) as avg_monthly_cost,
            SUM(CASE WHEN ss.subscription_status = 'active' THEN ss.monthly_cost ELSE 0 END) as monthly_recurring_revenue
          FROM school_subscriptions ss
          JOIN subscription_plans sp ON ss.plan_id = sp.id
          WHERE 1=1 ${dateFilter} ${planFilter} ${billingFilter}
        `, params),

        // Revenue trends
        query(`
          SELECT 
            DATE_TRUNC('month', si.invoice_date) as month,
            SUM(si.total_amount) as revenue,
            COUNT(si.id) as invoices_count,
            SUM(si.amount_paid) as collected_revenue
          FROM subscription_invoices si
          JOIN school_subscriptions ss ON si.subscription_id = ss.id
          JOIN subscription_plans sp ON ss.plan_id = sp.id
          WHERE si.invoice_date >= CURRENT_DATE - INTERVAL '12 months'
            ${planFilter} ${billingFilter}
          GROUP BY DATE_TRUNC('month', si.invoice_date)
          ORDER BY month DESC
        `, planType || billingCycle ? [planType, billingCycle].filter(Boolean) : []),

        // Churn analysis
        query(`
          SELECT 
            DATE_TRUNC('month', ss.cancelled_at) as month,
            COUNT(*) as churned_subscriptions,
            AVG(ss.monthly_cost) as avg_churned_value
          FROM school_subscriptions ss
          WHERE ss.cancelled_at IS NOT NULL
            AND ss.cancelled_at >= CURRENT_DATE - INTERVAL '12 months'
          GROUP BY DATE_TRUNC('month', ss.cancelled_at)
          ORDER BY month DESC
        `),

        // Plan distribution
        query(`
          SELECT 
            sp.plan_name,
            sp.plan_type,
            COUNT(ss.id) as subscription_count,
            SUM(CASE WHEN ss.subscription_status = 'active' THEN ss.monthly_cost ELSE 0 END) as total_revenue
          FROM subscription_plans sp
          LEFT JOIN school_subscriptions ss ON sp.id = ss.plan_id
          GROUP BY sp.id, sp.plan_name, sp.plan_type
          ORDER BY subscription_count DESC
        `)
      ]);

      const analytics = {
        overview: overviewResult.rows[0],
        revenuetrends: revenueResult.rows,
        churnAnalysis: churnResult.rows,
        planDistribution: planDistributionResult.rows
      };

      res.json({
        success: true,
        data: analytics
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // HELPER METHODS
  // =============================================================================

  // Calculate next billing date
  static calculateNextBillingDate(startDate, billingCycle) {
    const date = new Date(startDate);
    
    switch (billingCycle) {
      case 'monthly':
        date.setMonth(date.getMonth() + 1);
        break;
      case 'quarterly':
        date.setMonth(date.getMonth() + 3);
        break;
      case 'yearly':
        date.setFullYear(date.getFullYear() + 1);
        break;
      default:
        date.setMonth(date.getMonth() + 1);
    }
    
    return date.toISOString().split('T')[0];
  }

  // Bulk operations for subscription management
  static async bulkUpdateSubscriptions(req, res, next) {
    try {
      const { subscriptionIds, updates } = req.body;

      if (!subscriptionIds || !Array.isArray(subscriptionIds) || subscriptionIds.length === 0) {
        throw new ValidationError('Subscription IDs array is required');
      }

      const allowedFields = ['subscription_status', 'auto_renew', 'discount_percentage'];
      const updateFields = {};

      Object.keys(updates).forEach(key => {
        if (allowedFields.includes(key)) {
          updateFields[key] = updates[key];
        }
      });

      if (Object.keys(updateFields).length === 0) {
        throw new ValidationError('No valid fields provided for update');
      }

      const results = [];
      const errors = [];

      for (const subscriptionId of subscriptionIds) {
        try {
          const setClause = Object.keys(updateFields)
            .map((key, index) => `${key} = $${index + 1}`)
            .join(', ');
          
          const values = [...Object.values(updateFields), subscriptionId];

          const result = await query(`
            UPDATE school_subscriptions 
            SET ${setClause}, updated_at = CURRENT_TIMESTAMP
            WHERE id = $${values.length}
            RETURNING id, school_id, subscription_status
          `, values);

          if (result.rows.length > 0) {
            results.push(result.rows[0]);
          } else {
            errors.push({ subscriptionId, error: 'Subscription not found' });
          }
        } catch (error) {
          errors.push({ subscriptionId, error: error.message });
        }
      }

      res.json({
        success: true,
        message: 'Bulk subscription update completed',
        data: {
          updated: results,
          errors: errors,
          totalProcessed: subscriptionIds.length,
          successCount: results.length,
          errorCount: errors.length
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Get single subscription plan
  static async getSubscriptionPlan(req, res, next) {
    try {
      const { id } = req.params;

      const result = await query(`
        SELECT 
          sp.*,
          COUNT(ss.id) as active_subscriptions,
          SUM(CASE WHEN ss.subscription_status = 'active' THEN ss.monthly_cost ELSE 0 END) as monthly_revenue
        FROM subscription_plans sp
        LEFT JOIN school_subscriptions ss ON sp.id = ss.plan_id AND ss.subscription_status = 'active'
        WHERE sp.id = $1
        GROUP BY sp.id
      `, [id]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Subscription plan not found');
      }

      res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  // Deactivate subscription plan
  static async deactivateSubscriptionPlan(req, res, next) {
    try {
      const { id } = req.params;

      const result = await query(`
        UPDATE subscription_plans 
        SET is_active = false, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `, [id]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Subscription plan not found');
      }

      res.json({
        success: true,
        message: 'Subscription plan deactivated successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  // Get single school subscription
  static async getSchoolSubscription(req, res, next) {
    try {
      const { id } = req.params;

      const result = await query(`
        SELECT 
          ss.*,
          s.name as school_name,
          s.code as school_code,
          sp.plan_name,
          sp.plan_type,
          CASE 
            WHEN ss.end_date < CURRENT_DATE THEN 'expired'
            WHEN ss.trial_end_date < CURRENT_DATE AND ss.subscription_status = 'trial' THEN 'trial_expired'
            ELSE ss.subscription_status
          END as computed_status
        FROM school_subscriptions ss
        JOIN schools s ON ss.school_id = s.id
        JOIN subscription_plans sp ON ss.plan_id = sp.id
        WHERE ss.id = $1
      `, [id]);

      if (result.rows.length === 0) {
        throw new NotFoundError('School subscription not found');
      }

      res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  // Update school subscription
  static async updateSchoolSubscription(req, res, next) {
    try {
      const { id } = req.params;
      const updates = req.body;

      const allowedFields = [
        'billing_cycle', 'auto_renew', 'payment_method', 'billing_contact_email',
        'billing_address', 'tax_exempt', 'tax_rate', 'discount_percentage'
      ];

      const setClause = [];
      const values = [];
      let paramIndex = 1;

      Object.keys(updates).forEach(key => {
        if (allowedFields.includes(key)) {
          setClause.push(`${key} = $${paramIndex}`);
          values.push(updates[key]);
          paramIndex++;
        }
      });

      if (setClause.length === 0) {
        throw new ValidationError('No valid fields provided for update');
      }

      setClause.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(id);

      const result = await query(`
        UPDATE school_subscriptions 
        SET ${setClause.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `, values);

      if (result.rows.length === 0) {
        throw new NotFoundError('School subscription not found');
      }

      res.json({
        success: true,
        message: 'School subscription updated successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  // Suspend subscription
  static async suspendSubscription(req, res, next) {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const result = await query(`
        UPDATE school_subscriptions 
        SET subscription_status = 'suspended',
            suspended_at = CURRENT_TIMESTAMP,
            suspension_reason = $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
      `, [reason, id]);

      if (result.rows.length === 0) {
        throw new NotFoundError('School subscription not found');
      }

      res.json({
        success: true,
        message: 'Subscription suspended successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  // Reactivate subscription
  static async reactivateSubscription(req, res, next) {
    try {
      const { id } = req.params;

      const result = await query(`
        UPDATE school_subscriptions 
        SET subscription_status = 'active',
            suspended_at = NULL,
            suspension_reason = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `, [id]);

      if (result.rows.length === 0) {
        throw new NotFoundError('School subscription not found');
      }

      res.json({
        success: true,
        message: 'Subscription reactivated successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  // Cancel subscription
  static async cancelSubscription(req, res, next) {
    try {
      const { id } = req.params;
      const { reason, cancelImmediately = false } = req.body;

      const updateFields = {
        subscription_status: cancelImmediately ? 'cancelled' : 'pending_cancellation',
        cancelled_at: 'CURRENT_TIMESTAMP',
        cancelled_by: req.user.userId,
        cancellation_reason: reason,
        updated_at: 'CURRENT_TIMESTAMP'
      };

      const result = await query(`
        UPDATE school_subscriptions 
        SET subscription_status = $1,
            cancelled_at = CURRENT_TIMESTAMP,
            cancelled_by = $2,
            cancellation_reason = $3,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
        RETURNING *
      `, [updateFields.subscription_status, updateFields.cancelled_by, reason, id]);

      if (result.rows.length === 0) {
        throw new NotFoundError('School subscription not found');
      }

      res.json({
        success: true,
        message: 'Subscription cancelled successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  // Placeholder methods for routes that are called but not immediately critical
  static async upgradeSubscription(req, res, next) {
    res.status(501).json({ success: false, message: 'Upgrade subscription feature not implemented yet' });
  }

  static async downgradeSubscription(req, res, next) {
    res.status(501).json({ success: false, message: 'Downgrade subscription feature not implemented yet' });
  }

  static async generateInvoices(req, res, next) {
    res.status(501).json({ success: false, message: 'Generate invoices feature not implemented yet' });
  }

  static async getSubscriptionInvoice(req, res, next) {
    res.status(501).json({ success: false, message: 'Get subscription invoice feature not implemented yet' });
  }

  static async sendInvoice(req, res, next) {
    res.status(501).json({ success: false, message: 'Send invoice feature not implemented yet' });
  }

  static async recordPayment(req, res, next) {
    res.status(501).json({ success: false, message: 'Record payment feature not implemented yet' });
  }

  static async voidInvoice(req, res, next) {
    res.status(501).json({ success: false, message: 'Void invoice feature not implemented yet' });
  }

  static async getPaymentHistory(req, res, next) {
    res.status(501).json({ success: false, message: 'Get payment history feature not implemented yet' });
  }

  static async processBulkPayments(req, res, next) {
    res.status(501).json({ success: false, message: 'Process bulk payments feature not implemented yet' });
  }

  static async processRefund(req, res, next) {
    res.status(501).json({ success: false, message: 'Process refund feature not implemented yet' });
  }

  static async getRevenueAnalytics(req, res, next) {
    res.status(501).json({ success: false, message: 'Revenue analytics feature not implemented yet' });
  }

  static async getChurnAnalytics(req, res, next) {
    res.status(501).json({ success: false, message: 'Churn analytics feature not implemented yet' });
  }

  static async getGrowthAnalytics(req, res, next) {
    res.status(501).json({ success: false, message: 'Growth analytics feature not implemented yet' });
  }

  static async getSubscriptionSummary(req, res, next) {
    res.status(501).json({ success: false, message: 'Subscription summary feature not implemented yet' });
  }

  static async exportSubscriptionData(req, res, next) {
    res.status(501).json({ success: false, message: 'Export subscription data feature not implemented yet' });
  }

  static async bulkCreateSubscriptions(req, res, next) {
    res.status(501).json({ success: false, message: 'Bulk create subscriptions feature not implemented yet' });
  }

  static async bulkSuspendSubscriptions(req, res, next) {
    res.status(501).json({ success: false, message: 'Bulk suspend subscriptions feature not implemented yet' });
  }
}

module.exports = SubscriptionController;