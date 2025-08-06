const express = require('express');
const router = express.Router();
const { authenticate, requireRole, requireUserType } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { body, query, param } = require('express-validator');
const InventoryController = require('../controllers/inventoryController');

// Apply authentication to all routes
router.use(authenticate);
router.use(requireUserType(['school_user', 'admin_user']));

// =============================================================================
// ASSET REGISTRY
// =============================================================================

/**
 * @route   GET /api/inventory/assets
 * @desc    Get assets
 * @access  Private (All staff)
 */
router.get('/assets',
  query('category').optional().isIn(['electronics', 'furniture', 'books', 'sports_equipment', 'laboratory', 'transport', 'kitchen', 'office']).withMessage('Invalid category'),
  query('condition').optional().isIn(['excellent', 'good', 'fair', 'poor', 'damaged']).withMessage('Invalid condition'),
  query('status').optional().isIn(['active', 'maintenance', 'retired', 'lost', 'stolen']).withMessage('Invalid status'),
  query('location').optional().isString().withMessage('Location must be string'),
  query('department').optional().isString().withMessage('Department must be string'),
  query('search').optional().isString().withMessage('Search must be string'),
  validate,
  InventoryController.getAssets
);

/**
 * @route   POST /api/inventory/assets
 * @desc    Register new asset
 * @access  Private (Admin, Principal, School Director, Department Heads)
 */
router.post('/assets',
  requireRole(['principal', 'school_director', 'admin', 'department_head', 'super_admin']),
  body('assetName').notEmpty().withMessage('Asset name is required'),
  body('category').isIn(['electronics', 'furniture', 'books', 'sports_equipment', 'laboratory', 'transport', 'kitchen', 'office']).withMessage('Invalid category'),
  body('assetTag').notEmpty().withMessage('Asset tag is required'),
  body('description').optional().isString().withMessage('Description must be string'),
  body('purchaseInfo').isObject().withMessage('Purchase info is required'),
  body('purchaseInfo.purchaseDate').isISO8601().withMessage('Purchase date is required'),
  body('purchaseInfo.cost').isFloat({ min: 0 }).withMessage('Cost must be positive'),
  body('purchaseInfo.vendor').notEmpty().withMessage('Vendor is required'),
  body('purchaseInfo.warranty').optional().isString().withMessage('Warranty must be string'),
  body('location').isObject().withMessage('Location is required'),
  body('location.department').notEmpty().withMessage('Department is required'),
  body('location.room').optional().isString().withMessage('Room must be string'),
  body('location.responsiblePerson').optional().isUUID().withMessage('Responsible person must be valid UUID'),
  body('condition').isIn(['excellent', 'good', 'fair', 'poor']).withMessage('Invalid condition'),
  body('serialNumber').optional().isString().withMessage('Serial number must be string'),
  validate,
  InventoryController.registerAsset
);

/**
 * @route   PUT /api/inventory/assets/:assetId
 * @desc    Update asset information
 * @access  Private (Admin, Principal, School Director, Department Heads)
 */
router.put('/assets/:assetId',
  requireRole(['principal', 'school_director', 'admin', 'department_head', 'super_admin']),
  param('assetId').isUUID().withMessage('Asset ID must be valid UUID'),
  body('condition').optional().isIn(['excellent', 'good', 'fair', 'poor', 'damaged']).withMessage('Invalid condition'),
  body('status').optional().isIn(['active', 'maintenance', 'retired', 'lost', 'stolen']).withMessage('Invalid status'),
  body('location').optional().isObject().withMessage('Location must be object'),
  body('location.department').optional().notEmpty().withMessage('Department cannot be empty'),
  body('location.room').optional().isString().withMessage('Room must be string'),
  body('location.responsiblePerson').optional().isUUID().withMessage('Responsible person must be valid UUID'),
  validate,
  InventoryController.updateAsset
);

/**
 * @route   GET /api/inventory/assets/:assetId/history
 * @desc    Get asset history
 * @access  Private (All staff)
 */
