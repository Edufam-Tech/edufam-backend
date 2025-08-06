const { query } = require('../config/database');
const crypto = require('crypto');
const axios = require('axios');
const { ValidationError, NotFoundError, DatabaseError } = require('../middleware/errorHandler');

class MpesaService {
  constructor() {
    this.baseUrl = process.env.MPESA_BASE_URL || 'https://sandbox.safaricom.co.ke';
    this.businessShortCode = process.env.MPESA_BUSINESS_SHORTCODE;
    this.passkey = process.env.MPESA_PASSKEY;
    this.consumerKey = process.env.MPESA_CONSUMER_KEY;
    this.consumerSecret = process.env.MPESA_CONSUMER_SECRET;
    this.environment = process.env.MPESA_ENVIRONMENT || 'sandbox';
  }

  // Generate access token
  async generateAccessToken() {
    try {
      const auth = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString('base64');
      
      const response = await axios.get(`${this.baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json'
        }
      });

      return response.data.access_token;
    } catch (error) {
      console.error('Failed to generate M-Pesa access token:', error);
      throw new DatabaseError('Failed to generate M-Pesa access token');
    }
  }

  // Generate timestamp
  generateTimestamp() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');
    const second = String(now.getSeconds()).padStart(2, '0');
    
    return `${year}${month}${day}${hour}${minute}${second}`;
  }

  // Generate password
  generatePassword() {
    const timestamp = this.generateTimestamp();
    const password = Buffer.from(`${this.businessShortCode}${this.passkey}${timestamp}`).toString('base64');
    return password;
  }

  // Initiate STK Push
  async initiateSTKPush(paymentData) {
    try {
      const {
        phoneNumber,
        amount,
        reference,
        description = 'School Fee Payment'
      } = paymentData;

      // Validate required fields
      if (!phoneNumber || !amount || !reference) {
        throw new ValidationError('Phone number, amount, and reference are required');
      }

      // Validate phone number format (Kenyan format)
      const cleanPhone = phoneNumber.replace(/^0/, '254').replace(/^\+/, '');
      if (!/^254\d{9}$/.test(cleanPhone)) {
        throw new ValidationError('Invalid phone number format. Use Kenyan format (e.g., 254712345678)');
      }

      // Validate amount
      if (amount < 1 || amount > 70000) {
        throw new ValidationError('Amount must be between 1 and 70,000 KES');
      }

      const accessToken = await this.generateAccessToken();
      const timestamp = this.generateTimestamp();
      const password = this.generatePassword();

      const stkPushData = {
        BusinessShortCode: this.businessShortCode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.round(amount),
        PartyA: cleanPhone,
        PartyB: this.businessShortCode,
        PhoneNumber: cleanPhone,
        CallBackURL: `${process.env.API_BASE_URL}/api/payments/mpesa/callback`,
        AccountReference: reference,
        TransactionDesc: description
      };

      const response = await axios.post(
        `${this.baseUrl}/mpesa/stkpush/v1/processrequest`,
        stkPushData,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const result = response.data;

      if (result.ResultCode === '0') {
        return {
          success: true,
          checkoutRequestId: result.CheckoutRequestID,
          merchantRequestId: result.MerchantRequestID,
          responseCode: result.ResultCode,
          responseDescription: result.ResultDesc,
          customerMessage: result.CustomerMessage
        };
      } else {
        return {
          success: false,
          responseCode: result.ResultCode,
          responseDescription: result.ResultDesc,
          customerMessage: result.CustomerMessage
        };
      }
    } catch (error) {
      console.error('STK Push failed:', error);
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseError('Failed to initiate STK Push');
    }
  }

  // Create M-Pesa transaction record
  async createMpesaTransaction(paymentId, stkPushData) {
    try {
      const {
        businessShortCode,
        checkoutRequestId,
        merchantRequestId,
        phoneNumber,
        amount,
        resultCode,
        resultDesc
      } = stkPushData;

      const result = await query(`
        INSERT INTO mpesa_transactions (
          payment_id, business_short_code, checkout_request_id, merchant_request_id,
          phone_number, amount, transaction_type, result_code, result_desc,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
        RETURNING *
      `, [
        paymentId, businessShortCode, checkoutRequestId, merchantRequestId,
        phoneNumber, amount, 'stk_push', resultCode, resultDesc
      ]);

      return result.rows[0];
    } catch (error) {
      console.error('Failed to create M-Pesa transaction:', error);
      throw new DatabaseError('Failed to create M-Pesa transaction record');
    }
  }

  // Process M-Pesa callback
  async processCallback(callbackData) {
    try {
      const {
        Body: {
          stkCallback: {
            CheckoutRequestID: checkoutRequestId,
            ResultCode: resultCode,
            ResultDesc: resultDesc,
            CallbackMetadata
          }
        }
      } = callbackData;

      // Find M-Pesa transaction by checkout request ID
      const transaction = await query(`
        SELECT mt.*, p.id as payment_id, p.school_id, p.student_id, p.amount
        FROM mpesa_transactions mt
        JOIN payments p ON mt.payment_id = p.id
        WHERE mt.checkout_request_id = $1
      `, [checkoutRequestId]);

      if (transaction.rows.length === 0) {
        throw new NotFoundError('M-Pesa transaction not found');
      }

      const mpesaTransaction = transaction.rows[0];

      // Extract callback metadata
      let callbackMetadata = {};
      if (CallbackMetadata && CallbackMetadata.Item) {
        CallbackMetadata.Item.forEach(item => {
          callbackMetadata[item.Name] = item.Value;
        });
      }

      // Update M-Pesa transaction with callback data
      await query(`
        UPDATE mpesa_transactions 
        SET result_code = $1, result_desc = $2, callback_metadata = $3,
            is_callback_received = true, callback_received_at = NOW(), updated_at = NOW()
        WHERE id = $4
      `, [resultCode, resultDesc, JSON.stringify(callbackMetadata), mpesaTransaction.id]);

      // Log callback
      await query(`
        INSERT INTO mpesa_callbacks (
          mpesa_transaction_id, callback_type, callback_data, is_processed, processed_at
        ) VALUES ($1, $2, $3, true, NOW())
      `, [mpesaTransaction.id, 'stk_push', JSON.stringify(callbackData)]);

      // Process based on result code
      if (resultCode === '0') {
        // Success - update payment status
        await query(`
          UPDATE payments 
          SET status = 'completed', received_at = NOW(), updated_at = NOW()
          WHERE id = $1
        `, [mpesaTransaction.payment_id]);

        // Update M-Pesa transaction with receipt number
        if (callbackMetadata.MpesaReceiptNumber) {
          await query(`
            UPDATE mpesa_transactions 
            SET mpesa_receipt_number = $1, updated_at = NOW()
            WHERE id = $2
          `, [callbackMetadata.MpesaReceiptNumber, mpesaTransaction.id]);
        }

        return {
          success: true,
          paymentId: mpesaTransaction.payment_id,
          resultCode,
          resultDesc,
          receiptNumber: callbackMetadata.MpesaReceiptNumber
        };
      } else {
        // Failed - update payment status
        await query(`
          UPDATE payments 
          SET status = 'failed', updated_at = NOW()
          WHERE id = $1
        `, [mpesaTransaction.payment_id]);

        return {
          success: false,
          paymentId: mpesaTransaction.payment_id,
          resultCode,
          resultDesc
        };
      }
    } catch (error) {
      console.error('Failed to process M-Pesa callback:', error);
      throw new DatabaseError('Failed to process M-Pesa callback');
    }
  }

  // Check transaction status
  async checkTransactionStatus(checkoutRequestId) {
    try {
      const result = await query(`
        SELECT 
          mt.*,
          p.status as payment_status,
          p.amount as payment_amount,
          st.first_name || ' ' || st.last_name as student_name
        FROM mpesa_transactions mt
        JOIN payments p ON mt.payment_id = p.id
        JOIN students st ON p.student_id = st.id
        WHERE mt.checkout_request_id = $1
      `, [checkoutRequestId]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Transaction not found');
      }

      return result.rows[0];
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError('Failed to check transaction status');
    }
  }

  // Get M-Pesa transactions for a school
  async getSchoolTransactions(schoolId, filters = {}) {
    try {
      let sql = `
        SELECT 
          mt.*,
          p.status as payment_status,
          p.amount as payment_amount,
          st.first_name || ' ' || st.last_name as student_name,
          st.student_number
        FROM mpesa_transactions mt
        JOIN payments p ON mt.payment_id = p.id
        JOIN students st ON p.student_id = st.id
        WHERE p.school_id = $1
      `;
      
      const params = [schoolId];
      let paramCount = 1;

      // Apply filters
      if (filters.resultCode) {
        paramCount++;
        sql += ` AND mt.result_code = $${paramCount}`;
        params.push(filters.resultCode);
      }

      if (filters.transactionType) {
        paramCount++;
        sql += ` AND mt.transaction_type = $${paramCount}`;
        params.push(filters.transactionType);
      }

      if (filters.startDate) {
        paramCount++;
        sql += ` AND mt.created_at >= $${paramCount}`;
        params.push(filters.startDate);
      }

      if (filters.endDate) {
        paramCount++;
        sql += ` AND mt.created_at <= $${paramCount}`;
        params.push(filters.endDate);
      }

      // Add ordering
      sql += ` ORDER BY mt.created_at DESC`;

      const result = await query(sql, params);
      return result.rows;
    } catch (error) {
      throw new DatabaseError('Failed to get M-Pesa transactions');
    }
  }

  // Get M-Pesa transaction statistics
  async getTransactionStatistics(schoolId, filters = {}) {
    try {
      let sql = `
        SELECT 
          COUNT(mt.id) as total_transactions,
          COUNT(mt.id) FILTER (WHERE mt.result_code = '0') as successful_transactions,
          COUNT(mt.id) FILTER (WHERE mt.result_code != '0') as failed_transactions,
          SUM(mt.amount) FILTER (WHERE mt.result_code = '0') as total_amount,
          AVG(mt.amount) FILTER (WHERE mt.result_code = '0') as average_amount,
          COUNT(mt.id) FILTER (WHERE mt.is_callback_received = true) as callbacks_received
        FROM mpesa_transactions mt
        JOIN payments p ON mt.payment_id = p.id
        WHERE p.school_id = $1
      `;
      
      const params = [schoolId];

      if (filters.startDate) {
        sql += ' AND mt.created_at >= $2';
        params.push(filters.startDate);
      }

      if (filters.endDate) {
        sql += ` AND mt.created_at <= $${params.length + 1}`;
        params.push(filters.endDate);
      }

      const result = await query(sql, params);
      return result.rows[0];
    } catch (error) {
      throw new DatabaseError('Failed to get M-Pesa transaction statistics');
    }
  }

  // Verify payment with M-Pesa
  async verifyPayment(paymentId) {
    try {
      const result = await query(`
        SELECT 
          mt.*,
          p.status as payment_status,
          p.amount as payment_amount
        FROM mpesa_transactions mt
        JOIN payments p ON mt.payment_id = p.id
        WHERE p.id = $1
      `, [paymentId]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Payment not found');
      }

      const transaction = result.rows[0];

      // If callback not received, try to check status with M-Pesa API
      if (!transaction.is_callback_received && transaction.checkout_request_id) {
        try {
          const accessToken = await this.generateAccessToken();
          
          const response = await axios.post(
            `${this.baseUrl}/mpesa/stkpushquery/v1/query`,
            {
              BusinessShortCode: this.businessShortCode,
              CheckoutRequestID: transaction.checkout_request_id,
              Password: this.generatePassword(),
              Timestamp: this.generateTimestamp()
            },
            {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
              }
            }
          );

          const queryResult = response.data;
          
          // Update transaction with query result
          await query(`
            UPDATE mpesa_transactions 
            SET result_code = $1, result_desc = $2, updated_at = NOW()
            WHERE id = $3
          `, [queryResult.ResultCode, queryResult.ResultDesc, transaction.id]);

          // Update payment status based on result
          if (queryResult.ResultCode === '0') {
            await query(`
              UPDATE payments 
              SET status = 'completed', received_at = NOW(), updated_at = NOW()
              WHERE id = $1
            `, [paymentId]);
          }

          return {
            verified: true,
            resultCode: queryResult.ResultCode,
            resultDesc: queryResult.ResultDesc,
            paymentStatus: queryResult.ResultCode === '0' ? 'completed' : 'failed'
          };
        } catch (apiError) {
          console.error('M-Pesa API query failed:', apiError);
          return {
            verified: false,
            error: 'Failed to verify with M-Pesa API'
          };
        }
      }

      return {
        verified: true,
        resultCode: transaction.result_code,
        resultDesc: transaction.result_desc,
        paymentStatus: transaction.payment_status
      };
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError('Failed to verify payment');
    }
  }

  // Validate M-Pesa configuration
  validateConfiguration() {
    const errors = [];

    if (!this.businessShortCode) {
      errors.push('M-Pesa business shortcode is not configured');
    }

    if (!this.passkey) {
      errors.push('M-Pesa passkey is not configured');
    }

    if (!this.consumerKey) {
      errors.push('M-Pesa consumer key is not configured');
    }

    if (!this.consumerSecret) {
      errors.push('M-Pesa consumer secret is not configured');
    }

    return errors;
  }

  // Get M-Pesa transaction by ID
  async getTransactionById(id) {
    try {
      const result = await query(`
        SELECT 
          mt.*,
          p.status as payment_status,
          p.amount as payment_amount,
          st.first_name || ' ' || st.last_name as student_name,
          st.student_number
        FROM mpesa_transactions mt
        JOIN payments p ON mt.payment_id = p.id
        JOIN students st ON p.student_id = st.id
        WHERE mt.id = $1
      `, [id]);

      if (result.rows.length === 0) {
        throw new NotFoundError('M-Pesa transaction not found');
      }

      return result.rows[0];
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError('Failed to get M-Pesa transaction');
    }
  }

  // Get M-Pesa callbacks
  async getCallbacks(schoolId, filters = {}) {
    try {
      let sql = `
        SELECT 
          mc.*,
          mt.checkout_request_id,
          mt.phone_number,
          mt.amount,
          p.status as payment_status
        FROM mpesa_callbacks mc
        JOIN mpesa_transactions mt ON mc.mpesa_transaction_id = mt.id
        JOIN payments p ON mt.payment_id = p.id
        WHERE p.school_id = $1
      `;
      
      const params = [schoolId];
      let paramCount = 1;

      // Apply filters
      if (filters.mpesaTransactionId) {
        paramCount++;
        sql += ` AND mc.mpesa_transaction_id = $${paramCount}`;
        params.push(filters.mpesaTransactionId);
      }

      if (filters.callbackType) {
        paramCount++;
        sql += ` AND mc.callback_type = $${paramCount}`;
        params.push(filters.callbackType);
      }

      if (filters.isProcessed !== undefined) {
        paramCount++;
        sql += ` AND mc.is_processed = $${paramCount}`;
        params.push(filters.isProcessed);
      }

      if (filters.startDate) {
        paramCount++;
        sql += ` AND mc.created_at >= $${paramCount}`;
        params.push(filters.startDate);
      }

      if (filters.endDate) {
        paramCount++;
        sql += ` AND mc.created_at <= $${paramCount}`;
        params.push(filters.endDate);
      }

      // Add ordering
      sql += ` ORDER BY mc.created_at DESC`;

      // Add limit and offset
      if (filters.limit) {
        paramCount++;
        sql += ` LIMIT $${paramCount}`;
        params.push(filters.limit);
      }

      if (filters.offset) {
        paramCount++;
        sql += ` OFFSET $${paramCount}`;
        params.push(filters.offset);
      }

      const result = await query(sql, params);
      return result.rows;
    } catch (error) {
      throw new DatabaseError('Failed to get M-Pesa callbacks');
    }
  }

  // Retry failed M-Pesa transaction
  async retryTransaction(transactionId) {
    try {
      const transaction = await this.getTransactionById(transactionId);

      if (!transaction) {
        throw new NotFoundError('Transaction not found');
      }

      if (transaction.result_code === '0') {
        throw new ValidationError('Transaction was successful, no retry needed');
      }

      // Get the original payment
      const paymentResult = await query(`
        SELECT * FROM payments WHERE id = $1
      `, [transaction.payment_id]);

      if (paymentResult.rows.length === 0) {
        throw new NotFoundError('Payment not found');
      }

      const payment = paymentResult.rows[0];

      // Create a new STK Push
      const stkPushResult = await this.initiateSTKPush({
        phoneNumber: transaction.phone_number,
        amount: transaction.amount,
        reference: payment.reference_number,
        description: 'Retry: School Fee Payment'
      });

      if (!stkPushResult.success) {
        throw new ValidationError(stkPushResult.responseDescription || 'STK Push retry failed');
      }

      // Create new M-Pesa transaction record
      const newMpesaTransaction = await this.createMpesaTransaction(transaction.payment_id, {
        businessShortCode: this.businessShortCode,
        checkoutRequestId: stkPushResult.checkoutRequestId,
        merchantRequestId: stkPushResult.merchantRequestId,
        phoneNumber: transaction.phone_number,
        amount: transaction.amount,
        resultCode: stkPushResult.responseCode,
        resultDesc: stkPushResult.responseDescription
      });

      // Update payment status to pending
      await query(`
        UPDATE payments 
        SET status = 'pending', updated_at = NOW()
        WHERE id = $1
      `, [transaction.payment_id]);

      return {
        success: true,
        originalTransactionId: transactionId,
        newTransactionId: newMpesaTransaction.id,
        checkoutRequestId: stkPushResult.checkoutRequestId,
        customerMessage: stkPushResult.customerMessage
      };
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError('Failed to retry transaction');
    }
  }

  // Get M-Pesa transaction summary
  async getTransactionSummary(schoolId, filters = {}) {
    try {
      let sql = `
        SELECT 
          COUNT(mt.id) as total_transactions,
          COUNT(mt.id) FILTER (WHERE mt.result_code = '0') as successful_transactions,
          COUNT(mt.id) FILTER (WHERE mt.result_code != '0') as failed_transactions,
          SUM(mt.amount) FILTER (WHERE mt.result_code = '0') as total_amount,
          AVG(mt.amount) FILTER (WHERE mt.result_code = '0') as average_amount,
          COUNT(mt.id) FILTER (WHERE mt.is_callback_received = true) as callbacks_received,
          COUNT(mt.id) FILTER (WHERE mt.is_callback_received = false) as callbacks_pending,
          DATE(mt.created_at) as transaction_date
        FROM mpesa_transactions mt
        JOIN payments p ON mt.payment_id = p.id
        WHERE p.school_id = $1
      `;
      
      const params = [schoolId];

      if (filters.startDate) {
        sql += ' AND mt.created_at >= $2';
        params.push(filters.startDate);
      }

      if (filters.endDate) {
        sql += ` AND mt.created_at <= $${params.length + 1}`;
        params.push(filters.endDate);
      }

      if (filters.resultCode) {
        sql += ` AND mt.result_code = $${params.length + 1}`;
        params.push(filters.resultCode);
      }

      sql += ` GROUP BY DATE(mt.created_at) ORDER BY transaction_date DESC`;

      const result = await query(sql, params);
      return result.rows;
    } catch (error) {
      throw new DatabaseError('Failed to get M-Pesa transaction summary');
    }
  }

  // Export M-Pesa transactions
  async exportTransactions(schoolId, filters = {}) {
    try {
      let sql = `
        SELECT 
          mt.id,
          mt.checkout_request_id,
          mt.merchant_request_id,
          mt.phone_number,
          mt.amount,
          mt.transaction_type,
          mt.result_code,
          mt.result_desc,
          mt.mpesa_receipt_number,
          mt.is_callback_received,
          mt.created_at,
          mt.updated_at,
          p.status as payment_status,
          p.reference_number,
          st.first_name || ' ' || st.last_name as student_name,
          st.student_number
        FROM mpesa_transactions mt
        JOIN payments p ON mt.payment_id = p.id
        JOIN students st ON p.student_id = st.id
        WHERE p.school_id = $1
      `;
      
      const params = [schoolId];

      if (filters.startDate) {
        sql += ' AND mt.created_at >= $2';
        params.push(filters.startDate);
      }

      if (filters.endDate) {
        sql += ` AND mt.created_at <= $${params.length + 1}`;
        params.push(filters.endDate);
      }

      if (filters.resultCode) {
        sql += ` AND mt.result_code = $${params.length + 1}`;
        params.push(filters.resultCode);
      }

      sql += ` ORDER BY mt.created_at DESC`;

      const result = await query(sql, params);
      
      // Format data for export
      const exportData = result.rows.map(row => ({
        transaction_id: row.id,
        checkout_request_id: row.checkout_request_id,
        merchant_request_id: row.merchant_request_id,
        phone_number: row.phone_number,
        amount: row.amount,
        transaction_type: row.transaction_type,
        result_code: row.result_code,
        result_desc: row.result_desc,
        mpesa_receipt_number: row.mpesa_receipt_number,
        callback_received: row.is_callback_received ? 'Yes' : 'No',
        payment_status: row.payment_status,
        reference_number: row.reference_number,
        student_name: row.student_name,
        student_number: row.student_number,
        created_at: row.created_at,
        updated_at: row.updated_at
      }));

      return exportData;
    } catch (error) {
      throw new DatabaseError('Failed to export M-Pesa transactions');
    }
  }

  // Get M-Pesa dashboard data
  async getDashboard(schoolId, filters = {}) {
    try {
      // Get basic statistics
      const stats = await this.getTransactionStatistics(schoolId, filters);

      // Get recent transactions
      const recentTransactions = await query(`
        SELECT 
          mt.*,
          p.status as payment_status,
          st.first_name || ' ' || st.last_name as student_name
        FROM mpesa_transactions mt
        JOIN payments p ON mt.payment_id = p.id
        JOIN students st ON p.student_id = st.id
        WHERE p.school_id = $1
        ORDER BY mt.created_at DESC
        LIMIT 10
      `, [schoolId]);

      // Get daily transaction trends (last 7 days)
      const dailyTrends = await query(`
        SELECT 
          DATE(mt.created_at) as date,
          COUNT(mt.id) as total_transactions,
          COUNT(mt.id) FILTER (WHERE mt.result_code = '0') as successful_transactions,
          SUM(mt.amount) FILTER (WHERE mt.result_code = '0') as total_amount
        FROM mpesa_transactions mt
        JOIN payments p ON mt.payment_id = p.id
        WHERE p.school_id = $1
        AND mt.created_at >= NOW() - INTERVAL '7 days'
        GROUP BY DATE(mt.created_at)
        ORDER BY date DESC
      `, [schoolId]);

      // Get pending callbacks
      const pendingCallbacks = await query(`
        SELECT COUNT(mt.id) as count
        FROM mpesa_transactions mt
        JOIN payments p ON mt.payment_id = p.id
        WHERE p.school_id = $1
        AND mt.is_callback_received = false
        AND mt.created_at >= NOW() - INTERVAL '24 hours'
      `, [schoolId]);

      return {
        statistics: stats,
        recentTransactions: recentTransactions.rows,
        dailyTrends: dailyTrends.rows,
        pendingCallbacks: pendingCallbacks.rows[0].count
      };
    } catch (error) {
      throw new DatabaseError('Failed to get M-Pesa dashboard data');
    }
  }
}

module.exports = new MpesaService(); 