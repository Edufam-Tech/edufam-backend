const marketplaceService = require('../services/marketplaceService');
const realtimeIntegrations = require('../integrations/realtimeIntegrations');
const { asyncHandler } = require('../middleware/errorHandler');
const { ValidationError } = require('../middleware/errorHandler');

/**
 * Marketplace Controller
 * Handles e-commerce operations, vendor management, and product catalog
 */
class MarketplaceController {

  /**
   * Category Management
   */

  // Create marketplace category
  createCategory = asyncHandler(async (req, res) => {
    const {
      categoryName,
      categoryCode,
      parentCategoryId,
      description,
      categoryType,
      commissionRate,
      displayOrder,
      iconUrl,
      bannerUrl,
      seoKeywords
    } = req.body;

    // Validate required fields
    if (!categoryName || !categoryCode || !categoryType) {
      throw new ValidationError('Category name, code, and type are required');
    }

    const category = await marketplaceService.createCategory({
      categoryName,
      categoryCode,
      parentCategoryId,
      description,
      categoryType,
      commissionRate,
      displayOrder,
      iconUrl,
      bannerUrl,
      seoKeywords
    });

    res.status(201).json({
      success: true,
      data: { category },
      message: 'Marketplace category created successfully'
    });
  });

  // Get marketplace categories
  getCategories = asyncHandler(async (req, res) => {
    const {
      categoryType,
      parentId,
      includeInactive
    } = req.query;

    const categories = await marketplaceService.getCategories({
      categoryType,
      parentId: parentId === 'null' ? null : parentId,
      includeInactive: includeInactive === 'true'
    });

    res.json({
      success: true,
      data: { categories },
      message: 'Marketplace categories retrieved successfully'
    });
  });

  /**
   * Vendor Management
   */

  // Create vendor profile
  createVendor = asyncHandler(async (req, res) => {
    const {
      vendorName,
      vendorCode,
      vendorType,
      contactPersonId,
      businessName,
      businessRegistrationNumber,
      taxIdentificationNumber,
      email,
      phone,
      websiteUrl,
      description,
      address,
      bankAccountDetails,
      logoUrl,
      bannerUrl,
      socialMediaLinks
    } = req.body;

    // Validate required fields
    if (!vendorName || !vendorCode || !vendorType || !email) {
      throw new ValidationError('Vendor name, code, type, and email are required');
    }

    const vendor = await marketplaceService.createVendor({
      vendorName,
      vendorCode,
      vendorType,
      contactPersonId: contactPersonId || req.user.userId,
      businessName,
      businessRegistrationNumber,
      taxIdentificationNumber,
      email,
      phone,
      websiteUrl,
      description,
      address,
      bankAccountDetails,
      logoUrl,
      bannerUrl,
      socialMediaLinks,
      createdBy: req.user.userId
    });

    res.status(201).json({
      success: true,
      data: { vendor },
      message: 'Vendor profile created successfully'
    });
  });

  // Get vendors
  getVendors = asyncHandler(async (req, res) => {
    const {
      vendorType,
      verificationStatus,
      status,
      featured,
      search,
      page,
      limit
    } = req.query;

    const vendors = await marketplaceService.getVendors({
      vendorType,
      verificationStatus,
      status,
      featured: featured === 'true',
      search,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20
    });

    res.json({
      success: true,
      data: {
        vendors,
        pagination: {
          page: parseInt(page) || 1,
          limit: parseInt(limit) || 20,
          hasMore: vendors.length === (parseInt(limit) || 20)
        }
      },
      message: 'Vendors retrieved successfully'
    });
  });

  // Update vendor verification
  updateVendorVerification = asyncHandler(async (req, res) => {
    const { vendorId } = req.params;
    const {
      verificationStatus,
      verificationDocuments,
      verificationNotes
    } = req.body;

    if (!verificationStatus) {
      throw new ValidationError('Verification status is required');
    }

    const vendor = await marketplaceService.updateVendorVerification(vendorId, {
      verificationStatus,
      verificationDocuments,
      verificationNotes
    });

    // Send notification to vendor
    try {
      await realtimeIntegrations.createCustomEvent({
        eventType: 'vendor_verification_updated',
        schoolId: null, // Platform-wide
        sourceUserId: req.user.userId,
        targetUserIds: [vendor.contact_person_id],
        title: 'Vendor Verification Status Updated',
        message: `Your vendor profile verification status has been updated to: ${verificationStatus}`,
        eventPayload: {
          vendorId: vendor.id,
          vendorName: vendor.vendor_name,
          verificationStatus,
          verificationNotes
        },
        priority: 'high',
        sourceEntityType: 'vendor',
        sourceEntityId: vendor.id,
        actionUrl: `/marketplace/vendor/profile/${vendor.id}`
      });
    } catch (error) {
      console.error('Failed to send vendor verification notification:', error);
    }

    res.json({
      success: true,
      data: { vendor },
      message: 'Vendor verification updated successfully'
    });
  });

