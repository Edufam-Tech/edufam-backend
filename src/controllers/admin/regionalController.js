const { query } = require('../../config/database');
const { ValidationError, NotFoundError, ConflictError } = require('../../middleware/errorHandler');

class RegionalController {
  // =============================================================================
  // REGION MANAGEMENT
  // =============================================================================

  // Get all regions
  static async getRegions(req, res, next) {
    try {
      const { 
        country, 
        isActive,
        search,
        limit = 20, 
        offset = 0 
      } = req.query;

      let whereClause = 'WHERE 1=1';
      const params = [];

      if (country) {
        whereClause += ` AND pr.country = $${params.length + 1}`;
        params.push(country);
      }

      if (isActive !== undefined) {
        whereClause += ` AND pr.is_active = $${params.length + 1}`;
        params.push(isActive === 'true');
      }

      if (search) {
        whereClause += ` AND (pr.region_name ILIKE $${params.length + 1} OR pr.country ILIKE $${params.length + 1})`;
        params.push(`%${search}%`);
      }

      const result = await query(`
        SELECT 
          pr.*,
          COUNT(DISTINCT sor.id) as onboarding_requests_count,
          COUNT(DISTINCT s.id) as active_schools_count,
          COUNT(DISTINCT u.id) as total_users_count,
          COALESCE(SUM(si.total_amount), 0) as total_revenue,
          AVG(rp.performance_score) as avg_performance_score
        FROM platform_regions pr
        LEFT JOIN school_onboarding_requests sor ON pr.id = sor.region_id
        LEFT JOIN schools s ON sor.principal_email = s.email AND s.is_active = true
        LEFT JOIN users u ON s.id = u.school_id AND u.is_active = true
        LEFT JOIN subscription_invoices si ON s.id = si.school_id
        LEFT JOIN regional_performance rp ON pr.id = rp.region_id 
          AND rp.performance_date >= CURRENT_DATE - INTERVAL '30 days'
        ${whereClause}
        GROUP BY pr.id
        ORDER BY pr.region_name
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

  // Create new region
  static async createRegion(req, res, next) {
    try {
      const {
        regionName,
        country,
        currency,
        timezone,
        language,
        description,
        settings = {},
        coordinates
      } = req.body;

      if (!regionName || !country || !currency) {
        throw new ValidationError('Region name, country, and currency are required');
      }

      // Check if region already exists
      const existing = await query(`
        SELECT id FROM platform_regions 
        WHERE region_name = $1 AND country = $2
      `, [regionName, country]);

      if (existing.rows.length > 0) {
        throw new ConflictError('Region already exists in this country');
      }

      const result = await query(`
        INSERT INTO platform_regions (
          region_name, country, currency, timezone, language,
          description, settings, coordinates, created_by, created_by_name
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `, [
        regionName, country, currency, timezone, language,
        description, JSON.stringify(settings), coordinates,
        req.user.userId, `${req.user.firstName} ${req.user.lastName}`
      ]);

      res.status(201).json({
        success: true,
        message: 'Region created successfully',
        data: {
          ...result.rows[0],
          settings: JSON.parse(result.rows[0].settings || '{}')
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Get region details
  static async getRegion(req, res, next) {
    try {
      const { id } = req.params;

      const [regionResult, schoolsResult, performanceResult, districtsResult] = await Promise.all([
        // Region details
        query(`
          SELECT 
            pr.*,
            COUNT(DISTINCT sor.id) as onboarding_requests_count,
            COUNT(DISTINCT s.id) as active_schools_count,
            COUNT(DISTINCT u.id) as total_users_count,
            COALESCE(SUM(si.total_amount), 0) as total_revenue
          FROM platform_regions pr
          LEFT JOIN school_onboarding_requests sor ON pr.id = sor.region_id
          LEFT JOIN schools s ON sor.principal_email = s.email
          LEFT JOIN users u ON s.id = u.school_id
          LEFT JOIN subscription_invoices si ON s.id = si.school_id
          WHERE pr.id = $1
          GROUP BY pr.id
        `, [id]),

        // Schools in region
        query(`
          SELECT 
            s.id, s.name, s.school_type, s.is_active, s.created_at,
            ss.subscription_status, sp.plan_name,
            COUNT(DISTINCT u.id) as user_count
          FROM schools s
          JOIN school_onboarding_requests sor ON s.email = sor.principal_email
          JOIN school_subscriptions ss ON s.id = ss.school_id
          JOIN subscription_plans sp ON ss.plan_id = sp.id
          LEFT JOIN users u ON s.id = u.school_id AND u.is_active = true
          WHERE sor.region_id = $1
          GROUP BY s.id, ss.subscription_status, sp.plan_name
          ORDER BY s.name
        `, [id]),

        // Performance metrics
        query(`
          SELECT *
          FROM regional_performance
          WHERE region_id = $1
          ORDER BY performance_date DESC
          LIMIT 12
        `, [id]),

        // Districts in region
        query(`
          SELECT 
            d.*,
            COUNT(DISTINCT s.id) as schools_count
          FROM districts d
          LEFT JOIN schools s ON d.id = s.district_id AND s.is_active = true
          WHERE d.region_id = $1
          GROUP BY d.id
          ORDER BY d.district_name
        `, [id])
      ]);

      if (regionResult.rows.length === 0) {
        throw new NotFoundError('Region not found');
      }

      const region = {
        ...regionResult.rows[0],
        settings: JSON.parse(regionResult.rows[0].settings || '{}'),
        schools: schoolsResult.rows,
        performance: performanceResult.rows,
        districts: districtsResult.rows
      };

      res.json({
        success: true,
        data: region
      });
    } catch (error) {
      next(error);
    }
  }

  // Update region
  static async updateRegion(req, res, next) {
    try {
      const { id } = req.params;
      const updates = req.body;

      const allowedFields = [
        'region_name', 'country', 'currency', 'timezone', 'language',
        'description', 'settings', 'coordinates', 'is_active'
      ];

      const setClause = [];
      const values = [];
      let paramIndex = 1;

      Object.keys(updates).forEach(key => {
        if (allowedFields.includes(key)) {
          if (key === 'settings') {
            setClause.push(`settings = $${paramIndex}`);
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
      setClause.push(`updated_by = $${paramIndex}`);
      setClause.push(`updated_by_name = $${paramIndex + 1}`);
      values.push(req.user.userId, `${req.user.firstName} ${req.user.lastName}`, id);

      const result = await query(`
        UPDATE platform_regions 
        SET ${setClause.join(', ')}
        WHERE id = $${paramIndex + 2}
        RETURNING *
      `, values);

      if (result.rows.length === 0) {
        throw new NotFoundError('Region not found');
      }

      res.json({
        success: true,
        message: 'Region updated successfully',
        data: {
          ...result.rows[0],
          settings: JSON.parse(result.rows[0].settings || '{}')
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // DISTRICT MANAGEMENT
  // =============================================================================

  // Get districts
  static async getDistricts(req, res, next) {
    try {
      const { 
        regionId,
        isActive,
        search,
        limit = 20, 
        offset = 0 
      } = req.query;

      let whereClause = 'WHERE 1=1';
      const params = [];

      if (regionId) {
        whereClause += ` AND d.region_id = $${params.length + 1}`;
        params.push(regionId);
      }

      if (isActive !== undefined) {
        whereClause += ` AND d.is_active = $${params.length + 1}`;
        params.push(isActive === 'true');
      }

      if (search) {
        whereClause += ` AND (d.district_name ILIKE $${params.length + 1} OR d.district_code ILIKE $${params.length + 1})`;
        params.push(`%${search}%`);
      }

      const result = await query(`
        SELECT 
          d.*,
          pr.region_name,
          pr.country,
          COUNT(DISTINCT s.id) as schools_count,
          COUNT(DISTINCT u.id) as users_count
        FROM districts d
        JOIN platform_regions pr ON d.region_id = pr.id
        LEFT JOIN schools s ON d.id = s.district_id AND s.is_active = true
        LEFT JOIN users u ON s.id = u.school_id AND u.is_active = true
        ${whereClause}
        GROUP BY d.id, pr.region_name, pr.country
        ORDER BY d.district_name
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

  // Create district
  static async createDistrict(req, res, next) {
    try {
      const {
        regionId,
        districtName,
        districtCode,
        description,
        coordinates,
        population,
        area,
        settings = {}
      } = req.body;

      if (!regionId || !districtName || !districtCode) {
        throw new ValidationError('Region ID, district name, and district code are required');
      }

      // Verify region exists
      const region = await query(`
        SELECT id FROM platform_regions WHERE id = $1
      `, [regionId]);

      if (region.rows.length === 0) {
        throw new NotFoundError('Region not found');
      }

      // Check if district code already exists in region
      const existing = await query(`
        SELECT id FROM districts 
        WHERE district_code = $1 AND region_id = $2
      `, [districtCode, regionId]);

      if (existing.rows.length > 0) {
        throw new ConflictError('District code already exists in this region');
      }

      const result = await query(`
        INSERT INTO districts (
          region_id, district_name, district_code, description,
          coordinates, population, area, settings, created_by, created_by_name
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `, [
        regionId, districtName, districtCode, description,
        coordinates, population, area, JSON.stringify(settings),
        req.user.userId, `${req.user.firstName} ${req.user.lastName}`
      ]);

      res.status(201).json({
        success: true,
        message: 'District created successfully',
        data: {
          ...result.rows[0],
          settings: JSON.parse(result.rows[0].settings || '{}')
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Update district
  static async updateDistrict(req, res, next) {
    try {
      const { id } = req.params;
      const updates = req.body;

      const allowedFields = [
        'district_name', 'district_code', 'description', 'coordinates',
        'population', 'area', 'settings', 'is_active'
      ];

      const setClause = [];
      const values = [];
      let paramIndex = 1;

      Object.keys(updates).forEach(key => {
        if (allowedFields.includes(key)) {
          if (key === 'settings') {
            setClause.push(`settings = $${paramIndex}`);
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
      setClause.push(`updated_by = $${paramIndex}`);
      setClause.push(`updated_by_name = $${paramIndex + 1}`);
      values.push(req.user.userId, `${req.user.firstName} ${req.user.lastName}`, id);

      const result = await query(`
        UPDATE districts 
        SET ${setClause.join(', ')}
        WHERE id = $${paramIndex + 2}
        RETURNING *
      `, values);

      if (result.rows.length === 0) {
        throw new NotFoundError('District not found');
      }

      res.json({
        success: true,
        message: 'District updated successfully',
        data: {
          ...result.rows[0],
          settings: JSON.parse(result.rows[0].settings || '{}')
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // ZONE MANAGEMENT
  // =============================================================================

  // Get zones
  static async getZones(req, res, next) {
    try {
      const { 
        districtId,
        regionId,
        isActive,
        search,
        limit = 20, 
        offset = 0 
      } = req.query;

      let whereClause = 'WHERE 1=1';
      const params = [];

      if (districtId) {
        whereClause += ` AND z.district_id = $${params.length + 1}`;
        params.push(districtId);
      }

      if (regionId) {
        whereClause += ` AND d.region_id = $${params.length + 1}`;
        params.push(regionId);
      }

      if (isActive !== undefined) {
        whereClause += ` AND z.is_active = $${params.length + 1}`;
        params.push(isActive === 'true');
      }

      if (search) {
        whereClause += ` AND (z.zone_name ILIKE $${params.length + 1} OR z.zone_code ILIKE $${params.length + 1})`;
        params.push(`%${search}%`);
      }

      const result = await query(`
        SELECT 
          z.*,
          d.district_name,
          d.district_code,
          pr.region_name,
          pr.country,
          COUNT(DISTINCT s.id) as schools_count,
          COUNT(DISTINCT u.id) as users_count
        FROM zones z
        JOIN districts d ON z.district_id = d.id
        JOIN platform_regions pr ON d.region_id = pr.id
        LEFT JOIN schools s ON z.id = s.zone_id AND s.is_active = true
        LEFT JOIN users u ON s.id = u.school_id AND u.is_active = true
        ${whereClause}
        GROUP BY z.id, d.district_name, d.district_code, pr.region_name, pr.country
        ORDER BY z.zone_name
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

  // Create zone
  static async createZone(req, res, next) {
    try {
      const {
        districtId,
        zoneName,
        zoneCode,
        description,
        coordinates,
        population,
        area,
        settings = {}
      } = req.body;

      if (!districtId || !zoneName || !zoneCode) {
        throw new ValidationError('District ID, zone name, and zone code are required');
      }

      // Verify district exists
      const district = await query(`
        SELECT id FROM districts WHERE id = $1
      `, [districtId]);

      if (district.rows.length === 0) {
        throw new NotFoundError('District not found');
      }

      // Check if zone code already exists in district
      const existing = await query(`
        SELECT id FROM zones 
        WHERE zone_code = $1 AND district_id = $2
      `, [zoneCode, districtId]);

      if (existing.rows.length > 0) {
        throw new ConflictError('Zone code already exists in this district');
      }

      const result = await query(`
        INSERT INTO zones (
          district_id, zone_name, zone_code, description,
          coordinates, population, area, settings, created_by, created_by_name
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `, [
        districtId, zoneName, zoneCode, description,
        coordinates, population, area, JSON.stringify(settings),
        req.user.userId, `${req.user.firstName} ${req.user.lastName}`
      ]);

      res.status(201).json({
        success: true,
        message: 'Zone created successfully',
        data: {
          ...result.rows[0],
          settings: JSON.parse(result.rows[0].settings || '{}')
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Update zone
  static async updateZone(req, res, next) {
    try {
      const { id } = req.params;
      const updates = req.body;

      const allowedFields = [
        'zone_name', 'zone_code', 'description', 'coordinates',
        'population', 'area', 'settings', 'is_active'
      ];

      const setClause = [];
      const values = [];
      let paramIndex = 1;

      Object.keys(updates).forEach(key => {
        if (allowedFields.includes(key)) {
          if (key === 'settings') {
            setClause.push(`settings = $${paramIndex}`);
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
      setClause.push(`updated_by = $${paramIndex}`);
      setClause.push(`updated_by_name = $${paramIndex + 1}`);
      values.push(req.user.userId, `${req.user.firstName} ${req.user.lastName}`, id);

      const result = await query(`
        UPDATE zones 
        SET ${setClause.join(', ')}
        WHERE id = $${paramIndex + 2}
        RETURNING *
      `, values);

      if (result.rows.length === 0) {
        throw new NotFoundError('Zone not found');
      }

      res.json({
        success: true,
        message: 'Zone updated successfully',
        data: {
          ...result.rows[0],
          settings: JSON.parse(result.rows[0].settings || '{}')
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // REGIONAL PERFORMANCE TRACKING
  // =============================================================================

  // Record regional performance
  static async recordRegionalPerformance(req, res, next) {
    try {
      const { 
        regionId,
        performanceDate = new Date().toISOString().split('T')[0],
        performanceScore,
        metrics = {},
        notes
      } = req.body;

      if (!regionId || performanceScore === undefined) {
        throw new ValidationError('Region ID and performance score are required');
      }

      if (performanceScore < 0 || performanceScore > 100) {
        throw new ValidationError('Performance score must be between 0 and 100');
      }

      // Check if performance record already exists for this date
      const existing = await query(`
        SELECT id FROM regional_performance 
        WHERE region_id = $1 AND performance_date = $2
      `, [regionId, performanceDate]);

      let result;

      if (existing.rows.length > 0) {
        // Update existing record
        result = await query(`
          UPDATE regional_performance 
          SET performance_score = $1,
              metrics = $2,
              notes = $3,
              updated_at = CURRENT_TIMESTAMP,
              updated_by = $4,
              updated_by_name = $5
          WHERE region_id = $6 AND performance_date = $7
          RETURNING *
        `, [
          performanceScore, JSON.stringify(metrics), notes,
          req.user.userId, `${req.user.firstName} ${req.user.lastName}`,
          regionId, performanceDate
        ]);
      } else {
        // Create new record
        result = await query(`
          INSERT INTO regional_performance (
            region_id, performance_date, performance_score, metrics, notes,
            created_by, created_by_name
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING *
        `, [
          regionId, performanceDate, performanceScore, JSON.stringify(metrics), notes,
          req.user.userId, `${req.user.firstName} ${req.user.lastName}`
        ]);
      }

      res.json({
        success: true,
        message: 'Regional performance recorded successfully',
        data: {
          ...result.rows[0],
          metrics: JSON.parse(result.rows[0].metrics || '{}')
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Get regional performance history
  static async getRegionalPerformance(req, res, next) {
    try {
      const { 
        regionId,
        startDate,
        endDate,
        limit = 30 
      } = req.query;

      let whereClause = 'WHERE 1=1';
      const params = [];

      if (regionId) {
        whereClause += ` AND rp.region_id = $${params.length + 1}`;
        params.push(regionId);
      }

      if (startDate) {
        whereClause += ` AND rp.performance_date >= $${params.length + 1}`;
        params.push(startDate);
      }

      if (endDate) {
        whereClause += ` AND rp.performance_date <= $${params.length + 1}`;
        params.push(endDate);
      }

      const result = await query(`
        SELECT 
          rp.*,
          pr.region_name,
          pr.country
        FROM regional_performance rp
        JOIN platform_regions pr ON rp.region_id = pr.id
        ${whereClause}
        ORDER BY rp.performance_date DESC
        LIMIT $${params.length + 1}
      `, [...params, limit]);

      const performance = result.rows.map(row => ({
        ...row,
        metrics: JSON.parse(row.metrics || '{}')
      }));

      res.json({
        success: true,
        data: performance
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================================
  // GEOGRAPHICAL HIERARCHY UTILITIES
  // =============================================================================

  // Get geographical hierarchy
  static async getGeographicalHierarchy(req, res, next) {
    try {
      const { includeInactive = false } = req.query;

      const activeFilter = includeInactive === 'true' ? '' : 'AND pr.is_active = true AND d.is_active = true AND z.is_active = true';

      const result = await query(`
        SELECT 
          pr.id as region_id,
          pr.region_name,
          pr.country,
          pr.currency,
          d.id as district_id,
          d.district_name,
          d.district_code,
          z.id as zone_id,
          z.zone_name,
          z.zone_code,
          COUNT(DISTINCT s.id) as schools_count
        FROM platform_regions pr
        LEFT JOIN districts d ON pr.id = d.region_id
        LEFT JOIN zones z ON d.id = z.district_id
        LEFT JOIN schools s ON z.id = s.zone_id AND s.is_active = true
        WHERE 1=1 ${activeFilter}
        GROUP BY pr.id, pr.region_name, pr.country, pr.currency, 
                 d.id, d.district_name, d.district_code,
                 z.id, z.zone_name, z.zone_code
        ORDER BY pr.region_name, d.district_name, z.zone_name
      `);

      // Structure the hierarchy
      const hierarchy = {};

      result.rows.forEach(row => {
        const regionKey = `${row.region_id}`;
        
        if (!hierarchy[regionKey]) {
          hierarchy[regionKey] = {
            region_id: row.region_id,
            region_name: row.region_name,
            country: row.country,
            currency: row.currency,
            districts: {}
          };
        }

        if (row.district_id) {
          const districtKey = `${row.district_id}`;
          
          if (!hierarchy[regionKey].districts[districtKey]) {
            hierarchy[regionKey].districts[districtKey] = {
              district_id: row.district_id,
              district_name: row.district_name,
              district_code: row.district_code,
              zones: {}
            };
          }

          if (row.zone_id) {
            const zoneKey = `${row.zone_id}`;
            
            hierarchy[regionKey].districts[districtKey].zones[zoneKey] = {
              zone_id: row.zone_id,
              zone_name: row.zone_name,
              zone_code: row.zone_code,
              schools_count: parseInt(row.schools_count) || 0
            };
          }
        }
      });

      // Convert to array format
      const hierarchyArray = Object.values(hierarchy).map(region => ({
        ...region,
        districts: Object.values(region.districts).map(district => ({
          ...district,
          zones: Object.values(district.zones)
        }))
      }));

      res.json({
        success: true,
        data: hierarchyArray
      });
    } catch (error) {
      next(error);
    }
  }

  // Get regional statistics
  static async getRegionalStatistics(req, res, next) {
    try {
      const [
        regionStats,
        districtStats,
        zoneStats,
        performanceStats
      ] = await Promise.all([
        // Region statistics
        query(`
          SELECT 
            COUNT(*) as total_regions,
            COUNT(CASE WHEN is_active = true THEN 1 END) as active_regions,
            COUNT(DISTINCT country) as countries_count
          FROM platform_regions
        `),

        // District statistics
        query(`
          SELECT 
            COUNT(*) as total_districts,
            COUNT(CASE WHEN is_active = true THEN 1 END) as active_districts,
            AVG(population) as avg_population,
            SUM(area) as total_area
          FROM districts
        `),

        // Zone statistics
        query(`
          SELECT 
            COUNT(*) as total_zones,
            COUNT(CASE WHEN is_active = true THEN 1 END) as active_zones,
            AVG(population) as avg_population,
            SUM(area) as total_area
          FROM zones
        `),

        // Performance statistics
        query(`
          SELECT 
            AVG(performance_score) as avg_performance_score,
            MIN(performance_score) as min_performance_score,
            MAX(performance_score) as max_performance_score,
            COUNT(*) as total_performance_records
          FROM regional_performance
          WHERE performance_date >= CURRENT_DATE - INTERVAL '30 days'
        `)
      ]);

      res.json({
        success: true,
        data: {
          regions: regionStats.rows[0],
          districts: districtStats.rows[0],
          zones: zoneStats.rows[0],
          performance: performanceStats.rows[0]
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = RegionalController;