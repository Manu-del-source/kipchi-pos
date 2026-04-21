const axios = require('axios');
const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

class MpesaService {
  async getAccessToken() {
    const consumerKey = process.env.MPESA_CONSUMER_KEY;
    const consumerSecret = process.env.MPESA_CONSUMER_SECRET;
    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');

    const response = await axios.get(
      'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
      { headers: { Authorization: `Basic ${auth}` } }
    );
    return response.data.access_token;
  }

  async stkPush(phoneNumber, amount, saleId) {
    // 1. Check for existing pending transaction for this sale to prevent double-billing
    const existing = await db.query(
      'SELECT id FROM "MpesaTransaction" WHERE "saleId" = $1 AND status = \'PENDING\' AND "createdAt" > NOW() - INTERVAL \'5 minutes\'',
      [saleId]
    );

    if (existing.rows.length > 0) {
      throw new Error('A payment request for this sale is already pending on the user\'s phone.');
    }

    const token = await this.getAccessToken();
    const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
    const password = Buffer.from(
      `${process.env.MPESA_SHORTCODE}${process.env.MPESA_PASSKEY}${timestamp}`
    ).toString('base64');

    const requestBody = {
      BusinessShortCode: process.env.MPESA_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.round(amount),
      PartyA: phoneNumber,
      PartyB: process.env.MPESA_SHORTCODE,
      PhoneNumber: phoneNumber,
      CallBackURL: process.env.MPESA_CALLBACK_URL,
      AccountReference: `POS-SALE-${saleId}`,
      TransactionDesc: 'Supermarket POS Payment',
    };

    const response = await axios.post(
      'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
      requestBody,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    // Record the transaction attempt
    const id = uuidv4();
    await db.query(
      'INSERT INTO "MpesaTransaction" (id, "saleId", "checkoutRequestId", "merchantRequestId", "phoneNumber", amount, status, "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, \'PENDING\', NOW())',
      [id, saleId, response.data.CheckoutRequestID, response.data.MerchantRequestID, phoneNumber, amount]
    );

    return response.data;
  }

  async checkStkStatus(checkoutRequestId) {
    const token = await this.getAccessToken();
    const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
    const password = Buffer.from(
      `${process.env.MPESA_SHORTCODE}${process.env.MPESA_PASSKEY}${timestamp}`
    ).toString('base64');

    const requestBody = {
      BusinessShortCode: process.env.MPESA_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      CheckoutRequestID: checkoutRequestId,
    };

    const response = await axios.post(
      'https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query',
      requestBody,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    return response.data;
  }
}


module.exports = new MpesaService();