  /**
   * Product Management
   */

  // Create product
  createProduct = asyncHandler(async (req, res) => {
    const {
      vendorId,
      categoryId,
      productName,
      productCode,
      productType,
      shortDescription,
      fullDescription,
      specifications,
      price,
      currency,
      discountPercentage,
      costPrice,
      minimumOrderQuantity,
      maximumOrderQuantity,
      stockQuantity,
      lowStockThreshold,
      isDigital,
      digitalFileUrl,
      digitalFileSizeMb,
      subscriptionDurationMonths,
      trialPeriodDays,
      weightKg,
      dimensions,
      shippingRequired,
      shippingCost,
      freeShippingThreshold,
      tags,
      targetAudience,
      ageGroup,
      curriculumCompatibility,
      gradeLevels,
      subjects,
      productImages,
      productVideos,
      productDocuments,
      seoKeywords,
      metaDescription,
      promotionText
    } = req.body;

    // Validate required fields
    if (!vendorId || !categoryId || !productName || !productCode || !productType || !price) {
      throw new ValidationError('Vendor ID, category ID, product name, code, type, and price are required');
    }

    const product = await marketplaceService.createProduct({
      vendorId,
      categoryId,
      productName,
      productCode,
      productType,
      shortDescription,
      fullDescription,
      specifications,
      price,
      currency,
      discountPercentage,
      costPrice,
      minimumOrderQuantity,
      maximumOrderQuantity,
      stockQuantity,
      lowStockThreshold,
      isDigital,
      digitalFileUrl,
      digitalFileSizeMb,
      subscriptionDurationMonths,
      trialPeriodDays,
      weightKg,
      dimensions,
      shippingRequired,
      shippingCost,
      freeShippingThreshold,
      tags,
      targetAudience,
      ageGroup,
      curriculumCompatibility,
      gradeLevels,
      subjects,
      productImages,
      productVideos,
      productDocuments,
      seoKeywords,
      metaDescription,
      promotionText
    });

    res.status(201).json({
      success: true,
      data: { product },
      message: 'Product created successfully'
    });
  });

  // Get products
  getProducts = asyncHandler(async (req, res) => {
    const {
      categoryId,
      vendorId,
      productType,
      status,
      approvalStatus,
      featured,
      priceMin,
      priceMax,
      tags,
      targetAudience,
      curriculumCompatibility,
      search,
      sortBy,
      sortOrder,
      page,
      limit
    } = req.query;

    const products = await marketplaceService.getProducts({
      categoryId,
      vendorId,
      productType,
      status,
      approvalStatus,
      featured: featured === 'true',
      priceMin: priceMin ? parseFloat(priceMin) : undefined,
      priceMax: priceMax ? parseFloat(priceMax) : undefined,
      tags: tags ? tags.split(',') : undefined,
      targetAudience: targetAudience ? targetAudience.split(',') : undefined,
      curriculumCompatibility: curriculumCompatibility ? curriculumCompatibility.split(',') : undefined,
      search,
      sortBy,
      sortOrder,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20
    });

    res.json({
      success: true,
      data: {
        products,
        pagination: {
          page: parseInt(page) || 1,
          limit: parseInt(limit) || 20,
          hasMore: products.length === (parseInt(limit) || 20)
        }
      },
      message: 'Products retrieved successfully'
    });
  });

  // Get product details
  getProduct = asyncHandler(async (req, res) => {
    const { productId } = req.params;
    
    const product = await marketplaceService.getProductById(productId);

    res.json({
      success: true,
      data: { product },
      message: 'Product details retrieved successfully'
    });
  });

