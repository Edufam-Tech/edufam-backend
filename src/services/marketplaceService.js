const { query } = require('../config/database');
const { ValidationError, NotFoundError, ConflictError } = require('../middleware/errorHandler');

/**
 * Marketplace Service
 * Handles e-commerce operations, vendor management, and product catalog
 */
class MarketplaceService {

  /**
   * Category Management
   */
  async createCategory({
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
  }) {
    const result = await query(`
      INSERT INTO marketplace_categories (
        category_name, category_code, parent_category_id, description,
        category_type, commission_rate, display_order, icon_url, banner_url, seo_keywords
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      categoryName, categoryCode, parentCategoryId, description,
      categoryType, commissionRate, displayOrder, iconUrl, bannerUrl, seoKeywords
    ]);

    return result.rows[0];
  }

  async getCategories({ categoryType, parentId, includeInactive = false } = {}) {
    let whereConditions = [];
    let params = [];
    let paramCount = 0;

    if (categoryType) {
      whereConditions.push(`category_type = $${++paramCount}`);
      params.push(categoryType);
    }

    if (parentId) {
      whereConditions.push(`parent_category_id = $${++paramCount}`);
      params.push(parentId);
    } else if (parentId === null) {
      whereConditions.push('parent_category_id IS NULL');
    }

    if (!includeInactive) {
      whereConditions.push('is_active = true');
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const result = await query(`
      SELECT 
        c.*,
        pc.category_name as parent_category_name,
        (SELECT COUNT(*) FROM marketplace_categories sc WHERE sc.parent_category_id = c.id) as subcategory_count,
        (SELECT COUNT(*) FROM marketplace_products p WHERE p.category_id = c.id AND p.status = 'active') as product_count
      FROM marketplace_categories c
      LEFT JOIN marketplace_categories pc ON c.parent_category_id = pc.id
      ${whereClause}
      ORDER BY c.display_order, c.category_name
    `, params);

    return result.rows;
  }

  /**
   * Vendor Management
   */
  async createVendor({
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
    socialMediaLinks,
    createdBy
  }) {
    const result = await query(`
      INSERT INTO marketplace_vendors (
        vendor_name, vendor_code, vendor_type, contact_person_id,
        business_name, business_registration_number, tax_identification_number,
        email, phone, website_url, description, address, bank_account_details,
        logo_url, banner_url, social_media_links, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *
    `, [
      vendorName, vendorCode, vendorType, contactPersonId,
      businessName, businessRegistrationNumber, taxIdentificationNumber,
      email, phone, websiteUrl, description, JSON.stringify(address), 
      JSON.stringify(bankAccountDetails), logoUrl, bannerUrl, 
      JSON.stringify(socialMediaLinks), createdBy
    ]);

    return result.rows[0];
  }

  async getVendors({
    vendorType,
    verificationStatus,
    status,
    featured,
    search,
    page = 1,
    limit = 20
  } = {}) {
    let whereConditions = [];
    let params = [];
    let paramCount = 0;

    if (vendorType) {
      whereConditions.push(`vendor_type = $${++paramCount}`);
      params.push(vendorType);
    }

    if (verificationStatus) {
      whereConditions.push(`verification_status = $${++paramCount}`);
      params.push(verificationStatus);
    }

    if (status) {
      whereConditions.push(`status = $${++paramCount}`);
      params.push(status);
    }

    if (featured) {
      whereConditions.push('featured_vendor = true');
    }

    if (search) {
      whereConditions.push(`(vendor_name ILIKE $${++paramCount} OR business_name ILIKE $${++paramCount} OR description ILIKE $${++paramCount})`);
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
      paramCount += 2; // We used 3 parameters but only incremented once
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    const offset = (page - 1) * limit;

    params.push(limit, offset);

    const result = await query(`
      SELECT 
        v.*,
        u.first_name as contact_first_name,
        u.last_name as contact_last_name,
        u.email as contact_email,
        (SELECT COUNT(*) FROM marketplace_products p WHERE p.vendor_id = v.id AND p.status = 'active') as active_products,
        (SELECT AVG(rating) FROM marketplace_reviews r 
         JOIN marketplace_products p ON r.product_id = p.id 
         WHERE p.vendor_id = v.id) as average_product_rating
      FROM marketplace_vendors v
      LEFT JOIN users u ON v.contact_person_id = u.id
      ${whereClause}
      ORDER BY v.featured_vendor DESC, v.rating DESC, v.vendor_name
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `, params);

    return result.rows;
  }

  async updateVendorVerification(vendorId, { verificationStatus, verificationDocuments, verificationNotes }) {
    const result = await query(`
      UPDATE marketplace_vendors 
      SET 
        verification_status = $2,
        verification_date = CASE WHEN $2 = 'verified' THEN NOW() ELSE verification_date END,
        verification_documents = $3
      WHERE id = $1
      RETURNING *
    `, [vendorId, verificationStatus, JSON.stringify(verificationDocuments)]);

    if (result.rows.length === 0) {
      throw new NotFoundError('Vendor not found');
    }

    return result.rows[0];
  }

  /**
   * Product Management
   */
  async createProduct({
    vendorId,
    categoryId,
    productName,
    productCode,
    productType,
    shortDescription,
    fullDescription,
    specifications,
    price,
    currency = 'KES',
    discountPercentage,
    costPrice,
    minimumOrderQuantity = 1,
    maximumOrderQuantity,
    stockQuantity = 0,
    lowStockThreshold = 10,
    isDigital = false,
    digitalFileUrl,
    digitalFileSizeMb,
    subscriptionDurationMonths,
    trialPeriodDays = 0,
    weightKg,
    dimensions,
    shippingRequired = true,
    shippingCost = 0,
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
  }) {
    // Calculate discounted price if discount is provided
    const discountedPrice = discountPercentage > 0 ? 
      price * (1 - discountPercentage / 100) : null;

    const result = await query(`
      INSERT INTO marketplace_products (
        vendor_id, category_id, product_name, product_code, product_type,
        short_description, full_description, specifications, price, currency,
        discount_percentage, discounted_price, cost_price, minimum_order_quantity,
        maximum_order_quantity, stock_quantity, low_stock_threshold, is_digital,
        digital_file_url, digital_file_size_mb, subscription_duration_months,
        trial_period_days, weight_kg, dimensions, shipping_required, shipping_cost,
        free_shipping_threshold, tags, target_audience, age_group, curriculum_compatibility,
        grade_levels, subjects, product_images, product_videos, product_documents,
        seo_keywords, meta_description, promotion_text
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
        $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32,
        $33, $34, $35, $36, $37, $38, $39
      )
      RETURNING *
    `, [
      vendorId, categoryId, productName, productCode, productType,
      shortDescription, fullDescription, JSON.stringify(specifications), price, currency,
      discountPercentage, discountedPrice, costPrice, minimumOrderQuantity,
      maximumOrderQuantity, stockQuantity, lowStockThreshold, isDigital,
      digitalFileUrl, digitalFileSizeMb, subscriptionDurationMonths,
      trialPeriodDays, weightKg, JSON.stringify(dimensions), shippingRequired, shippingCost,
      freeShippingThreshold, tags, targetAudience, ageGroup, curriculumCompatibility,
      gradeLevels, subjects, JSON.stringify(productImages), JSON.stringify(productVideos), 
      JSON.stringify(productDocuments), seoKeywords, metaDescription, promotionText
    ]);

    return result.rows[0];
  }

  async getProducts({
    categoryId,
    vendorId,
    productType,
    status = 'active',
    approvalStatus = 'approved',
    featured,
    priceMin,
    priceMax,
    tags,
    targetAudience,
    curriculumCompatibility,
    search,
    sortBy = 'created_at',
    sortOrder = 'desc',
    page = 1,
    limit = 20
  } = {}) {
    let whereConditions = ['p.status = $1', 'p.approval_status = $2'];
    let params = [status, approvalStatus];
    let paramCount = 2;

    if (categoryId) {
      whereConditions.push(`p.category_id = $${++paramCount}`);
      params.push(categoryId);
    }

    if (vendorId) {
      whereConditions.push(`p.vendor_id = $${++paramCount}`);
      params.push(vendorId);
    }

    if (productType) {
      whereConditions.push(`p.product_type = $${++paramCount}`);
      params.push(productType);
    }

    if (featured) {
      whereConditions.push('p.featured_product = true');
    }

    if (priceMin) {
      whereConditions.push(`p.price >= $${++paramCount}`);
      params.push(priceMin);
    }

    if (priceMax) {
      whereConditions.push(`p.price <= $${++paramCount}`);
      params.push(priceMax);
    }

    if (tags && tags.length > 0) {
      whereConditions.push(`p.tags && $${++paramCount}`);
      params.push(tags);
    }

    if (targetAudience && targetAudience.length > 0) {
      whereConditions.push(`p.target_audience && $${++paramCount}`);
      params.push(targetAudience);
    }

    if (curriculumCompatibility && curriculumCompatibility.length > 0) {
      whereConditions.push(`p.curriculum_compatibility && $${++paramCount}`);
      params.push(curriculumCompatibility);
    }

    if (search) {
      whereConditions.push(`(
        p.product_name ILIKE $${++paramCount} OR 
        p.short_description ILIKE $${++paramCount} OR 
        p.full_description ILIKE $${++paramCount} OR
        array_to_string(p.tags, ' ') ILIKE $${++paramCount}
      )`);
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
      paramCount += 3; // We used 4 parameters but only incremented once
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
    const offset = (page - 1) * limit;

    // Validate sort options
    const validSortColumns = ['created_at', 'price', 'rating', 'sales_count', 'product_name'];
    const validSortOrders = ['asc', 'desc'];
    
    if (!validSortColumns.includes(sortBy)) {
      sortBy = 'created_at';
    }
    if (!validSortOrders.includes(sortOrder.toLowerCase())) {
      sortOrder = 'desc';
    }

    params.push(limit, offset);

    const result = await query(`
      SELECT 
        p.*,
        c.category_name,
        c.category_type,
        v.vendor_name,
        v.business_name,
        v.rating as vendor_rating,
        CASE 
          WHEN p.discount_percentage > 0 THEN p.discounted_price 
          ELSE p.price 
        END as effective_price,
        CASE 
          WHEN p.stock_quantity > 0 OR p.is_digital THEN true 
          ELSE false 
        END as in_stock,
        (SELECT COUNT(*) FROM marketplace_reviews r WHERE r.product_id = p.id AND r.moderation_status = 'approved') as review_count
      FROM marketplace_products p
      JOIN marketplace_categories c ON p.category_id = c.id
      JOIN marketplace_vendors v ON p.vendor_id = v.id
      ${whereClause}
      ORDER BY p.${sortBy} ${sortOrder.toUpperCase()}
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `, params);

    return result.rows;
  }

  async getProductById(productId) {
    const result = await query(`
      SELECT 
        p.*,
        c.category_name,
        c.category_type,
        c.commission_rate as category_commission,
        v.vendor_name,
        v.business_name,
        v.vendor_type,
        v.rating as vendor_rating,
        v.total_sales as vendor_total_sales,
        CASE 
          WHEN p.discount_percentage > 0 THEN p.discounted_price 
          ELSE p.price 
        END as effective_price,
        CASE 
          WHEN p.stock_quantity > 0 OR p.is_digital THEN true 
          ELSE false 
        END as in_stock,
        (SELECT COUNT(*) FROM marketplace_reviews r WHERE r.product_id = p.id AND r.moderation_status = 'approved') as review_count,
        (SELECT AVG(rating) FROM marketplace_reviews r WHERE r.product_id = p.id AND r.moderation_status = 'approved') as average_rating
      FROM marketplace_products p
      JOIN marketplace_categories c ON p.category_id = c.id
      JOIN marketplace_vendors v ON p.vendor_id = v.id
      WHERE p.id = $1
    `, [productId]);

    if (result.rows.length === 0) {
      throw new NotFoundError('Product not found');
    }

    // Increment view count
    await query('UPDATE marketplace_products SET view_count = view_count + 1 WHERE id = $1', [productId]);

    return result.rows[0];
  }

  async updateProductApproval(productId, { approvalStatus, approvalNotes, approvedBy }) {
    const result = await query(`
      UPDATE marketplace_products 
      SET 
        approval_status = $2,
        approval_notes = $3,
        approved_by = $4,
        approved_at = CASE WHEN $2 = 'approved' THEN NOW() ELSE null END,
        published_at = CASE WHEN $2 = 'approved' AND status = 'active' THEN NOW() ELSE published_at END
      WHERE id = $1
      RETURNING *
    `, [productId, approvalStatus, approvalNotes, approvedBy]);

    if (result.rows.length === 0) {
      throw new NotFoundError('Product not found');
    }

    return result.rows[0];
  }

  /**
   * Shopping Cart Management
   */
  async addToCart(userId, productId, quantity = 1) {
    // Check if product exists and is available
    const productResult = await query(`
      SELECT price, stock_quantity, is_digital, minimum_order_quantity, maximum_order_quantity, status, approval_status
      FROM marketplace_products 
      WHERE id = $1
    `, [productId]);

    if (productResult.rows.length === 0) {
      throw new NotFoundError('Product not found');
    }

    const product = productResult.rows[0];

    if (product.status !== 'active' || product.approval_status !== 'approved') {
      throw new ValidationError('Product is not available for purchase');
    }

    if (!product.is_digital && product.stock_quantity < quantity) {
      throw new ValidationError('Insufficient stock available');
    }

    if (quantity < product.minimum_order_quantity) {
      throw new ValidationError(`Minimum order quantity is ${product.minimum_order_quantity}`);
    }

    if (product.maximum_order_quantity && quantity > product.maximum_order_quantity) {
      throw new ValidationError(`Maximum order quantity is ${product.maximum_order_quantity}`);
    }

    // Add or update cart item
    const result = await query(`
      INSERT INTO marketplace_cart (user_id, product_id, quantity, unit_price)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id, product_id) 
      DO UPDATE SET 
        quantity = $3,
        unit_price = $4,
        updated_at = NOW()
      RETURNING *
    `, [userId, productId, quantity, product.price]);

    return result.rows[0];
  }

  async getCart(userId) {
    const result = await query(`
      SELECT 
        c.*,
        p.product_name,
        p.short_description,
        p.product_images,
        p.stock_quantity,
        p.is_digital,
        p.status as product_status,
        p.approval_status,
        p.shipping_cost,
        p.weight_kg,
        v.vendor_name,
        CASE 
          WHEN p.discount_percentage > 0 THEN p.discounted_price 
          ELSE p.price 
        END as current_price,
        c.quantity * (CASE 
          WHEN p.discount_percentage > 0 THEN p.discounted_price 
          ELSE p.price 
        END) as total_price
      FROM marketplace_cart c
      JOIN marketplace_products p ON c.product_id = p.id
      JOIN marketplace_vendors v ON p.vendor_id = v.id
      WHERE c.user_id = $1
      ORDER BY c.updated_at DESC
    `, [userId]);

    return result.rows;
  }

  async updateCartItem(userId, productId, quantity) {
    if (quantity <= 0) {
      return await this.removeFromCart(userId, productId);
    }

    const result = await query(`
      UPDATE marketplace_cart 
      SET quantity = $3, updated_at = NOW()
      WHERE user_id = $1 AND product_id = $2
      RETURNING *
    `, [userId, productId, quantity]);

    if (result.rows.length === 0) {
      throw new NotFoundError('Cart item not found');
    }

    return result.rows[0];
  }

  async removeFromCart(userId, productId) {
    const result = await query(`
      DELETE FROM marketplace_cart 
      WHERE user_id = $1 AND product_id = $2
      RETURNING *
    `, [userId, productId]);

    if (result.rows.length === 0) {
      throw new NotFoundError('Cart item not found');
    }

    return result.rows[0];
  }

  async clearCart(userId) {
    await query('DELETE FROM marketplace_cart WHERE user_id = $1', [userId]);
    return true;
  }

  /**
   * Order Management
   */
  async createOrder({
    customerId,
    schoolId,
    cartItems,
    shippingAddress,
    billingAddress,
    paymentMethod,
    customerNotes,
    couponCode
  }) {
    // Generate order number
    const orderNumber = await this.generateOrderNumber();

    // Calculate totals from cart items
    let subtotal = 0;
    let totalShipping = 0;
    let totalWeight = 0;
    const ordersByVendor = {};

    // Group items by vendor for separate orders
    for (const item of cartItems) {
      const product = await this.getProductById(item.product_id);
      
      if (!ordersByVendor[product.vendor_id]) {
        ordersByVendor[product.vendor_id] = {
          vendorId: product.vendor_id,
          items: [],
          subtotal: 0,
          shipping: 0,
          weight: 0
        };
      }

      const itemTotal = product.effective_price * item.quantity;
      const itemWeight = (product.weight_kg || 0) * item.quantity;

      ordersByVendor[product.vendor_id].items.push({
        ...item,
        product,
        itemTotal
      });
      ordersByVendor[product.vendor_id].subtotal += itemTotal;
      ordersByVendor[product.vendor_id].weight += itemWeight;

      subtotal += itemTotal;
      totalWeight += itemWeight;
    }

    // Apply coupon if provided
    let discountAmount = 0;
    let appliedCoupon = null;
    if (couponCode) {
      appliedCoupon = await this.validateAndApplyCoupon(couponCode, customerId, subtotal);
      discountAmount = appliedCoupon.discountAmount;
    }

    // Calculate shipping for each vendor
    for (const vendorOrder of Object.values(ordersByVendor)) {
      // Simple shipping calculation - could be more sophisticated
      if (vendorOrder.weight > 0) {
        vendorOrder.shipping = Math.max(500, vendorOrder.weight * 50); // Base shipping + weight-based
      }
      totalShipping += vendorOrder.shipping;
    }

    const taxAmount = 0; // Implement tax calculation as needed
    const totalAmount = subtotal + totalShipping + taxAmount - discountAmount;

    // Create orders for each vendor
    const createdOrders = [];

    for (const vendorOrder of Object.values(ordersByVendor)) {
      const vendorOrderNumber = `${orderNumber}-V${vendorOrder.vendorId.slice(-4)}`;
      const vendorTotal = vendorOrder.subtotal + vendorOrder.shipping;
      
      const orderResult = await query(`
        INSERT INTO marketplace_orders (
          order_number, customer_id, school_id, vendor_id, subtotal, 
          discount_amount, shipping_cost, tax_amount, total_amount,
          payment_method, customer_notes, shipping_address, billing_address
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
      `, [
        vendorOrderNumber, customerId, schoolId, vendorOrder.vendorId,
        vendorOrder.subtotal, discountAmount, vendorOrder.shipping,
        taxAmount, vendorTotal, paymentMethod, customerNotes,
        JSON.stringify(shippingAddress), JSON.stringify(billingAddress)
      ]);

      const order = orderResult.rows[0];

      // Add order items
      for (const item of vendorOrder.items) {
        await query(`
          INSERT INTO marketplace_order_items (
            order_id, product_id, quantity, unit_price, total_price,
            product_name, product_description, product_specifications
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
          order.id, item.product.id, item.quantity, item.product.effective_price,
          item.itemTotal, item.product.product_name, item.product.short_description,
          item.product.specifications
        ]);
      }

      // Record coupon usage if applicable
      if (appliedCoupon) {
        await query(`
          INSERT INTO marketplace_coupon_usage (coupon_id, order_id, user_id, discount_applied)
          VALUES ($1, $2, $3, $4)
        `, [appliedCoupon.id, order.id, customerId, discountAmount]);
      }

      createdOrders.push(order);
    }

