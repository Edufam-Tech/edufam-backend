# M-Pesa Integration Guide

## Overview

This guide covers the complete M-Pesa integration for the Edufam School Management System, allowing schools to accept mobile money payments from parents and guardians.

## Features

### Core M-Pesa Features

- **STK Push**: Initiate payment requests to M-Pesa users
- **Callback Processing**: Handle M-Pesa payment confirmations
- **Transaction Tracking**: Monitor payment status and history
- **Retry Mechanism**: Retry failed transactions
- **Reporting**: Comprehensive transaction reports and analytics
- **Dashboard**: Real-time M-Pesa transaction dashboard

### Additional Features

- Phone number validation
- Error code reference
- Configuration management
- Export functionality
- Callback logging

## Environment Configuration

### Required Environment Variables

```env
# M-Pesa API Configuration
MPESA_BASE_URL=https://sandbox.safaricom.co.ke
MPESA_BUSINESS_SHORTCODE=174379
MPESA_PASSKEY=your_passkey_here
MPESA_CONSUMER_KEY=your_consumer_key_here
MPESA_CONSUMER_SECRET=your_consumer_secret_here
MPESA_ENVIRONMENT=sandbox

# Application Configuration
API_BASE_URL=https://your-domain.com
```

### Environment Setup

1. **Sandbox Environment** (Development/Testing)
   - Use Safaricom's sandbox environment
   - Test with sandbox phone numbers
   - No real money transactions

2. **Production Environment** (Live)
   - Use Safaricom's production environment
   - Real money transactions
   - Requires Safaricom approval

## API Endpoints

### Core Payment Endpoints

#### 1. Initiate STK Push

```http
POST /api/financial/payments/mpesa/stk-push
Authorization: Bearer <token>
Content-Type: application/json

{
  "phoneNumber": "254712345678",
  "amount": 5000,
  "reference": "FEE2024001",
  "description": "School Fee Payment",
  "studentId": "uuid",
  "feeAssignmentId": "uuid",
  "paymentMethodId": "uuid"
}
```

#### 2. Process Callback

```http
POST /api/financial/payments/mpesa/callback
Content-Type: application/json

{
  "Body": {
    "stkCallback": {
      "CheckoutRequestID": "ws_CO_123456789",
      "ResultCode": "0",
      "ResultDesc": "The service request is processed successfully.",
      "CallbackMetadata": {
        "Item": [
          {
            "Name": "Amount",
            "Value": 5000
          },
          {
            "Name": "MpesaReceiptNumber",
            "Value": "QK12345678"
          }
        ]
      }
    }
  }
}
```

#### 3. Check Transaction Status

```http
GET /api/financial/payments/mpesa/status/:id
Authorization: Bearer <token>
```

#### 4. Verify Payment

```http
POST /api/financial/payments/mpesa/verify
Authorization: Bearer <token>
Content-Type: application/json

{
  "paymentId": "uuid"
}
```

### Management Endpoints

#### 5. Get Transactions

```http
GET /api/financial/payments/mpesa/transactions?limit=20&offset=0&resultCode=0
Authorization: Bearer <token>
```

#### 6. Get Statistics

```http
GET /api/financial/payments/mpesa/statistics?startDate=2024-01-01&endDate=2024-12-31
Authorization: Bearer <token>
```

#### 7. Get Configuration Status

```http
GET /api/financial/payments/mpesa/configuration
Authorization: Bearer <token>
```

#### 8. Test Connection

```http
GET /api/financial/payments/mpesa/test-connection
Authorization: Bearer <token>
```

#### 9. Retry Transaction

```http
POST /api/financial/payments/mpesa/retry
Authorization: Bearer <token>
Content-Type: application/json

{
  "transactionId": "uuid"
}
```

#### 10. Get Dashboard

```http
GET /api/financial/payments/mpesa/dashboard?startDate=2024-01-01&endDate=2024-12-31
Authorization: Bearer <token>
```

#### 11. Export Transactions

```http
GET /api/financial/payments/mpesa/export?startDate=2024-01-01&endDate=2024-12-31&format=csv
Authorization: Bearer <token>
```

#### 12. Validate Phone Number

```http
POST /api/financial/payments/mpesa/validate-phone
Authorization: Bearer <token>
Content-Type: application/json

{
  "phoneNumber": "0712345678"
}
```

#### 13. Get Error Codes

```http
GET /api/financial/payments/mpesa/error-codes
Authorization: Bearer <token>
```

## Database Schema

### M-Pesa Transactions Table