  // Update product approval
  updateProductApproval = asyncHandler(async (req, res) => {
    const { productId } = req.params;
    const { approvalStatus, approvalNotes } = req.body;

    if (!approvalStatus) {
      throw new ValidationError('Approval status is required');
    }

    const product = await marketplaceService.updateProductApproval(productId, {
      approvalStatus,
      approvalNotes,
      approvedBy: req.user.userId
    });

    res.json({
      success: true,
      data: { product },
      message: 'Product approval updated successfully'
    });
  });

  // Update product (owner vendor or admin)
  updateProduct = asyncHandler(async (req, res) => {
    const { productId } = req.params;
    const updates = req.body;

    const product = await marketplaceService.updateProduct(productId, req.user, updates);

    res.json({
      success: true,
      data: { product },
      message: 'Product updated successfully'
    });
  });

  // Delete product (owner vendor or admin)
  deleteProduct = asyncHandler(async (req, res) => {
    const { productId } = req.params;
    await marketplaceService.deleteProduct(productId, req.user);
    res.json({ success: true, message: 'Product deleted successfully' });
  });

  /**
   * Shopping Cart Management
   */

  // Add item to cart
  addToCart = asyncHandler(async (req, res) => {
    const { productId, quantity } = req.body;

    if (!productId || !quantity || quantity < 1) {
      throw new ValidationError('Product ID and valid quantity are required');
    }

    const cartItem = await marketplaceService.addToCart(req.user.userId, productId, quantity);

    res.status(201).json({
      success: true,
      data: { cartItem },
      message: 'Item added to cart successfully'
    });
  });

  // Get user's cart
  getCart = asyncHandler(async (req, res) => {
    const cartItems = await marketplaceService.getCart(req.user.userId);

    // Calculate cart totals
    const subtotal = cartItems.reduce((total, item) => total + parseFloat(item.total_price), 0);
    const totalShipping = cartItems.reduce((total, item) => 
      total + (item.shipping_cost * item.quantity), 0
    );
    const totalItems = cartItems.reduce((total, item) => total + item.quantity, 0);

    res.json({
      success: true,
      data: {
        cartItems,
        summary: {
          totalItems,
          subtotal,
          totalShipping,
          total: subtotal + totalShipping
        }
      },
      message: 'Cart retrieved successfully'
    });
  });

  // Update cart item
  updateCartItem = asyncHandler(async (req, res) => {
    const { productId } = req.params;
    const { quantity } = req.body;

    if (quantity < 0) {
      throw new ValidationError('Quantity must be non-negative');
    }

    const cartItem = await marketplaceService.updateCartItem(req.user.userId, productId, quantity);

    res.json({
      success: true,
      data: { cartItem },
      message: 'Cart item updated successfully'
    });
  });

  // Remove item from cart
  removeFromCart = asyncHandler(async (req, res) => {
    const { productId } = req.params;

    await marketplaceService.removeFromCart(req.user.userId, productId);

    res.json({
      success: true,
      message: 'Item removed from cart successfully'
    });
  });

  // Clear cart
  clearCart = asyncHandler(async (req, res) => {
    await marketplaceService.clearCart(req.user.userId);

    res.json({
      success: true,
      message: 'Cart cleared successfully'
    });
  });

  /**
   * Order Management
   */

  // Create order from cart
  createOrder = asyncHandler(async (req, res) => {
    const {
      shippingAddress,
      billingAddress,
      paymentMethod,
      customerNotes,
      couponCode
    } = req.body;

    // Validate required fields
    if (!shippingAddress || !paymentMethod) {
      throw new ValidationError('Shipping address and payment method are required');
    }

    // Get cart items
    const cartItems = await marketplaceService.getCart(req.user.userId);
    
    if (cartItems.length === 0) {
      throw new ValidationError('Cart is empty');
    }

    const orders = await marketplaceService.createOrder({
      customerId: req.user.userId,
      schoolId: req.user.schoolId,
      cartItems,
      shippingAddress,
      billingAddress: billingAddress || shippingAddress,
      paymentMethod,
      customerNotes,
      couponCode
    });

    // Send order confirmation notifications
    try {
      for (const order of orders) {
        await realtimeIntegrations.createCustomEvent({
          eventType: 'marketplace_order_created',
          schoolId: req.user.schoolId,
          sourceUserId: req.user.userId,
          targetUserIds: [req.user.userId],
          title: 'Order Confirmation',
          message: `Your order ${order.order_number} has been placed successfully`,
          eventPayload: {
            orderId: order.id,
            orderNumber: order.order_number,
            totalAmount: order.total_amount,
            estimatedDelivery: order.estimated_delivery_date
          },
          priority: 'normal',
          sourceEntityType: 'marketplace_order',
          sourceEntityId: order.id,
          actionUrl: `/marketplace/orders/${order.id}`
        });
      }
    } catch (error) {
      console.error('Failed to send order confirmation notification:', error);
    }

    res.status(201).json({
      success: true,
      data: { orders },
      message: 'Order placed successfully'
    });
  });