router.get('/assets/:assetId/history',
  param('assetId').isUUID().withMessage('Asset ID must be valid UUID'),
  query('eventType').optional().isIn(['purchase', 'transfer', 'maintenance', 'repair', 'disposal', 'loss']).withMessage('Invalid event type'),
  query('startDate').optional().isISO8601().withMessage('Start date must be valid'),
  query('endDate').optional().isISO8601().withMessage('End date must be valid'),
  validate,
  InventoryController.getAssetHistory
);

/**
 * @route   POST /api/inventory/assets/:assetId/maintenance
 * @desc    Record asset maintenance
 * @access  Private (Admin, Principal, School Director, Department Heads)
 */
router.post('/assets/:assetId/maintenance',
  requireRole(['principal', 'school_director', 'admin', 'department_head', 'super_admin']),
  param('assetId').isUUID().withMessage('Asset ID must be valid UUID'),
  body('maintenanceType').isIn(['routine', 'repair', 'upgrade', 'calibration', 'cleaning']).withMessage('Invalid maintenance type'),
  body('description').notEmpty().withMessage('Maintenance description is required'),
  body('cost').isFloat({ min: 0 }).withMessage('Cost must be positive'),
  body('serviceProvider').notEmpty().withMessage('Service provider is required'),
  body('maintenanceDate').isISO8601().withMessage('Maintenance date is required'),
  body('nextMaintenanceDate').optional().isISO8601().withMessage('Next maintenance date must be valid'),
  body('warranty').optional().isString().withMessage('Warranty must be string'),
  validate,
  InventoryController.recordAssetMaintenance
);

/**
 * @route   GET /api/inventory/assets/depreciation
 * @desc    Get asset depreciation report
 * @access  Private (Finance, Principal, School Director)
 */
router.get('/assets/depreciation',
  requireRole(['finance', 'principal', 'school_director', 'super_admin']),
  query('category').optional().isIn(['electronics', 'furniture', 'books', 'sports_equipment', 'laboratory', 'transport']).withMessage('Invalid category'),
  query('department').optional().isString().withMessage('Department must be string'),
  query('method').optional().isIn(['straight_line', 'declining_balance', 'sum_of_years']).withMessage('Invalid depreciation method'),
  validate,
  InventoryController.getAssetDepreciation
);

// =============================================================================
// SUPPLY MANAGEMENT
// =============================================================================

/**
 * @route   GET /api/inventory/supplies
 * @desc    Get supplies
 * @access  Private (All staff)
 */
router.get('/supplies',
  query('category').optional().isIn(['stationery', 'cleaning', 'food', 'medical', 'maintenance', 'teaching_materials', 'uniforms']).withMessage('Invalid category'),
  query('status').optional().isIn(['in_stock', 'low_stock', 'out_of_stock', 'ordered']).withMessage('Invalid status'),
  query('supplier').optional().isString().withMessage('Supplier must be string'),
  query('lowStock').optional().isBoolean().withMessage('Low stock must be boolean'),
  validate,
  InventoryController.getSupplies
);

/**
 * @route   POST /api/inventory/supplies
 * @desc    Add supply item
 * @access  Private (Admin, Principal, School Director, Store Keeper)
 */
router.post('/supplies',
  requireRole(['principal', 'school_director', 'admin', 'store_keeper', 'super_admin']),
  body('itemName').notEmpty().withMessage('Item name is required'),
  body('category').isIn(['stationery', 'cleaning', 'food', 'medical', 'maintenance', 'teaching_materials', 'uniforms']).withMessage('Invalid category'),
  body('description').optional().isString().withMessage('Description must be string'),
  body('unit').notEmpty().withMessage('Unit is required'),
  body('currentStock').isInt({ min: 0 }).withMessage('Current stock must be non-negative'),
  body('minimumStock').isInt({ min: 0 }).withMessage('Minimum stock must be non-negative'),
  body('maximumStock').optional().isInt({ min: 0 }).withMessage('Maximum stock must be non-negative'),
  body('unitCost').isFloat({ min: 0 }).withMessage('Unit cost must be positive'),
  body('supplier').optional().isString().withMessage('Supplier must be string'),
  body('storageLocation').optional().isString().withMessage('Storage location must be string'),
  validate,
  InventoryController.addSupplyItem
);

