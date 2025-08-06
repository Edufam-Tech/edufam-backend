const express = require('express');
const router = express.Router();
const { authenticate, requireRole, requireUserType } = require('../../middleware/auth');
const RegionalController = require('../../controllers/admin/regionalController');

// Apply admin authentication to all routes
router.use(authenticate);
router.use(requireUserType('platform_admin'));

// =============================================================================
// REGION MANAGEMENT ROUTES
// =============================================================================

/**
 * @route   GET /api/admin/regional/regions
 * @desc    Get all regions
 * @access  Private (Platform Admin)
 */
router.get('/regions',
  requireRole(['super_admin', 'regional_admin']),
  RegionalController.getRegions
);

/**
 * @route   POST /api/admin/regional/regions
 * @desc    Create new region
 * @access  Private (Super Admin)
 */
router.post('/regions',
  requireRole(['super_admin']),
  RegionalController.createRegion
);

/**
 * @route   GET /api/admin/regional/regions/:id
 * @desc    Get region details
 * @access  Private (Platform Admin)
 */
router.get('/regions/:id',
  requireRole(['super_admin', 'regional_admin']),
  RegionalController.getRegion
);

/**
 * @route   PUT /api/admin/regional/regions/:id
 * @desc    Update region
 * @access  Private (Super Admin, Regional Admin)
 */
router.put('/regions/:id',
  requireRole(['super_admin', 'regional_admin']),
  RegionalController.updateRegion
);

// =============================================================================
// DISTRICT MANAGEMENT ROUTES
// =============================================================================

/**
 * @route   GET /api/admin/regional/districts
 * @desc    Get districts
 * @access  Private (Platform Admin)
 */
router.get('/districts',
  requireRole(['super_admin', 'regional_admin']),
  RegionalController.getDistricts
);

/**
 * @route   POST /api/admin/regional/districts
 * @desc    Create new district
 * @access  Private (Super Admin, Regional Admin)
 */
router.post('/districts',
  requireRole(['super_admin', 'regional_admin']),
  RegionalController.createDistrict
);

/**
 * @route   PUT /api/admin/regional/districts/:id
 * @desc    Update district
 * @access  Private (Super Admin, Regional Admin)
 */
router.put('/districts/:id',
  requireRole(['super_admin', 'regional_admin']),
  RegionalController.updateDistrict
);

// =============================================================================
// ZONE MANAGEMENT ROUTES
// =============================================================================

/**
 * @route   GET /api/admin/regional/zones
 * @desc    Get zones
 * @access  Private (Platform Admin)
 */
router.get('/zones',
  requireRole(['super_admin', 'regional_admin']),
  RegionalController.getZones
);

/**
 * @route   POST /api/admin/regional/zones
 * @desc    Create new zone
 * @access  Private (Super Admin, Regional Admin)
 */
router.post('/zones',
  requireRole(['super_admin', 'regional_admin']),
  RegionalController.createZone
);

/**
 * @route   PUT /api/admin/regional/zones/:id
 * @desc    Update zone
 * @access  Private (Super Admin, Regional Admin)
 */
router.put('/zones/:id',
  requireRole(['super_admin', 'regional_admin']),
  RegionalController.updateZone
);

// =============================================================================
// REGIONAL PERFORMANCE ROUTES
// =============================================================================

/**
 * @route   POST /api/admin/regional/performance
 * @desc    Record regional performance
 * @access  Private (Super Admin, Regional Admin)
 */
router.post('/performance',
  requireRole(['super_admin', 'regional_admin']),
  RegionalController.recordRegionalPerformance
);

/**
 * @route   GET /api/admin/regional/performance
 * @desc    Get regional performance history
 * @access  Private (Platform Admin)
 */
router.get('/performance',
  requireRole(['super_admin', 'regional_admin']),
  RegionalController.getRegionalPerformance
);

/**
 * @route   GET /api/admin/regional/performance/regions/:regionId
 * @desc    Get specific region performance
 * @access  Private (Platform Admin)
 */
router.get('/performance/regions/:regionId',
  requireRole(['super_admin', 'regional_admin']),
  async (req, res, next) => {
    try {
      // Set regionId in query for filtering
      req.query.regionId = req.params.regionId;
      return RegionalController.getRegionalPerformance(req, res, next);
    } catch (error) {
      next(error);
    }
  }
);

// =============================================================================
// GEOGRAPHICAL HIERARCHY ROUTES
// =============================================================================

/**
 * @route   GET /api/admin/regional/hierarchy
 * @desc    Get geographical hierarchy
 * @access  Private (Platform Admin)
 */
router.get('/hierarchy',
  requireRole(['super_admin', 'regional_admin']),
  RegionalController.getGeographicalHierarchy
);

