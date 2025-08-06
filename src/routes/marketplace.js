const express = require('express');
const router = express.Router();
const marketplaceController = require('../controllers/marketplaceController');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { body, param, query } = require('express-validator');

/**
 * Marketplace Routes
 * Handles e-commerce operations, vendor management, and product catalog
 */

// ====================================
// PUBLIC ENDPOINTS (No Authentication)
// ====================================

/**
 * Get public product catalog (for website)
 * GET /api/v1/marketplace/public/products
 */
router.get('/public/products', [
  query('categoryId').optional().isUUID().withMessage('Category ID must be valid UUID'),
  query('productType').optional().isIn(['physical', 'digital', 'service', 'subscription', 'course']).withMessage('Invalid product type'),
  query('featured').optional().isBoolean().withMessage('Featured must be boolean'),
  query('search').optional().isString().trim().withMessage('Search must be a string'),
  query('sortBy').optional().isIn(['featured', 'price_low', 'price_high', 'rating', 'newest']).withMessage('Invalid sort option'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50')
], validate, marketplaceController.getPublicProducts);

/**
 * Get public categories (for website)
 * GET /api/v1/marketplace/public/categories
 */
router.get('/public/categories', marketplaceController.getPublicCategories);

/**
 * Search products (public)
 * GET /api/v1/marketplace/public/search
 */
router.get('/public/search', [
  query('q').isString().isLength({ min: 2 }).withMessage('Search query must be at least 2 characters'),
  query('categoryId').optional().isUUID().withMessage('Category ID must be valid UUID'),
  query('priceMin').optional().isFloat({ min: 0 }).withMessage('Price min must be positive'),
  query('priceMax').optional().isFloat({ min: 0 }).withMessage('Price max must be positive'),
  query('rating').optional().isFloat({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  query('sortBy').optional().isIn(['relevance', 'price_low', 'price_high', 'rating', 'newest', 'bestseller']).withMessage('Invalid sort option'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50')
], validate, marketplaceController.searchProducts);

// ====================================
// AUTHENTICATED ENDPOINTS
// ====================================

// Authentication middleware for protected routes
router.use(authenticate);

// ====================================
// CATEGORY MANAGEMENT
// ====================================

/**
 * Create marketplace category
 * POST /api/v1/marketplace/categories
 */
router.post('/categories', [
  requireRole(['super_admin', 'edufam_admin']),
  body('categoryName').isString().trim().isLength({ min: 1, max: 100 }).withMessage('Category name is required (1-100 characters)'),
  body('categoryCode').isString().trim().isLength({ min: 1, max: 20 }).withMessage('Category code is required (1-20 characters)'),
  body('categoryType').isIn(['physical_products', 'digital_products', 'services', 'subscriptions', 'courses']).withMessage('Valid category type is required'),
  body('parentCategoryId').optional().isUUID().withMessage('Parent category ID must be valid UUID'),
  body('description').optional().isString().trim().withMessage('Description must be a string'),
  body('commissionRate').optional().isFloat({ min: 0, max: 100 }).withMessage('Commission rate must be between 0 and 100'),
  body('displayOrder').optional().isInt({ min: 0 }).withMessage('Display order must be non-negative'),
  body('iconUrl').optional().isURL().withMessage('Icon URL must be valid'),
  body('bannerUrl').optional().isURL().withMessage('Banner URL must be valid'),
  body('seoKeywords').optional().isArray().withMessage('SEO keywords must be an array')
], validate, marketplaceController.createCategory);

/**
 * Get marketplace categories
 * GET /api/v1/marketplace/categories
 */
router.get('/categories', [
  query('categoryType').optional().isIn(['physical_products', 'digital_products', 'services', 'subscriptions', 'courses']).withMessage('Invalid category type'),
  query('parentId').optional().isString().withMessage('Parent ID must be a string'),
  query('includeInactive').optional().isBoolean().withMessage('Include inactive must be boolean')
], validate, marketplaceController.getCategories);

// ====================================
// VENDOR MANAGEMENT
// ====================================

/**
 * Create vendor profile
 * POST /api/v1/marketplace/vendors
 */
router.post('/vendors', [
  requireRole(['super_admin', 'edufam_admin', 'school_admin', 'principal', 'teacher']),
  body('vendorName').isString().trim().isLength({ min: 1, max: 255 }).withMessage('Vendor name is required (1-255 characters)'),
  body('vendorCode').isString().trim().isLength({ min: 1, max: 20 }).withMessage('Vendor code is required (1-20 characters)'),
  body('vendorType').isIn(['school', 'teacher', 'company', 'individual', 'institution']).withMessage('Valid vendor type is required'),
  body('contactPersonId').optional().isUUID().withMessage('Contact person ID must be valid UUID'),
  body('businessName').optional().isString().trim().withMessage('Business name must be a string'),
  body('businessRegistrationNumber').optional().isString().trim().withMessage('Business registration number must be a string'),
  body('taxIdentificationNumber').optional().isString().trim().withMessage('Tax ID must be a string'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('phone').optional().isString().trim().withMessage('Phone must be a string'),
  body('websiteUrl').optional().isURL().withMessage('Website URL must be valid'),
  body('description').optional().isString().trim().withMessage('Description must be a string'),
  body('address').optional().isObject().withMessage('Address must be an object'),
  body('bankAccountDetails').optional().isObject().withMessage('Bank account details must be an object'),
  body('logoUrl').optional().isURL().withMessage('Logo URL must be valid'),
  body('bannerUrl').optional().isURL().withMessage('Banner URL must be valid'),
  body('socialMediaLinks').optional().isObject().withMessage('Social media links must be an object')
], validate, marketplaceController.createVendor);

/**
 * Get vendors
 * GET /api/v1/marketplace/vendors
 */
router.get('/vendors', [
  query('vendorType').optional().isIn(['school', 'teacher', 'company', 'individual', 'institution']).withMessage('Invalid vendor type'),
  query('verificationStatus').optional().isIn(['pending', 'verified', 'rejected', 'suspended']).withMessage('Invalid verification status'),
  query('status').optional().isIn(['active', 'inactive', 'suspended', 'banned']).withMessage('Invalid status'),
  query('featured').optional().isBoolean().withMessage('Featured must be boolean'),
  query('search').optional().isString().trim().withMessage('Search must be a string'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
], validate, marketplaceController.getVendors);

/**
 * Update vendor verification
 * PUT /api/v1/marketplace/vendors/:vendorId/verification
 */
router.put('/vendors/:vendorId/verification', [
  requireRole(['super_admin', 'edufam_admin']),
  param('vendorId').isUUID().withMessage('Valid vendor ID is required'),
  body('verificationStatus').isIn(['pending', 'verified', 'rejected', 'suspended']).withMessage('Valid verification status is required'),
  body('verificationDocuments').optional().isObject().withMessage('Verification documents must be an object'),
  body('verificationNotes').optional().isString().trim().withMessage('Verification notes must be a string')
], validate, marketplaceController.updateVendorVerification);

// ====================================
// PRODUCT MANAGEMENT
// ====================================

/**
 * Create product
 * POST /api/v1/marketplace/products
 */
router.post('/products', [
  requireRole(['super_admin', 'edufam_admin', 'school_admin', 'principal', 'teacher']),
  body('vendorId').isUUID().withMessage('Valid vendor ID is required'),
  body('categoryId').isUUID().withMessage('Valid category ID is required'),
  body('productName').isString().trim().isLength({ min: 1, max: 255 }).withMessage('Product name is required (1-255 characters)'),
  body('productCode').isString().trim().isLength({ min: 1, max: 50 }).withMessage('Product code is required (1-50 characters)'),
  body('productType').isIn(['physical', 'digital', 'service', 'subscription', 'course']).withMessage('Valid product type is required'),
  body('shortDescription').optional().isString().trim().isLength({ max: 500 }).withMessage('Short description must be max 500 characters'),
  body('fullDescription').optional().isString().trim().withMessage('Full description must be a string'),
  body('specifications').optional().isObject().withMessage('Specifications must be an object'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('currency').optional().isLength({ min: 3, max: 3 }).withMessage('Currency must be 3-letter code'),
  body('discountPercentage').optional().isFloat({ min: 0, max: 100 }).withMessage('Discount percentage must be between 0 and 100'),
  body('costPrice').optional().isFloat({ min: 0 }).withMessage('Cost price must be a positive number'),
  body('minimumOrderQuantity').optional().isInt({ min: 1 }).withMessage('Minimum order quantity must be positive'),
  body('maximumOrderQuantity').optional().isInt({ min: 1 }).withMessage('Maximum order quantity must be positive'),
  body('stockQuantity').optional().isInt({ min: 0 }).withMessage('Stock quantity must be non-negative'),
  body('lowStockThreshold').optional().isInt({ min: 0 }).withMessage('Low stock threshold must be non-negative'),
  body('isDigital').optional().isBoolean().withMessage('Is digital must be boolean'),
  body('digitalFileUrl').optional().isURL().withMessage('Digital file URL must be valid'),
  body('digitalFileSizeMb').optional().isFloat({ min: 0 }).withMessage('Digital file size must be positive'),
  body('subscriptionDurationMonths').optional().isInt({ min: 1 }).withMessage('Subscription duration must be positive'),
  body('trialPeriodDays').optional().isInt({ min: 0 }).withMessage('Trial period must be non-negative'),
  body('weightKg').optional().isFloat({ min: 0 }).withMessage('Weight must be positive'),
  body('dimensions').optional().isObject().withMessage('Dimensions must be an object'),
  body('shippingRequired').optional().isBoolean().withMessage('Shipping required must be boolean'),
  body('shippingCost').optional().isFloat({ min: 0 }).withMessage('Shipping cost must be positive'),
  body('freeShippingThreshold').optional().isFloat({ min: 0 }).withMessage('Free shipping threshold must be positive'),
  body('tags').optional().isArray().withMessage('Tags must be an array'),
  body('targetAudience').optional().isArray().withMessage('Target audience must be an array'),
  body('ageGroup').optional().isString().trim().withMessage('Age group must be a string'),
  body('curriculumCompatibility').optional().isArray().withMessage('Curriculum compatibility must be an array'),
  body('gradeLevels').optional().isArray().withMessage('Grade levels must be an array'),
  body('subjects').optional().isArray().withMessage('Subjects must be an array'),
  body('productImages').optional().isObject().withMessage('Product images must be an object'),
  body('productVideos').optional().isObject().withMessage('Product videos must be an object'),
  body('productDocuments').optional().isObject().withMessage('Product documents must be an object'),
  body('seoKeywords').optional().isArray().withMessage('SEO keywords must be an array'),
  body('metaDescription').optional().isString().trim().isLength({ max: 160 }).withMessage('Meta description must be max 160 characters'),
  body('promotionText').optional().isString().trim().withMessage('Promotion text must be a string')
], validate, marketplaceController.createProduct);

/**
 * Get products
 * GET /api/v1/marketplace/products
 */
router.get('/products', [
  query('categoryId').optional().isUUID().withMessage('Category ID must be valid UUID'),
  query('vendorId').optional().isUUID().withMessage('Vendor ID must be valid UUID'),
  query('productType').optional().isIn(['physical', 'digital', 'service', 'subscription', 'course']).withMessage('Invalid product type'),
  query('status').optional().isIn(['draft', 'active', 'inactive', 'out_of_stock', 'discontinued']).withMessage('Invalid status'),
  query('approvalStatus').optional().isIn(['pending', 'approved', 'rejected']).withMessage('Invalid approval status'),
  query('featured').optional().isBoolean().withMessage('Featured must be boolean'),
  query('priceMin').optional().isFloat({ min: 0 }).withMessage('Price min must be positive'),
  query('priceMax').optional().isFloat({ min: 0 }).withMessage('Price max must be positive'),
  query('tags').optional().isString().withMessage('Tags must be comma-separated string'),
  query('targetAudience').optional().isString().withMessage('Target audience must be comma-separated string'),
  query('curriculumCompatibility').optional().isString().withMessage('Curriculum compatibility must be comma-separated string'),
  query('search').optional().isString().trim().withMessage('Search must be a string'),
  query('sortBy').optional().isIn(['created_at', 'price', 'rating', 'sales_count', 'product_name']).withMessage('Invalid sort option'),
  query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
], validate, marketplaceController.getProducts);

/**
 * Get product details
 * GET /api/v1/marketplace/products/:productId
 */
router.get('/products/:productId', [
  param('productId').isUUID().withMessage('Valid product ID is required')
], validate, marketplaceController.getProduct);

/**
 * Update product approval
 * PUT /api/v1/marketplace/products/:productId/approval
 */
router.put('/products/:productId/approval', [
  requireRole(['super_admin', 'edufam_admin']),
  param('productId').isUUID().withMessage('Valid product ID is required'),
  body('approvalStatus').isIn(['pending', 'approved', 'rejected']).withMessage('Valid approval status is required'),
  body('approvalNotes').optional().isString().trim().withMessage('Approval notes must be a string')
], validate, marketplaceController.updateProductApproval);

// ====================================
// SHOPPING CART MANAGEMENT
// ====================================

/**
 * Add item to cart
 * POST /api/v1/marketplace/cart
 */
router.post('/cart', [
  body('productId').isUUID().withMessage('Valid product ID is required'),
  body('quantity').isInt({ min: 1 }).withMessage('Quantity must be a positive integer')
], validate, marketplaceController.addToCart);

/**
 * Get user's cart
 * GET /api/v1/marketplace/cart
 */
router.get('/cart', marketplaceController.getCart);

/**
 * Update cart item
 * PUT /api/v1/marketplace/cart/:productId
 */
router.put('/cart/:productId', [
  param('productId').isUUID().withMessage('Valid product ID is required'),
  body('quantity').isInt({ min: 0 }).withMessage('Quantity must be non-negative')
], validate, marketplaceController.updateCartItem);

/**
 * Remove item from cart
 * DELETE /api/v1/marketplace/cart/:productId
 */
router.delete('/cart/:productId', [
  param('productId').isUUID().withMessage('Valid product ID is required')
], validate, marketplaceController.removeFromCart);

/**
 * Clear cart
 * DELETE /api/v1/marketplace/cart
 */
router.delete('/cart', marketplaceController.clearCart);

// ====================================
// ORDER MANAGEMENT
// ====================================

/**
 * Create order from cart
 * POST /api/v1/marketplace/orders
 */
router.post('/orders', [
  body('shippingAddress').isObject().withMessage('Shipping address is required'),
  body('billingAddress').optional().isObject().withMessage('Billing address must be an object'),
  body('paymentMethod').isString().trim().withMessage('Payment method is required'),
  body('customerNotes').optional().isString().trim().withMessage('Customer notes must be a string'),
  body('couponCode').optional().isString().trim().withMessage('Coupon code must be a string')
], validate, marketplaceController.createOrder);

// ====================================
// REVIEW MANAGEMENT
// ====================================

/**
 * Create product review
 * POST /api/v1/marketplace/products/:productId/reviews
 */
router.post('/products/:productId/reviews', [
  param('productId').isUUID().withMessage('Valid product ID is required'),
  body('orderItemId').optional().isUUID().withMessage('Order item ID must be valid UUID'),
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('reviewTitle').optional().isString().trim().isLength({ max: 255 }).withMessage('Review title must be max 255 characters'),
  body('reviewText').optional().isString().trim().withMessage('Review text must be a string'),
  body('pros').optional().isString().trim().withMessage('Pros must be a string'),
  body('cons').optional().isString().trim().withMessage('Cons must be a string'),
  body('wouldRecommend').optional().isBoolean().withMessage('Would recommend must be boolean'),
  body('images').optional().isObject().withMessage('Images must be an object')
], validate, marketplaceController.createReview);

// ====================================
// WISHLIST MANAGEMENT
// ====================================

/**
 * Add to wishlist
 * POST /api/v1/marketplace/products/:productId/wishlist
 */
router.post('/products/:productId/wishlist', [
  param('productId').isUUID().withMessage('Valid product ID is required'),
  body('wishlistId').optional().isUUID().withMessage('Wishlist ID must be valid UUID')
], validate, marketplaceController.addToWishlist);

/**
 * Remove from wishlist
 * DELETE /api/v1/marketplace/products/:productId/wishlist
 */
router.delete('/products/:productId/wishlist', [
  param('productId').isUUID().withMessage('Valid product ID is required'),
  body('wishlistId').optional().isUUID().withMessage('Wishlist ID must be valid UUID')
], validate, marketplaceController.removeFromWishlist);

// ====================================
// SEARCH AND DISCOVERY
// ====================================

/**
 * Search products (authenticated)
 * GET /api/v1/marketplace/search
 */
router.get('/search', [
  query('q').isString().isLength({ min: 2 }).withMessage('Search query must be at least 2 characters'),
  query('categoryId').optional().isUUID().withMessage('Category ID must be valid UUID'),
  query('priceMin').optional().isFloat({ min: 0 }).withMessage('Price min must be positive'),
  query('priceMax').optional().isFloat({ min: 0 }).withMessage('Price max must be positive'),
  query('rating').optional().isFloat({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  query('sortBy').optional().isIn(['relevance', 'price_low', 'price_high', 'rating', 'newest', 'bestseller']).withMessage('Invalid sort option'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
], validate, marketplaceController.searchProducts);

// ====================================
// ANALYTICS AND REPORTS
// ====================================

/**
 * Get marketplace analytics
 * GET /api/v1/marketplace/analytics
 */
router.get('/analytics', [
  requireRole(['super_admin', 'edufam_admin']),
  query('startDate').optional().isISO8601().withMessage('Start date must be valid ISO date'),
  query('endDate').optional().isISO8601().withMessage('End date must be valid ISO date')
], validate, marketplaceController.getMarketplaceAnalytics);

// ====================================
// HEALTH CHECK
// ====================================

/**
 * Marketplace service health check
 * GET /api/v1/marketplace/health
 */
router.get('/health', marketplaceController.getMarketplaceHealth);

// ====================================
// ERROR HANDLING
// ====================================

// Global error handler for marketplace routes
router.use((error, req, res, next) => {
  console.error('Marketplace route error:', error);
  
  res.status(error.statusCode || 500).json({
    success: false,
    error: {
      code: error.code || 'MARKETPLACE_ERROR',
      message: error.message || 'An error occurred in marketplace management'
    }
  });
});

module.exports = router;