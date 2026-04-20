const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// In-memory data
let products = [
  { id: '1', name: 'Milk 1L', barcode: '111111', price: 100, stockLevel: 50 },
  { id: '2', name: 'Bread 400g', barcode: '222222', price: 65, stockLevel: 100 },
  { id: '3', name: 'Sugar 1kg', barcode: '333333', price: 210, stockLevel: 30 },
  { id: '4', name: 'Cooking Oil 2L', barcode: '444444', price: 450, stockLevel: 20 },
];

let sales = [];

// Endpoints
app.get('/api/v1/inventory/products/:barcode', (req, res) => {
  const product = products.find(p => p.barcode === req.params.barcode);
  product ? res.json(product) : res.status(404).json({ message: 'Not found' });
});

app.post('/api/v1/sales', (req, res) => {
  const sale = { id: `S-${Date.now()}`, ...req.body, createdAt: new Date() };
  sales.push(sale);
  console.log('✅ Sale Received:', sale);
  res.status(201).json(sale);
});

app.post('/api/v1/payments/mpesa/stkpush', (req, res) => {
  console.log('📱 M-Pesa STK Push triggered for:', req.body.phoneNumber);
  res.json({ ResponseCode: "0", ResponseDescription: "Success. Request accepted for processing", CheckoutRequestID: "ws_CO_123456" });
});

app.get('/health', (req, res) => res.json({ status: 'Mock Server Online' }));

app.listen(PORT, () => {
  console.log(`\n🚀 Mock POS API running at http://localhost:${PORT}`);
  console.log(`💡 Test Barcodes: 111111, 222222, 333333, 444444\n`);
});
