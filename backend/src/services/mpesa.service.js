const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

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
    const existingTransaction = await prisma.mpesaTransaction.findFirst({
      where: {
        saleId,
        status: 'PENDING',
        createdAt: {
          gt: new Date(Date.now() - 5 * 60 * 1000) // Within last 5 minutes
        }
      }
    });

    if (existingTransaction) {
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
    await prisma.mpesaTransaction.create({
      data: {
        saleId,
        checkoutRequestId: response.data.CheckoutRequestID,
        merchantRequestId: response.data.MerchantRequestID,
        phoneNumber,
        amount,
        status: 'PENDING',
      },
    });

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
