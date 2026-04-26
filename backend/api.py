from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
import sys
import os
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

# Add parent directory to path to import database
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import database as db
from backend.mpesa_api import MpesaGateWay

app = FastAPI(title="ROHI Hardware & Moto POS API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- M-Pesa Config ---
MPESA_CONFIG = {
    "consumer_key": "YOUR_KEY",
    "consumer_secret": "YOUR_SECRET",
    "shortcode": "174379",
    "passkey": "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919"
}
mpesa_client = MpesaGateWay(**MPESA_CONFIG)

# --- Models ---
class SaleItem(BaseModel):
    product: int # product_id
    quantity: int
    unit_price: float
    subtotal: float

class SaleCreate(BaseModel):
    sale_number: str
    customer: Optional[int] = None
    total_amount: float
    tax_amount: float
    payment_method: str
    items: List[SaleItem]
    phone: Optional[str] = None

class LoginRequest(BaseModel):
    username: str
    password: str

@app.post("/api/login")
def login(data: LoginRequest):
    user = db.check_user(data.username, data.password)
    if user:
        # For simplicity, we return a mock token. In production, use JWT.
        return {"token": "mock-jwt-token", "user": {"username": user["username"], "role": user["role"]}}
    raise HTTPException(status_code=401, detail="Invalid credentials")

# --- Endpoints ---

@app.get("/api/products/")
def get_products(search: str = ""):
    if search:
        rows = db.search_products(search)
    else:
        rows = db.get_all_products()
    return [dict(r) for r in rows]

class ProductCreate(BaseModel):
    sku: str
    name: str
    category_id: Optional[int] = None
    cost_price: float
    price: float
    stock: int

@app.post("/api/products/")
def add_product(data: ProductCreate):
    try:
        db.add_product(data.sku, data.name, data.category_id, data.cost_price, data.price, data.stock)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.put("/api/products/{product_id}")
def update_product(product_id: int, data: ProductCreate):
    try:
        db.update_product(product_id, data.sku, data.name, data.category_id, data.cost_price, data.price, data.stock)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/api/products/{product_id}")
def delete_product(product_id: int, role: str = "cashier"):
    if role.lower() != "admin":
        raise HTTPException(status_code=403, detail="Permission denied. Admin only.")
    try:
        db.delete_product(product_id)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/customers/")
def get_customers(search: str = ""):
    if search:
        rows = db.search_customers(search)
    else:
        rows = db.get_all_customers()
    return [dict(r) for r in rows]

@app.post("/api/sales/")
async def create_sale(data: SaleCreate):
    try:
        # Convert items to database format
        items = [{"product_id": i.product, "quantity": i.quantity} for i in data.items]
        total, sale_id = db.create_sale(items, data.customer)
        
        return {"id": sale_id, "status": "success", "total": total}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/sales/")
def get_sales():
    return [dict(r) for r in db.get_recent_sales()]

@app.get("/api/sales/{sale_id}")
def get_sale_details(sale_id: int):
    items = db.get_sale_items(sale_id)
    return [dict(r) for r in items]

@app.post("/api/realtime/mpesa/stkpush")
async def mpesa_stk(data: dict):
    # data format from POS.jsx: {phoneNumber, amount, saleId}
    phone = data.get("phoneNumber")
    amount = data.get("amount")
    
    # In a real app, you'd trigger STK push and handle the callback via Socket.io
    resp = mpesa_client.stk_push(phone, amount, "https://your-domain.com/mpesa-callback")
    return {"status": "STK_SENT", "mpesa_response": resp}

@app.get("/api/reports/dashboard")
def dashboard_stats(role: str = "cashier"):
    if role.lower() != "admin":
        raise HTTPException(status_code=403, detail="Permission denied. Admin only.")
    today = datetime.now().strftime("%Y-%m-%d")
    summary = db.get_sales_summary(today)
    cogs = db.get_cogs(today)
    expenses = db.get_total_expenses(today)
    top_selling = db.get_top_selling_products(today)
    low_stock = db.get_low_stock_products(10)
    
    return {
        "revenue": summary["total"],
        "orders_count": summary["count"],
        "profit": summary["total"] - cogs - expenses,
        "top_selling": [dict(r) for r in top_selling],
        "low_stock": [dict(r) for r in low_stock]
    }

if __name__ == "__main__":
    import uvicorn
    db.init_db()
    uvicorn.run(app, host="0.0.0.0", port=5000) # React usually targets 5000 or 8000