    // Clear cart after successful order creation
    await this.clearCart(customerId);

    return createdOrders;
  }

  async generateOrderNumber() {
    const today = new Date();
    const year = today.getFullYear().toString().slice(-2);
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const day = today.getDate().toString().padStart(2, '0');
    
    const datePrefix = `ORD${year}${month}${day}`;
    
    // Find the next sequence number for today
    const result = await query(`
      SELECT order_number 
      FROM marketplace_orders 
      WHERE order_number LIKE $1 
      ORDER BY order_number DESC 
      LIMIT 1
    `, [`${datePrefix}%`]);

    let sequence = 1;
    if (result.rows.length > 0) {
      const lastOrderNumber = result.rows[0].order_number;
      const lastSequence = parseInt(lastOrderNumber.slice(-4));
      sequence = lastSequence + 1;
    }

    return `${datePrefix}${sequence.toString().padStart(4, '0')}`;
  }

  /**
   * Review Management
   */
  async createReview({
    productId,
    orderItemId,
    reviewerId,
    rating,
    reviewTitle,
    reviewText,
    pros,
    cons,
    wouldRecommend,
    images
  }) {
    // Verify that the reviewer actually purchased the product
    let verifiedPurchase = false;
    if (orderItemId) {
      const purchaseCheck = await query(`
        SELECT oi.* FROM marketplace_order_items oi
        JOIN marketplace_orders o ON oi.order_id = o.id
        WHERE oi.id = $1 AND oi.product_id = $2 AND o.customer_id = $3
      `, [orderItemId, productId, reviewerId]);
      
      verifiedPurchase = purchaseCheck.rows.length > 0;
    }

    // Get vendor ID for the product
    const vendorResult = await query('SELECT vendor_id FROM marketplace_products WHERE id = $1', [productId]);
    if (vendorResult.rows.length === 0) {
      throw new NotFoundError('Product not found');
    }

    const result = await query(`
      INSERT INTO marketplace_reviews (
        product_id, order_item_id, reviewer_id, vendor_id, rating,
        review_title, review_text, pros, cons, would_recommend,
        verified_purchase, images
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `, [
      productId, orderItemId, reviewerId, vendorResult.rows[0].vendor_id,
      rating, reviewTitle, reviewText, pros, cons, wouldRecommend,
      verifiedPurchase, JSON.stringify(images)
    ]);

    // Update product rating
    await this.updateProductRating(productId);

    return result.rows[0];
  }

  async updateProductRating(productId) {
    await query(`
      UPDATE marketplace_products 
      SET 
        rating = (
          SELECT COALESCE(AVG(rating), 0) 
          FROM marketplace_reviews 
          WHERE product_id = $1 AND moderation_status = 'approved'
        ),
        review_count = (
          SELECT COUNT(*) 
          FROM marketplace_reviews 
          WHERE product_id = $1 AND moderation_status = 'approved'
        )
      WHERE id = $1
    `, [productId]);
  }

  /**
   * Wishlist Management
   */
  async addToWishlist(userId, productId, wishlistId = null) {
    // Get default wishlist if none specified
    if (!wishlistId) {
      let wishlistResult = await query(`
        SELECT id FROM marketplace_wishlists 
        WHERE user_id = $1 AND is_default = true
      `, [userId]);

      if (wishlistResult.rows.length === 0) {
        // Create default wishlist
        wishlistResult = await query(`
          INSERT INTO marketplace_wishlists (user_id, wishlist_name, is_default)
          VALUES ($1, 'My Wishlist', true)
          RETURNING id
        `, [userId]);
      }

      wishlistId = wishlistResult.rows[0].id;
    }

    // Get current product price
    const productResult = await query('SELECT price FROM marketplace_products WHERE id = $1', [productId]);
    if (productResult.rows.length === 0) {
      throw new NotFoundError('Product not found');
    }

    const result = await query(`
      INSERT INTO marketplace_wishlist_items (wishlist_id, product_id, price_when_added)
      VALUES ($1, $2, $3)
      ON CONFLICT (wishlist_id, product_id) DO NOTHING
      RETURNING *
    `, [wishlistId, productId, productResult.rows[0].price]);

    return result.rows[0];
  }

  async removeFromWishlist(userId, productId, wishlistId = null) {
    let whereClause = 'wi.product_id = $2';
    let params = [userId, productId];

    if (wishlistId) {
      whereClause += ' AND wi.wishlist_id = $3';
      params.push(wishlistId);
    }

    const result = await query(`
      DELETE FROM marketplace_wishlist_items wi
      WHERE wi.wishlist_id IN (
        SELECT id FROM marketplace_wishlists WHERE user_id = $1
      ) AND ${whereClause}
      RETURNING *
    `, params);

    return result.rows[0];
  }

  /**
   * Analytics
   */
  async getMarketplaceAnalytics(startDate, endDate) {
    const result = await query(`
      WITH order_stats AS (
        SELECT 
          COUNT(*) as total_orders,
          SUM(total_amount) as total_revenue,
          AVG(total_amount) as avg_order_value,
          COUNT(DISTINCT customer_id) as unique_customers
        FROM marketplace_orders
        WHERE order_date >= $1 AND order_date <= $2
      ),
      product_stats AS (
        SELECT 
          COUNT(*) as total_products,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active_products,
          AVG(rating) as avg_product_rating
        FROM marketplace_products
      ),
      vendor_stats AS (
        SELECT 
          COUNT(*) as total_vendors,
          COUNT(CASE WHEN verification_status = 'verified' THEN 1 END) as verified_vendors
        FROM marketplace_vendors
      )
      SELECT 
        os.*,
        ps.*,
        vs.*
      FROM order_stats os, product_stats ps, vendor_stats vs
    `, [startDate, endDate]);

    return result.rows[0];
  }

  /**
   * Coupon Management
   */
  async validateAndApplyCoupon(couponCode, userId, orderTotal) {
    const result = await query(`
      SELECT * FROM marketplace_coupons 
      WHERE coupon_code = $1 
        AND is_active = true 
        AND valid_from <= NOW() 
        AND valid_until >= NOW()
        AND (max_uses = -1 OR current_uses < max_uses)
    `, [couponCode]);

    if (result.rows.length === 0) {
      throw new ValidationError('Invalid or expired coupon code');
    }

    const coupon = result.rows[0];

    // Check minimum order amount
    if (coupon.minimum_order_amount && orderTotal < coupon.minimum_order_amount) {
      throw new ValidationError(`Minimum order amount of ${coupon.minimum_order_amount} required for this coupon`);
    }

    // Check user-specific restrictions
    if (coupon.user_restrictions === 'specific_users' && 
        (!coupon.applicable_users || !coupon.applicable_users.includes(userId))) {
      throw new ValidationError('This coupon is not applicable to your account');
    }

    // Check usage limit per user
    const userUsageResult = await query(`
      SELECT COUNT(*) as usage_count 
      FROM marketplace_coupon_usage 
      WHERE coupon_id = $1 AND user_id = $2
    `, [coupon.id, userId]);

    if (userUsageResult.rows[0].usage_count >= coupon.max_uses_per_user) {
      throw new ValidationError('You have already used this coupon the maximum number of times');
    }

    // Calculate discount amount
    let discountAmount = 0;
    if (coupon.coupon_type === 'percentage') {
      discountAmount = orderTotal * (coupon.discount_percentage / 100);
      if (coupon.maximum_discount_amount) {
        discountAmount = Math.min(discountAmount, coupon.maximum_discount_amount);
      }
    } else if (coupon.coupon_type === 'fixed_amount') {
      discountAmount = coupon.discount_amount;
    }

    return {
      ...coupon,
      discountAmount
    };
  }

  /**
   * Search functionality
   */
  async searchProducts(searchQuery, filters = {}) {
    const {
      categoryId,
      priceMin,
      priceMax,
      rating,
      sortBy = 'relevance',
      page = 1,
      limit = 20
    } = filters;

    let whereConditions = [
      'p.status = \'active\'',
      'p.approval_status = \'approved\'',
      'p.published_at IS NOT NULL'
    ];
    let params = [];
    let paramCount = 0;

    // Add search term
    if (searchQuery) {
      whereConditions.push(`(
        to_tsvector('english', p.product_name || ' ' || COALESCE(p.short_description, '') || ' ' || COALESCE(p.full_description, '')) 
        @@ plainto_tsquery('english', $${++paramCount})
        OR p.product_name ILIKE $${++paramCount}
        OR array_to_string(p.tags, ' ') ILIKE $${++paramCount}
      )`);
      params.push(searchQuery, `%${searchQuery}%`, `%${searchQuery}%`);
      paramCount += 2;
    }

    // Add filters
    if (categoryId) {
      whereConditions.push(`p.category_id = $${++paramCount}`);
      params.push(categoryId);
    }

    if (priceMin) {
      whereConditions.push(`p.price >= $${++paramCount}`);
      params.push(priceMin);
    }

    if (priceMax) {
      whereConditions.push(`p.price <= $${++paramCount}`);
      params.push(priceMax);
    }

    if (rating) {
      whereConditions.push(`p.rating >= $${++paramCount}`);
      params.push(rating);
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
    const offset = (page - 1) * limit;

    // Determine sort order
    let orderClause = 'ORDER BY ';
    if (sortBy === 'relevance' && searchQuery) {
      orderClause += `ts_rank(to_tsvector('english', p.product_name || ' ' || COALESCE(p.short_description, '')), plainto_tsquery('english', '${searchQuery}')) DESC, `;
    }
    
    switch (sortBy) {
      case 'price_low':
        orderClause += 'p.price ASC';
        break;
      case 'price_high':
        orderClause += 'p.price DESC';
        break;
      case 'rating':
        orderClause += 'p.rating DESC';
        break;
      case 'newest':
        orderClause += 'p.published_at DESC';
        break;
      case 'bestseller':
        orderClause += 'p.sales_count DESC';
        break;
      default:
        orderClause += 'p.featured_product DESC, p.published_at DESC';
    }

    params.push(limit, offset);

    const result = await query(`
      SELECT 
        p.*,
        c.category_name,
        v.vendor_name,
        v.business_name,
        CASE 
          WHEN p.discount_percentage > 0 THEN p.discounted_price 
          ELSE p.price 
        END as effective_price,
        CASE 
          WHEN p.stock_quantity > 0 OR p.is_digital THEN true 
          ELSE false 
        END as in_stock
      FROM marketplace_products p
      JOIN marketplace_categories c ON p.category_id = c.id
      JOIN marketplace_vendors v ON p.vendor_id = v.id
      ${whereClause}
      ${orderClause}
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `, params);

    return result.rows;
  }
}

module.exports = new MarketplaceService();