/**
 * @route   PUT /api/inventory/supplies/:supplyId
 * @desc    Update supply item
 * @access  Private (Admin, Principal, School Director, Store Keeper)
 */
router.put('/supplies/:supplyId',
  requireRole(['principal', 'school_director', 'admin', 'store_keeper', 'super_admin']),
  param('supplyId').isUUID().withMessage('Supply ID must be valid UUID'),
  body('currentStock').optional().isInt({ min: 0 }).withMessage('Current stock must be non-negative'),
  body('minimumStock').optional().isInt({ min: 0 }).withMessage('Minimum stock must be non-negative'),
  body('unitCost').optional().isFloat({ min: 0 }).withMessage('Unit cost must be positive'),
  body('supplier').optional().isString().withMessage('Supplier must be string'),
  validate,
  InventoryController.updateSupplyItem
);

/**
 * @route   GET /api/inventory/supplies/low-stock
 * @desc    Get low stock items
 * @access  Private (Admin, Principal, School Director, Store Keeper)
 */
router.get('/supplies/low-stock',
  requireRole(['principal', 'school_director', 'admin', 'store_keeper', 'super_admin']),
  query('category').optional().isIn(['stationery', 'cleaning', 'food', 'medical', 'maintenance', 'teaching_materials']).withMessage('Invalid category'),
  query('urgent').optional().isBoolean().withMessage('Urgent must be boolean'),
  validate,
  InventoryController.getLowStockItems
);

/**
 * @route   POST /api/inventory/supplies/reorder
 * @desc    Create reorder request
 * @access  Private (Admin, Principal, School Director, Store Keeper)
 */
router.post('/supplies/reorder',
  requireRole(['principal', 'school_director', 'admin', 'store_keeper', 'super_admin']),
  body('supplyId').isUUID().withMessage('Supply ID is required'),
  body('quantity').isInt({ min: 1 }).withMessage('Quantity must be positive'),
  body('urgency').isIn(['low', 'medium', 'high', 'critical']).withMessage('Invalid urgency level'),
  body('justification').notEmpty().withMessage('Justification is required'),
  body('requestedBy').isUUID().withMessage('Requested by is required'),
  body('expectedDeliveryDate').optional().isISO8601().withMessage('Expected delivery date must be valid'),
  validate,
  InventoryController.createReorderRequest
);

/**
 * @route   GET /api/inventory/supplies/consumption-patterns
 * @desc    Get supply consumption patterns
 * @access  Private (Admin, Principal, School Director, Store Keeper)
 */
router.get('/supplies/consumption-patterns',
  requireRole(['principal', 'school_director', 'admin', 'store_keeper', 'super_admin']),
  query('supplyId').optional().isUUID().withMessage('Supply ID must be valid UUID'),
  query('category').optional().isIn(['stationery', 'cleaning', 'food', 'medical', 'maintenance', 'teaching_materials']).withMessage('Invalid category'),
  query('period').optional().isIn(['weekly', 'monthly', 'quarterly', 'yearly']).withMessage('Invalid period'),
  query('startDate').optional().isISO8601().withMessage('Start date must be valid'),
  query('endDate').optional().isISO8601().withMessage('End date must be valid'),
  validate,
  InventoryController.getConsumptionPatterns
);

// =============================================================================
// PROCUREMENT MANAGEMENT
// =============================================================================

/**
 * @route   GET /api/inventory/procurement/requests
 * @desc    Get procurement requests
 * @access  Private (Admin, Principal, School Director, Procurement Officer)
 */