```sql
CREATE TABLE mpesa_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,

    -- M-Pesa specific fields
    business_short_code VARCHAR(10) NOT NULL,
    checkout_request_id VARCHAR(100) UNIQUE,
    merchant_request_id VARCHAR(100),
    mpesa_receipt_number VARCHAR(50),
    phone_number VARCHAR(15) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,

    -- Transaction details
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('stk_push', 'c2b', 'b2c', 'b2b')),
    result_code INTEGER,
    result_desc TEXT,

    -- Callback data
    callback_metadata JSONB,
    is_callback_received BOOLEAN DEFAULT false,
    callback_received_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### M-Pesa Callbacks Table

```sql
CREATE TABLE mpesa_callbacks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mpesa_transaction_id UUID NOT NULL REFERENCES mpesa_transactions(id) ON DELETE CASCADE,

    -- Callback details
    callback_type VARCHAR(20) NOT NULL CHECK (callback_type IN ('stk_push', 'c2b', 'b2c', 'b2b')),
    callback_data JSONB NOT NULL,
    is_processed BOOLEAN DEFAULT false,
    processed_at TIMESTAMP,
    processing_notes TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Implementation Flow

### 1. Payment Initiation

1. User initiates payment through frontend
2. Frontend calls `/api/financial/payments/mpesa/stk-push`
3. Backend validates input and M-Pesa configuration
4. Backend generates access token and STK push request
5. M-Pesa API sends STK push to user's phone
6. Backend creates payment and M-Pesa transaction records
7. Frontend receives checkout request ID for tracking

### 2. Payment Processing

1. User enters M-Pesa PIN on their phone
2. M-Pesa processes the payment
3. M-Pesa sends callback to `/api/financial/payments/mpesa/callback`
4. Backend processes callback and updates transaction status
5. Payment status is updated to 'completed' or 'failed'
6. Receipt number is stored if payment is successful

### 3. Status Tracking

1. Frontend can poll `/api/financial/payments/mpesa/status/:id`
2. Backend checks transaction status in database
3. If callback not received, backend can query M-Pesa API
4. Frontend updates UI based on payment status

## Error Handling

### Common Error Codes

- `0`: Success
- `1`: Insufficient funds
- `2`: Less than minimum transaction value
- `3`: More than maximum transaction value
- `4`: Would exceed daily transfer limit
- `5`: Would exceed minimum transfer limit

### Error Handling Strategy

1. **Validation Errors**: Return 400 with specific error message
2. **M-Pesa API Errors**: Log error and return appropriate response
3. **Database Errors**: Log error and return 500
4. **Callback Errors**: Always return success to prevent retries

## Security Considerations

### 1. Authentication

- All endpoints (except callback) require valid JWT token
- School-based access control using RLS policies

### 2. Data Validation

- Phone number format validation (Kenyan format)
- Amount validation (1-70,000 KES)
- Required field validation

### 3. Callback Security

- Callback endpoint is public (required by M-Pesa)
- Validate callback data structure
- Log all callbacks for audit trail

### 4. Configuration Security

- Store sensitive data in environment variables
- Never log sensitive information
- Use HTTPS in production

## Testing

### Sandbox Testing

1. Use Safaricom's sandbox environment
2. Test with sandbox phone numbers
3. Verify all error scenarios
4. Test callback processing

### Test Phone Numbers

- `254708374149` - Success
- `254708374150` - Insufficient funds
- `254708374151` - User cancelled

### Test Scenarios

1. **Successful Payment**
   - Initiate STK push
   - Verify callback processing
   - Check payment status update

2. **Failed Payment**
   - Test with insufficient funds
   - Verify error handling
   - Test retry mechanism

3. **Network Issues**
   - Test timeout scenarios
   - Verify retry logic
   - Check status verification

## Monitoring and Logging

### Key Metrics to Monitor

- Transaction success rate
- Callback processing time
- Failed transaction count
- API response times

### Logging Strategy

- Log all M-Pesa API calls
- Log callback processing
- Log error scenarios
- Monitor for anomalies

## Troubleshooting

### Common Issues

1. **STK Push Fails**
   - Check M-Pesa configuration
   - Verify phone number format
   - Check API credentials

2. **Callback Not Received**
   - Verify callback URL is accessible
   - Check network connectivity
   - Verify M-Pesa configuration

3. **Payment Status Not Updated**
   - Check callback processing
   - Verify database connections
   - Check for errors in logs

### Debug Endpoints

- `/api/financial/payments/mpesa/configuration` - Check configuration
- `/api/financial/payments/mpesa/test-connection` - Test API connection
- `/api/financial/payments/mpesa/error-codes` - Reference error codes

## Best Practices

### 1. Error Handling

- Always handle M-Pesa API errors gracefully
- Provide meaningful error messages to users
- Log errors for debugging

### 2. User Experience

- Show clear payment instructions
- Provide real-time status updates
- Handle edge cases gracefully

### 3. Security

- Validate all input data
- Use HTTPS in production
- Implement proper authentication

### 4. Performance

- Implement proper caching
- Optimize database queries
- Monitor API response times

## Support

For technical support or questions about the M-Pesa integration:

1. Check the logs for error details
2. Verify M-Pesa configuration
3. Test with sandbox environment
4. Contact Safaricom support if needed

## References

- [Safaricom M-Pesa API Documentation](https://developer.safaricom.co.ke/)
- [M-Pesa STK Push API](https://developer.safaricom.co.ke/docs#stk-push)
- [M-Pesa Callback Documentation](https://developer.safaricom.co.ke/docs#callback)
