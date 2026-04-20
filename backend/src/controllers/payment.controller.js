const { PrismaClient } = require('@prisma/client');
const mpesaService = require('../services/mpesa.service');
const prisma = new PrismaClient();

exports.initiateStkPush = async (req, res) => {
  try {
    const { phoneNumber, amount, saleId } = req.body;
    const response = await mpesaService.stkPush(phoneNumber, amount, saleId);
    res.json(response);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.mpesaCallback = async (req, res) => {
  try {
    const { Body } = req.body;
    if (!Body || !Body.stkCallback) {
      console.error('❌ Invalid M-Pesa Callback Body:', req.body);
      return res.status(400).json({ ResultCode: 1, ResultDesc: "Invalid body" });
    }

    const stkCallback = Body.stkCallback;
    const checkoutRequestId = stkCallback.CheckoutRequestID;
    const resultCode = stkCallback.ResultCode;
    const resultDesc = stkCallback.ResultDesc;

    console.log(`📱 M-Pesa Callback for ${checkoutRequestId}: ${resultDesc} (${resultCode})`);

    const status = resultCode === 0 ? 'SUCCESS' : 'FAILED';
    
    let mpesaReceipt = null;
    if (resultCode === 0 && stkCallback.CallbackMetadata) {
      const items = stkCallback.CallbackMetadata.Item;
      const receiptItem = items.find(item => item.Name === 'MpesaReceiptNumber');
      mpesaReceipt = receiptItem ? receiptItem.Value : null;
    }

    const transaction = await prisma.mpesaTransaction.update({
      where: { checkoutRequestId },
      data: { 
        status, 
        resultCode, 
        resultDesc, 
        mpesaReceipt,
        updatedAt: new Date()
      },
    });

    if (status === 'SUCCESS') {
      await prisma.sale.update({
        where: { id: transaction.saleId },
        data: { paymentStatus: 'PAID' },
      });
      console.log(`✅ Sale ${transaction.saleId} marked as PAID`);
    }

    // Safaricom expects this response
    res.status(200).json({ ResultCode: 0, ResultDesc: "Success" });
  } catch (error) {
    console.error('🔥 M-Pesa Callback Error:', error);
    res.status(200).json({ ResultCode: 1, ResultDesc: "Internal Error" });
  }
};


exports.checkPaymentStatus = async (req, res) => {
  const { checkoutRequestId } = req.params;

  try {
    const status = await mpesaService.checkStkStatus(checkoutRequestId);
    
    // ResultCode 0 means success
    if (status.ResultCode === '0') {
      const transaction = await prisma.mpesaTransaction.findUnique({ where: { checkoutRequestId } });
      if (transaction && transaction.status !== 'SUCCESS') {
        await prisma.mpesaTransaction.update({
          where: { checkoutRequestId },
          data: { status: 'SUCCESS' },
        });
        await prisma.sale.update({
          where: { id: transaction.saleId },
          data: { paymentStatus: 'PAID' },
        });
      }
    }

    res.json(status);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