router.get('/procurement/requests',
  requireRole(['principal', 'school_director', 'admin', 'procurement_officer', 'super_admin']),
  query('status').optional().isIn(['draft', 'submitted', 'approved', 'rejected', 'ordered', 'delivered']).withMessage('Invalid status'),
  query('requestType').optional().isIn(['new_purchase', 'replacement', 'maintenance', 'urgent']).withMessage('Invalid request type'),
  query('priority').optional().isIn(['low', 'medium', 'high', 'critical']).withMessage('Invalid priority'),
  query('department').optional().isString().withMessage('Department must be string'),
  validate,
  InventoryController.getProcurementRequests
);

/**
 * @route   POST /api/inventory/procurement/requests
 * @desc    Create procurement request
 * @access  Private (All staff)
 */
router.post('/procurement/requests',
  body('requestType').isIn(['new_purchase', 'replacement', 'maintenance', 'urgent']).withMessage('Invalid request type'),
  body('items').isArray({ min: 1 }).withMessage('Items array is required'),
  body('items.*.itemName').notEmpty().withMessage('Item name is required'),
  body('items.*.category').isIn(['electronics', 'furniture', 'stationery', 'cleaning', 'food', 'medical', 'maintenance', 'teaching_materials']).withMessage('Invalid category'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be positive'),
  body('items.*.estimatedCost').isFloat({ min: 0 }).withMessage('Estimated cost must be positive'),
  body('items.*.specifications').optional().isString().withMessage('Specifications must be string'),
  body('items.*.urgency').isIn(['low', 'medium', 'high', 'critical']).withMessage('Invalid urgency'),
  body('department').notEmpty().withMessage('Department is required'),
  body('justification').notEmpty().withMessage('Justification is required'),
  body('budgetLine').optional().isString().withMessage('Budget line must be string'),
  body('preferredVendors').optional().isArray().withMessage('Preferred vendors must be array'),
  body('requiredBy').optional().isISO8601().withMessage('Required by date must be valid'),
  validate,
  InventoryController.createProcurementRequest
);

/**
 * @route   PUT /api/inventory/procurement/requests/:requestId/approve
 * @desc    Approve procurement request
 * @access  Private (Principal, School Director, Procurement Officer)
 */
router.put('/procurement/requests/:requestId/approve',
  requireRole(['principal', 'school_director', 'procurement_officer', 'super_admin']),
  param('requestId').isUUID().withMessage('Request ID must be valid UUID'),
  body('comments').optional().isString().withMessage('Comments must be string'),
  body('budgetApproval').optional().isBoolean().withMessage('Budget approval must be boolean'),
  body('modifications').optional().isArray().withMessage('Modifications must be array'),
  validate,
  InventoryController.approveProcurementRequest
);

/**
 * @route   GET /api/inventory/procurement/vendors
 * @desc    Get vendors
 * @access  Private (Admin, Principal, School Director, Procurement Officer)
 */
router.get('/procurement/vendors',
  requireRole(['principal', 'school_director', 'admin', 'procurement_officer', 'super_admin']),
  query('category').optional().isString().withMessage('Category must be string'),
  query('status').optional().isIn(['active', 'inactive', 'blacklisted']).withMessage('Invalid status'),
  query('rating').optional().isFloat({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  validate,
  InventoryController.getVendors
);

/**
 * @route   POST /api/inventory/procurement/vendors
 * @desc    Add vendor
 * @access  Private (Principal, School Director, Procurement Officer)
 */
router.post('/procurement/vendors',
  requireRole(['principal', 'school_director', 'procurement_officer', 'super_admin']),
  body('vendorName').notEmpty().withMessage('Vendor name is required'),
  body('contactPerson').notEmpty().withMessage('Contact person is required'),
  body('phone').notEmpty().withMessage('Phone is required'),
  body('email').optional().isEmail().withMessage('Invalid email format'),
  body('address').notEmpty().withMessage('Address is required'),
  body('categories').isArray({ min: 1 }).withMessage('Categories are required'),
  body('taxPin').optional().isString().withMessage('Tax PIN must be string'),
  body('bankDetails').optional().isObject().withMessage('Bank details must be object'),
  validate,
  InventoryController.addVendor
);

/**
 * @route   GET /api/inventory/procurement/quotes
 * @desc    Get procurement quotes
 * @access  Private (Principal, School Director, Procurement Officer)
 */
router.get('/procurement/quotes',
  requireRole(['principal', 'school_director', 'procurement_officer', 'super_admin']),
  query('requestId').optional().isUUID().withMessage('Request ID must be valid UUID'),
  query('vendorId').optional().isUUID().withMessage('Vendor ID must be valid UUID'),
  query('status').optional().isIn(['pending', 'received', 'evaluated', 'selected', 'rejected']).withMessage('Invalid status'),
  validate,
  InventoryController.getProcurementQuotes
);

/**
 * @route   POST /api/inventory/procurement/purchase-orders
 * @desc    Create purchase order
 * @access  Private (Principal, School Director, Procurement Officer)
 */
router.post('/procurement/purchase-orders',
  requireRole(['principal', 'school_director', 'procurement_officer', 'super_admin']),
  body('vendorId').isUUID().withMessage('Vendor ID is required'),
  body('requestId').isUUID().withMessage('Request ID is required'),
  body('items').isArray({ min: 1 }).withMessage('Items are required'),
  body('totalAmount').isFloat({ min: 0 }).withMessage('Total amount must be positive'),
  body('paymentTerms').notEmpty().withMessage('Payment terms are required'),
  body('deliveryDate').isISO8601().withMessage('Delivery date is required'),
  body('deliveryAddress').notEmpty().withMessage('Delivery address is required'),
  body('terms').optional().isArray().withMessage('Terms must be array'),
  validate,
  InventoryController.createPurchaseOrder
);

// =============================================================================
// ASSET ALLOCATION
// =============================================================================

/**
 * @route   GET /api/inventory/allocations
 * @desc    Get asset allocations
 * @access  Private (All staff)
 */
router.get('/allocations',
  query('assetId').optional().isUUID().withMessage('Asset ID must be valid UUID'),
  query('employeeId').optional().isUUID().withMessage('Employee ID must be valid UUID'),
  query('department').optional().isString().withMessage('Department must be string'),
  query('status').optional().isIn(['allocated', 'returned', 'transferred', 'lost']).withMessage('Invalid status'),
  validate,
  InventoryController.getAssetAllocations
);

/**
 * @route   POST /api/inventory/allocations
 * @desc    Allocate asset
 * @access  Private (Admin, Principal, School Director, Department Heads)
 */
router.post('/allocations',
  requireRole(['principal', 'school_director', 'admin', 'department_head', 'super_admin']),
  body('assetId').isUUID().withMessage('Asset ID is required'),
  body('allocatedTo').isUUID().withMessage('Allocated to is required'),
  body('allocationType').isIn(['personal', 'department', 'classroom', 'temporary']).withMessage('Invalid allocation type'),
  body('allocationDate').isISO8601().withMessage('Allocation date is required'),
  body('expectedReturnDate').optional().isISO8601().withMessage('Expected return date must be valid'),
  body('purpose').notEmpty().withMessage('Purpose is required'),
  body('conditions').optional().isArray().withMessage('Conditions must be array'),
  validate,
  InventoryController.allocateAsset
);

/**
 * @route   PUT /api/inventory/allocations/:allocationId
 * @desc    Update asset allocation
 * @access  Private (Admin, Principal, School Director, Department Heads)
 */
router.put('/allocations/:allocationId',
  requireRole(['principal', 'school_director', 'admin', 'department_head', 'super_admin']),
  param('allocationId').isUUID().withMessage('Allocation ID must be valid UUID'),
  body('status').optional().isIn(['allocated', 'returned', 'transferred', 'lost']).withMessage('Invalid status'),
  body('returnDate').optional().isISO8601().withMessage('Return date must be valid'),
  body('returnCondition').optional().isIn(['excellent', 'good', 'fair', 'poor', 'damaged']).withMessage('Invalid return condition'),
  body('notes').optional().isString().withMessage('Notes must be string'),
  validate,
  InventoryController.updateAssetAllocation
);

/**
 * @route   GET /api/inventory/allocations/by-department
 * @desc    Get allocations by department
 * @access  Private (Department Heads, Admin, Principal, School Director)
 */
router.get('/allocations/by-department',
  requireRole(['principal', 'school_director', 'admin', 'department_head', 'super_admin']),
  query('department').optional().isString().withMessage('Department must be string'),
  query('includeReturned').optional().isBoolean().withMessage('Include returned must be boolean'),
  validate,
  InventoryController.getAllocationsByDepartment
);

/**
 * @route   GET /api/inventory/allocations/by-room
 * @desc    Get allocations by room
 * @access  Private (All staff)
 */
router.get('/allocations/by-room',
  query('room').isString().withMessage('Room is required'),
  query('department').optional().isString().withMessage('Department must be string'),
  validate,
  InventoryController.getAllocationsByRoom
);

// =============================================================================
// INVENTORY ANALYTICS & REPORTS
// =============================================================================

/**
 * @route   GET /api/inventory/analytics/asset-utilization
 * @desc    Get asset utilization analytics
 * @access  Private (Admin, Principal, School Director)
 */
router.get('/analytics/asset-utilization',
  requireRole(['principal', 'school_director', 'admin', 'super_admin']),
  query('category').optional().isIn(['electronics', 'furniture', 'books', 'sports_equipment', 'laboratory', 'transport']).withMessage('Invalid category'),
  query('department').optional().isString().withMessage('Department must be string'),
  query('period').optional().isIn(['monthly', 'quarterly', 'yearly']).withMessage('Invalid period'),
  validate,
  InventoryController.getAssetUtilization
);

/**
 * @route   GET /api/inventory/analytics/cost-analysis
 * @desc    Get inventory cost analysis
 * @access  Private (Finance, Principal, School Director)
 */
router.get('/analytics/cost-analysis',
  requireRole(['finance', 'principal', 'school_director', 'super_admin']),
  query('category').optional().isIn(['electronics', 'furniture', 'books', 'sports_equipment', 'laboratory', 'transport']).withMessage('Invalid category'),
  query('startDate').optional().isISO8601().withMessage('Start date must be valid'),
  query('endDate').optional().isISO8601().withMessage('End date must be valid'),
  query('analysisType').optional().isIn(['purchase', 'maintenance', 'depreciation', 'total']).withMessage('Invalid analysis type'),
  validate,
  InventoryController.getCostAnalysis
);

/**
 * @route   GET /api/inventory/reports/asset-register
 * @desc    Get asset register report
 * @access  Private (Admin, Principal, School Director)
 */
router.get('/reports/asset-register',
  requireRole(['principal', 'school_director', 'admin', 'super_admin']),
  query('category').optional().isIn(['electronics', 'furniture', 'books', 'sports_equipment', 'laboratory', 'transport']).withMessage('Invalid category'),
  query('department').optional().isString().withMessage('Department must be string'),
  query('format').optional().isIn(['json', 'pdf', 'excel']).withMessage('Invalid format'),
  query('includeDepreciation').optional().isBoolean().withMessage('Include depreciation must be boolean'),
  validate,
  InventoryController.getAssetRegisterReport
);

/**
 * @route   GET /api/inventory/reports/stock-levels
 * @desc    Get stock levels report
 * @access  Private (Admin, Principal, School Director, Store Keeper)
 */
router.get('/reports/stock-levels',
  requireRole(['principal', 'school_director', 'admin', 'store_keeper', 'super_admin']),
  query('category').optional().isIn(['stationery', 'cleaning', 'food', 'medical', 'maintenance', 'teaching_materials']).withMessage('Invalid category'),
  query('lowStockOnly').optional().isBoolean().withMessage('Low stock only must be boolean'),
  query('format').optional().isIn(['json', 'pdf', 'excel']).withMessage('Invalid format'),
  validate,
  InventoryController.getStockLevelsReport
);

module.exports = router;