  // List orders (admin can filter by vendor/status; customers see own orders)
  getOrders = asyncHandler(async (req, res) => {
    const { status, vendorId, page, limit } = req.query;

    const orders = await marketplaceService.getOrders({
      requester: req.user,
      status,
      vendorId,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
    });

    res.json({
      success: true,
      data: { orders, pagination: { page: parseInt(page) || 1, limit: parseInt(limit) || 20, hasMore: orders.length === (parseInt(limit) || 20) } },
      message: 'Orders retrieved successfully',
    });
  });

  // Get order details
  getOrderById = asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    const order = await marketplaceService.getOrderById(orderId, req.user);
    res.json({ success: true, data: { order }, message: 'Order details retrieved successfully' });
  });

  // Update order status / shipping info
  updateOrderStatus = asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    const { orderStatus, shippingStatus, trackingNumber, shippingCarrier, estimatedDeliveryDate } = req.body;

    const updated = await marketplaceService.updateOrderStatus(orderId, req.user, {
      orderStatus,
      shippingStatus,
      trackingNumber,
      shippingCarrier,
      estimatedDeliveryDate,
    });

    res.json({ success: true, data: { order: updated }, message: 'Order updated successfully' });
  });

  /**
   * Review Management
   */

  // Create product review
  createReview = asyncHandler(async (req, res) => {
    const { productId } = req.params;
    const {
      orderItemId,
      rating,
      reviewTitle,
      reviewText,
      pros,
      cons,
      wouldRecommend,
      images
    } = req.body;

    // Validate required fields
    if (!rating || rating < 1 || rating > 5) {
      throw new ValidationError('Rating between 1 and 5 is required');
    }

    const review = await marketplaceService.createReview({
      productId,
      orderItemId,
      reviewerId: req.user.userId,
      rating,
      reviewTitle,
      reviewText,
      pros,
      cons,
      wouldRecommend,
      images
    });

    res.status(201).json({
      success: true,
      data: { review },
      message: 'Review submitted successfully'
    });
  });

  /**
   * Wishlist Management
   */

  // Add to wishlist
  addToWishlist = asyncHandler(async (req, res) => {
    const { productId } = req.params;
    const { wishlistId } = req.body;

    const wishlistItem = await marketplaceService.addToWishlist(req.user.userId, productId, wishlistId);

    res.status(201).json({
      success: true,
      data: { wishlistItem },
      message: 'Product added to wishlist successfully'
    });
  });

  // Remove from wishlist
  removeFromWishlist = asyncHandler(async (req, res) => {
    const { productId } = req.params;
    const { wishlistId } = req.body;

    await marketplaceService.removeFromWishlist(req.user.userId, productId, wishlistId);

    res.json({
      success: true,
      message: 'Product removed from wishlist successfully'
    });
  });

  /**
   * Search and Discovery
   */

  // Search products
  searchProducts = asyncHandler(async (req, res) => {
    const {
      q: searchQuery,
      categoryId,
      priceMin,
      priceMax,
      rating,
      sortBy,
      page,
      limit
    } = req.query;

    if (!searchQuery || searchQuery.trim().length < 2) {
      throw new ValidationError('Search query must be at least 2 characters long');
    }

    const products = await marketplaceService.searchProducts(searchQuery.trim(), {
      categoryId,
      priceMin: priceMin ? parseFloat(priceMin) : undefined,
      priceMax: priceMax ? parseFloat(priceMax) : undefined,
      rating: rating ? parseFloat(rating) : undefined,
      sortBy,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20
    });

    res.json({
      success: true,
      data: {
        products,
        searchQuery,
        pagination: {
          page: parseInt(page) || 1,
          limit: parseInt(limit) || 20,
          hasMore: products.length === (parseInt(limit) || 20)
        }
      },
      message: 'Search completed successfully'
    });
  });

  /**
   * Analytics and Reports
   */

  // Get marketplace analytics
  getMarketplaceAnalytics = asyncHandler(async (req, res) => {
    const {
      startDate,
      endDate
    } = req.query;

    // Default to last 30 days if no dates provided
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const analytics = await marketplaceService.getMarketplaceAnalytics(
      start.toISOString().split('T')[0],
      end.toISOString().split('T')[0]
    );

    res.json({
      success: true,
      data: {
        analytics,
        period: {
          startDate: start.toISOString(),
          endDate: end.toISOString()
        },
        generatedAt: new Date().toISOString()
      },
      message: 'Marketplace analytics retrieved successfully'
    });
  });

  /**
   * Public Endpoints (No Authentication Required)
   */

  // Get public product catalog
  getPublicProducts = asyncHandler(async (req, res) => {
    const {
      categoryId,
      productType,
      featured,
      search,
      sortBy,
      page,
      limit
    } = req.query;

    const products = await marketplaceService.getProducts({
      categoryId,
      productType,
      status: 'active',
      approvalStatus: 'approved',
      featured: featured === 'true',
      search,
      sortBy: sortBy || 'featured',
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 12
    });

    // Remove sensitive information for public endpoint
    const publicProducts = products.map(product => ({
      id: product.id,
      product_name: product.product_name,
      product_code: product.product_code,
      product_type: product.product_type,
      short_description: product.short_description,
      price: product.price,
      effective_price: product.effective_price,
      currency: product.currency,
      discount_percentage: product.discount_percentage,
      rating: product.rating,
      review_count: product.review_count,
      product_images: product.product_images,
      vendor_name: product.vendor_name,
      category_name: product.category_name,
      in_stock: product.in_stock,
      tags: product.tags,
      target_audience: product.target_audience,
      curriculum_compatibility: product.curriculum_compatibility
    }));

    res.json({
      success: true,
      data: {
        products: publicProducts,
        pagination: {
          page: parseInt(page) || 1,
          limit: parseInt(limit) || 12,
          hasMore: products.length === (parseInt(limit) || 12)
        }
      },
      message: 'Public product catalog retrieved successfully'
    });
  });

  // Get public categories
  getPublicCategories = asyncHandler(async (req, res) => {
    const categories = await marketplaceService.getCategories({
      includeInactive: false
    });

    // Remove sensitive information for public endpoint
    const publicCategories = categories.map(category => ({
      id: category.id,
      category_name: category.category_name,
      category_code: category.category_code,
      category_type: category.category_type,
      description: category.description,
      parent_category_id: category.parent_category_id,
      parent_category_name: category.parent_category_name,
      product_count: category.product_count,
      subcategory_count: category.subcategory_count,
      icon_url: category.icon_url,
      banner_url: category.banner_url
    }));

    res.json({
      success: true,
      data: { categories: publicCategories },
      message: 'Public categories retrieved successfully'
    });
  });

  /**
   * Health Check
   */

  // Get marketplace service health
  getMarketplaceHealth = asyncHandler(async (req, res) => {
    const analytics = await marketplaceService.getMarketplaceAnalytics(
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      new Date().toISOString().split('T')[0]
    );

    res.json({
      success: true,
      data: {
        service: 'Marketplace Management Service',
        status: 'healthy',
        features: [
          'product_catalog',
          'vendor_management',
          'shopping_cart',
          'order_processing',
          'review_system',
          'wishlist_management',
          'search_discovery',
          'analytics_reporting',
          'public_catalog',
          'coupon_system'
        ],
        metrics: {
          totalProducts: analytics.total_products,
          activeProducts: analytics.active_products,
          totalVendors: analytics.total_vendors,
          verifiedVendors: analytics.verified_vendors,
          totalOrders: analytics.total_orders,
          totalRevenue: parseFloat(analytics.total_revenue) || 0,
          avgOrderValue: parseFloat(analytics.avg_order_value) || 0,
          avgProductRating: parseFloat(analytics.avg_product_rating) || 0
        },
        timestamp: new Date().toISOString()
      },
      message: 'Marketplace service health check completed'
    });
  });
}

module.exports = new MarketplaceController();