/**
 * @route   GET /api/admin/regional/statistics
 * @desc    Get regional statistics
 * @access  Private (Platform Admin)
 */
router.get('/statistics',
  requireRole(['super_admin', 'regional_admin']),
  RegionalController.getRegionalStatistics
);

// =============================================================================
// BULK OPERATIONS ROUTES
// =============================================================================

/**
 * @route   POST /api/admin/regional/regions/bulk-create
 * @desc    Bulk create regions
 * @access  Private (Super Admin)
 */
router.post('/regions/bulk-create',
  requireRole(['super_admin']),
  async (req, res, next) => {
    try {
      const { regions } = req.body;

      if (!regions || !Array.isArray(regions) || regions.length === 0) {
        throw new ValidationError('Regions array is required');
      }

      const results = [];
      const errors = [];

      for (let i = 0; i < regions.length; i++) {
        try {
          req.body = regions[i];
          const mockRes = {
            status: () => mockRes,
            json: (data) => {
              results.push({ index: i, success: true, data: data.data });
            }
          };

          await RegionalController.createRegion(req, mockRes, (error) => {
            if (error) throw error;
          });
        } catch (error) {
          errors.push({ index: i, region: regions[i], error: error.message });
        }
      }

      res.json({
        success: true,
        message: `Bulk operation completed. ${results.length} regions created, ${errors.length} errors`,
        data: {
          created: results,
          errors: errors,
          summary: {
            total: regions.length,
            successful: results.length,
            failed: errors.length
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   POST /api/admin/regional/districts/bulk-create
 * @desc    Bulk create districts
 * @access  Private (Super Admin, Regional Admin)
 */
router.post('/districts/bulk-create',
  requireRole(['super_admin', 'regional_admin']),
  async (req, res, next) => {
    try {
      const { districts } = req.body;

      if (!districts || !Array.isArray(districts) || districts.length === 0) {
        throw new ValidationError('Districts array is required');
      }

      const results = [];
      const errors = [];

      for (let i = 0; i < districts.length; i++) {
        try {
          req.body = districts[i];
          const mockRes = {
            status: () => mockRes,
            json: (data) => {
              results.push({ index: i, success: true, data: data.data });
            }
          };

          await RegionalController.createDistrict(req, mockRes, (error) => {
            if (error) throw error;
          });
        } catch (error) {
          errors.push({ index: i, district: districts[i], error: error.message });
        }
      }

      res.json({
        success: true,
        message: `Bulk operation completed. ${results.length} districts created, ${errors.length} errors`,
        data: {
          created: results,
          errors: errors,
          summary: {
            total: districts.length,
            successful: results.length,
            failed: errors.length
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   POST /api/admin/regional/zones/bulk-create
 * @desc    Bulk create zones
 * @access  Private (Super Admin, Regional Admin)
 */
router.post('/zones/bulk-create',
  requireRole(['super_admin', 'regional_admin']),
  async (req, res, next) => {
    try {
      const { zones } = req.body;

      if (!zones || !Array.isArray(zones) || zones.length === 0) {
        throw new ValidationError('Zones array is required');
      }

      const results = [];
      const errors = [];

      for (let i = 0; i < zones.length; i++) {
        try {
          req.body = zones[i];
          const mockRes = {
            status: () => mockRes,
            json: (data) => {
              results.push({ index: i, success: true, data: data.data });
            }
          };

          await RegionalController.createZone(req, mockRes, (error) => {
            if (error) throw error;
          });
        } catch (error) {
          errors.push({ index: i, zone: zones[i], error: error.message });
        }
      }

      res.json({
        success: true,
        message: `Bulk operation completed. ${results.length} zones created, ${errors.length} errors`,
        data: {
          created: results,
          errors: errors,
          summary: {
            total: zones.length,
            successful: results.length,
            failed: errors.length
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// =============================================================================
// ADVANCED QUERIES ROUTES
// =============================================================================

/**
 * @route   GET /api/admin/regional/search
 * @desc    Advanced geographical search
 * @access  Private (Platform Admin)
 */
router.get('/search',
  requireRole(['super_admin', 'regional_admin']),
  async (req, res, next) => {
    try {
      const { 
        query: searchQuery, 
        type = 'all', // 'regions', 'districts', 'zones', 'all'
        country,
        coordinates,
        radius = 50 // km radius for coordinate-based search
      } = req.query;

      let results = [];

      if (!searchQuery && !coordinates) {
        throw new ValidationError('Search query or coordinates are required');
      }

      // Text-based search
      if (searchQuery) {
        const searchPattern = `%${searchQuery}%`;
        
        if (type === 'all' || type === 'regions') {
          const regionResults = await query(`
            SELECT 'region' as type, id, region_name as name, country, coordinates
            FROM platform_regions
            WHERE (region_name ILIKE $1 OR country ILIKE $1)
              AND ($2::text IS NULL OR country = $2)
              AND is_active = true
          `, [searchPattern, country]);
          results.push(...regionResults.rows);
        }

        if (type === 'all' || type === 'districts') {
          const districtResults = await query(`
            SELECT 'district' as type, d.id, d.district_name as name, pr.country, d.coordinates,
                   d.district_code, pr.region_name
            FROM districts d
            JOIN platform_regions pr ON d.region_id = pr.id
            WHERE (d.district_name ILIKE $1 OR d.district_code ILIKE $1)
              AND ($2::text IS NULL OR pr.country = $2)
              AND d.is_active = true AND pr.is_active = true
          `, [searchPattern, country]);
          results.push(...districtResults.rows);
        }

        if (type === 'all' || type === 'zones') {
          const zoneResults = await query(`
            SELECT 'zone' as type, z.id, z.zone_name as name, pr.country, z.coordinates,
                   z.zone_code, d.district_name, pr.region_name
            FROM zones z
            JOIN districts d ON z.district_id = d.id
            JOIN platform_regions pr ON d.region_id = pr.id
            WHERE (z.zone_name ILIKE $1 OR z.zone_code ILIKE $1)
              AND ($2::text IS NULL OR pr.country = $2)
              AND z.is_active = true AND d.is_active = true AND pr.is_active = true
          `, [searchPattern, country]);
          results.push(...zoneResults.rows);
        }
      }

      // Coordinate-based search (simplified - in production would use PostGIS)
      if (coordinates) {
        const [lat, lng] = coordinates.split(',').map(Number);
        
        if (isNaN(lat) || isNaN(lng)) {
          throw new ValidationError('Invalid coordinates format. Use: lat,lng');
        }

        // Simplified distance calculation (in production, use proper geospatial queries)
        const coordinateResults = await query(`
          SELECT 'mixed' as type, 'coordinate_search' as name, 
                 'Coordinate-based search results' as description
        `);
        
        // This would be replaced with actual geospatial queries
        results.push(...coordinateResults.rows);
      }

      res.json({
        success: true,
        data: {
          query: searchQuery,
          coordinates: coordinates,
          type: type,
          results: results,
          total: results.length
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/admin/regional/map-data
 * @desc    Get geographical data for mapping
 * @access  Private (Platform Admin)
 */
router.get('/map-data',
  requireRole(['super_admin', 'regional_admin']),
  async (req, res, next) => {
    try {
      const { 
        regionId,
        includeSchools = false,
        bounds // "lat1,lng1,lat2,lng2" for bounding box
      } = req.query;

      let whereClause = 'WHERE pr.is_active = true';
      const params = [];

      if (regionId) {
        whereClause += ` AND pr.id = $${params.length + 1}`;
        params.push(regionId);
      }

      // Get regions, districts, zones with coordinates
      const [regionsData, schoolsData] = await Promise.all([
        query(`
          SELECT 
            'region' as type,
            pr.id,
            pr.region_name as name,
            pr.country,
            pr.coordinates,
            json_agg(
              json_build_object(
                'type', 'district',
                'id', d.id,
                'name', d.district_name,
                'code', d.district_code,
                'coordinates', d.coordinates,
                'zones', d.zones
              )
            ) FILTER (WHERE d.id IS NOT NULL) as districts
          FROM platform_regions pr
          LEFT JOIN (
            SELECT 
              d.*,
              json_agg(
                json_build_object(
                  'type', 'zone',
                  'id', z.id,
                  'name', z.zone_name,
                  'code', z.zone_code,
                  'coordinates', z.coordinates
                )
              ) FILTER (WHERE z.id IS NOT NULL) as zones
            FROM districts d
            LEFT JOIN zones z ON d.id = z.district_id AND z.is_active = true
            WHERE d.is_active = true
            GROUP BY d.id
          ) d ON pr.id = d.region_id
          ${whereClause}
          GROUP BY pr.id
        `, params),

        includeSchools === 'true' ? query(`
          SELECT 
            s.id,
            s.name as school_name,
            s.coordinates,
            s.school_type,
            pr.region_name,
            d.district_name,
            z.zone_name
          FROM schools s
          JOIN zones z ON s.zone_id = z.id
          JOIN districts d ON z.district_id = d.id
          JOIN platform_regions pr ON d.region_id = pr.id
          WHERE s.is_active = true 
            AND s.coordinates IS NOT NULL
            ${regionId ? 'AND pr.id = $1' : ''}
        `, regionId ? [regionId] : []) : Promise.resolve({ rows: [] })
      ]);

      res.json({
        success: true,
        data: {
          regions: regionsData.rows,
          schools: schoolsData.rows,
          includeSchools: includeSchools === 'true',
          bounds: bounds
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;