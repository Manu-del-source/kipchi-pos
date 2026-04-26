from textual.app import ComposeResult
from textual.screen import Screen, ModalScreen
from textual.widgets import Header, Footer, Button, DataTable, Input, Static, Select, Label
from textual.containers import Container, Horizontal, Vertical, Grid
from textual import on
import database as db
from datetime import datetime, timedelta

# ---------- Login Screen ----------
class LoginScreen(Screen):
    def compose(self) -> ComposeResult:
        yield Header()
        yield Container(
            Static("🔐 Login", id="title"),
            Input(placeholder="Username", id="username"),
            Input(placeholder="Password", password=True, id="password"),
            Button("Login", id="btn_login", variant="success"),
            Static("", id="login_error"),
            id="login_container"
        )
        yield Footer()

    @on(Button.Pressed, "#btn_login")
    def login(self):
        user = self.query_one("#username", Input).value.strip()
        pw = self.query_one("#password", Input).value.strip()
        user_data = db.check_user(user, pw)
        if user_data:
            self.app.user = user_data
            self.app.push_screen(MainMenu())
        else:
            self.query_one("#login_error", Static).update("Invalid credentials!")

# ---------- Quantity Popup (modal) ----------
class QuantityPopup(ModalScreen):
    def __init__(self, product_name, callback):
        super().__init__()
        self.product_name = product_name
        self.callback = callback

    def compose(self) -> ComposeResult:
        yield Container(
            Static(f"Enter quantity for {self.product_name}", id="qty_label"),
            Input(placeholder="Qty", id="qty_input", type="integer"),
            Horizontal(
                Button("OK", id="qty_ok"),
                Button("Cancel", id="qty_cancel"),
            ),
            id="qty_container"
        )

    @on(Button.Pressed, "#qty_ok")
    def ok(self):
        try:
            qty = int(self.query_one("#qty_input", Input).value)
            if qty > 0:
                self.dismiss(qty)
            else:
                self.notify("Quantity must be positive", severity="error")
        except ValueError:
            self.notify("Enter a valid number", severity="error")

    @on(Button.Pressed, "#qty_cancel")
    def cancel(self):
        self.dismiss(None)

# ---------- Main Menu ----------
class MainMenu(Screen):
    def compose(self) -> ComposeResult:
        yield Header()
        yield Container(
            Static("🏬 Hardware / Motorcycle Parts POS", id="title"),
            Vertical(
                Static("Dashboard Summary", id="dashboard_title"),
                Horizontal(
                    Static("Total Sales Today: $0.00", id="summary_sales"),
                    Static("Low Stock Alerts: 0", id="summary_low_stock"),
                    classes="dashboard_row"
                ),
                id="dashboard_container"
            ),
            Horizontal(
                Button("📦 Inventory", id="btn_inventory", variant="primary"),
                Button("🛒 Point of Sale", id="btn_pos", variant="success"),
                Button("📜 Sales History", id="btn_history"),
                Button("👥 Customers", id="btn_customers"),
                Button("💸 Expenses", id="btn_expenses"),
                Button("📊 Reports", id="btn_reports"),
                Button("👤 Users", id="btn_users"),
                Button("🔙 Logout", id="btn_logout"),
                classes="menu_buttons"
            ),
            id="main_container"
        )
        yield Footer()

    def on_mount(self):
        self.refresh_dashboard()

    def refresh_dashboard(self):
        today = datetime.now().strftime("%Y-%m-%d")
        summary = db.get_sales_summary(today)
        low_stock = db.get_low_stock_products(10)
        self.query_one("#summary_sales", Static).update(f"Total Sales Today: ${summary['total']:.2f}")
        self.query_one("#summary_low_stock", Static).update(f"Low Stock Alerts: {len(low_stock)}")
        if len(low_stock) > 0:
            self.query_one("#summary_low_stock", Static).add_class("warning")

    @on(Button.Pressed, "#btn_inventory")
    def go_inventory(self):
        self.app.push_screen(InventoryScreen())

    @on(Button.Pressed, "#btn_pos")
    def go_pos(self):
        self.app.push_screen(POSScreen(), lambda _: self.refresh_dashboard())

    @on(Button.Pressed, "#btn_history")
    def go_history(self):
        self.app.push_screen(SalesHistoryScreen())

    @on(Button.Pressed, "#btn_customers")
    def go_customers(self):
        self.app.push_screen(CustomerListScreen())

    @on(Button.Pressed, "#btn_expenses")
    def go_expenses(self):
        self.app.push_screen(ExpenseScreen())

    @on(Button.Pressed, "#btn_reports")
    def go_reports(self):
        self.app.push_screen(ReportScreen())

    @on(Button.Pressed, "#btn_users")
    def go_users(self):
        self.app.push_screen(UserManagementScreen())

    @on(Button.Pressed, "#btn_logout")
    def logout(self):
        self.app.pop_screen()

# ---------- Inventory Screen ----------
class InventoryScreen(Screen):
    def compose(self) -> ComposeResult:
        yield Header()
        yield Container(
            Static("📦 Inventory Management", id="title"),
            DataTable(id="product_table"),
            Horizontal(
                Input(placeholder="Search by name or SKU...", id="search_input"),
                Button("🔍 Search", id="btn_search"),
                Button("⚠️ Low Stock", id="btn_low_stock", variant="error"),
                Button("➕ Add Product", id="btn_add"),
                Button("✏️ Edit Selected", id="btn_edit"),
                Button("🗑 Delete Selected", id="btn_delete"),
                Button("🔙 Back", id="btn_back"),
                id="inventory_actions"
            ),
            id="inv_container"
        )
        yield Footer()

    def on_mount(self):
        self.load_table()

    def load_table(self, search_term="", low_stock_only=False):
        table = self.query_one("#product_table", DataTable)
        table.clear()
        table.add_columns("ID", "SKU", "Name", "Category", "Cost", "Price", "Stock")
        if low_stock_only:
            rows = db.get_low_stock_products(10)
        elif search_term:
            rows = db.search_products(search_term)
        else:
            rows = db.get_all_products()
        for row in rows:
            table.add_row(
                str(row["id"]), row["sku"], row["name"], row["category"] or "",
                f"{row['cost_price']:.2f}", f"{row['price']:.2f}", str(row["stock"])
            )

    @on(Button.Pressed, "#btn_search")
    def search(self):
        term = self.query_one("#search_input", Input).value
        self.load_table(term)

    @on(Button.Pressed, "#btn_low_stock")
    def show_low_stock(self):
        self.load_table(low_stock_only=True)

    @on(Button.Pressed, "#btn_add")
    def add_product(self):
        self.app.push_screen(ProductFormScreen(), lambda result: self.load_table() if result else None)

    @on(Button.Pressed, "#btn_edit")
    def edit_product(self):
        table = self.query_one("#product_table", DataTable)
        try:
            row_key = table.coordinate_to_cell_key(table.cursor_coordinate)
            row_data = table.get_row(row_key)
            if row_data:
                pid = int(row_data[0])
                self.app.push_screen(ProductFormScreen(product_id=pid), lambda result: self.load_table() if result else None)
        except Exception:
            self.notify("Select a product first.", severity="error")

    @on(Button.Pressed, "#btn_delete")
    def delete_product(self):
        table = self.query_one("#product_table", DataTable)
        try:
            row_key = table.coordinate_to_cell_key(table.cursor_coordinate)
            row_data = table.get_row(row_key)
            if row_data:
                pid = int(row_data[0])
                db.delete_product(pid)
                self.load_table()
                self.notify("Product deleted.")
        except Exception:
            self.notify("Select a product.", severity="error")

    @on(Button.Pressed, "#btn_back")
    def go_back(self):
        self.app.pop_screen()

class ProductFormScreen(Screen):
    def __init__(self, product_id=None):
        super().__init__()
        self.product_id = product_id

    def compose(self) -> ComposeResult:
        cats = db.get_categories()
        cat_opts = [(str(c["id"]), c["name"]) for c in cats]
        yield Header()
        yield Container(
            Static("Product Details", id="title"),
            Grid(
                Label("SKU:"), Input(placeholder="SKU", id="sku"),
                Label("Name:"), Input(placeholder="Name", id="name"),
                Label("Category:"), Select(options=cat_opts, id="category"),
                Label("Cost Price:"), Input(placeholder="Cost Price", id="cost_price", type="number"),
                Label("Selling Price:"), Input(placeholder="Price", id="price", type="number"),
                Label("Stock Level:"), Input(placeholder="Stock", id="stock", type="integer"),
                id="product_form_grid"
            ),
            Horizontal(
                Button("💾 Save", id="btn_save", variant="success"),
                Button("🔙 Cancel", id="btn_cancel"),
            ),
            id="form_container"
        )
        yield Footer()

    def on_mount(self):
        if self.product_id:
            conn = db.get_connection()
            row = conn.execute("SELECT * FROM products WHERE id=?", (self.product_id,)).fetchone()
            conn.close()
            if row:
                self.query_one("#sku", Input).value = row["sku"]
                self.query_one("#name", Input).value = row["name"]
                self.query_one("#category", Select).value = str(row["category_id"]) if row["category_id"] else None
                self.query_one("#cost_price", Input).value = str(row["cost_price"])
                self.query_one("#price", Input).value = str(row["price"])
                self.query_one("#stock", Input).value = str(row["stock"])

    @on(Button.Pressed, "#btn_save")
    def save(self):
        sku = self.query_one("#sku", Input).value.strip()
        name = self.query_one("#name", Input).value.strip()
        cat_sel = self.query_one("#category", Select).value
        category_id = int(cat_sel) if (cat_sel and cat_sel != "None") else None
        try:
            cost_price = float(self.query_one("#cost_price", Input).value)
            price = float(self.query_one("#price", Input).value)
            stock = int(self.query_one("#stock", Input).value)
        except ValueError:
            self.notify("Invalid numeric values", severity="error")
            return
        if not sku or not name:
            self.notify("SKU and Name required", severity="error")
            return
        if self.product_id:
            db.update_product(self.product_id, sku, name, category_id, cost_price, price, stock)
        else:
            db.add_product(sku, name, category_id, cost_price, price, stock)
        self.dismiss(True)
        self.notify("Product saved!")

    @on(Button.Pressed, "#btn_cancel")
    def cancel(self):
        self.dismiss(None)

# ---------- Sales History ----------
class SalesHistoryScreen(Screen):
    def compose(self) -> ComposeResult:
        yield Header()
        yield Container(
            Static("📜 Sales History", id="title"),
            DataTable(id="sales_table"),
            Horizontal(
                Button("👁 View Details", id="btn_view_sale", variant="primary"),
                Button("🔙 Back", id="btn_history_back"),
            ),
            id="history_container"
        )
        yield Footer()

    def on_mount(self):
        self.load_sales()

    def load_sales(self):
        table = self.query_one("#sales_table", DataTable)
        table.clear()
        table.add_columns("ID", "Timestamp", "Customer", "Total Amount")
        sales = db.get_recent_sales()
        for s in sales:
            table.add_row(str(s["id"]), s["timestamp"], s["customer"] or "Walk-in", f"${s['total']:.2f}")

    @on(Button.Pressed, "#btn_view_sale")
    def view_sale(self):
        table = self.query_one("#sales_table", DataTable)
        try:
            row_key = table.coordinate_to_cell_key(table.cursor_coordinate)
            row_data = table.get_row(row_key)
            if row_data:
                sale_id = int(row_data[0])
                items = db.get_sale_items(sale_id)
                receipt = f"--- Sale #{sale_id} Details ---\n"
                receipt += f"Date: {row_data[1]}\n"
                receipt += f"Customer: {row_data[2]}\n\n"
                for i in items:
                    receipt += f"{i['name']} ({i['sku']})\n  {i['quantity']} x ${i['price_per_unit']:.2f} = ${i['subtotal']:.2f}\n"
                receipt += f"\nTOTAL: {row_data[3]}\n"
                self.app.push_screen(ReceiptScreen(receipt))
        except:
            self.notify("Select a sale to view.", severity="error")

    @on(Button.Pressed, "#btn_history_back")
    def go_back(self):
        self.app.pop_screen()

# ---------- POS Screen (with barcode auto‑add and quantity popup) ----------
class POSScreen(Screen):
    def __init__(self):
        super().__init__()
        self.cart = []

    def compose(self) -> ComposeResult:
        yield Header()
        yield Container(
            Static("🛒 Point of Sale", id="title"),
            Horizontal(
                Container(
                    Input(placeholder="Search product (name/SKU or scan)...", id="pos_search"),
                    DataTable(id="pos_product_table"),
                    Horizontal(
                        Button("➕ Add to Cart", id="btn_add_cart"),
                        Button("🔍 Quick Add (SKU)", id="btn_quick", variant="primary"),
                    ),
                    id="pos_left"
                ),
                Container(
                    Static("🧾 Current Cart", id="cart_label"),
                    DataTable(id="cart_table"),
                    Static("Total: $0.00", id="total_label"),
                    Horizontal(
                        Button("🗑 Remove Item", id="btn_remove_item"),
                        Button("✅ Checkout", id="btn_checkout", variant="success"),
                    ),
                    id="pos_right"
                ),
            ),
            Horizontal(
                Select([("", "Walk-in Customer")], id="customer_select", prompt="Customer"),
                Button("🔄 Refresh Customer List", id="btn_refresh_cust"),
            ),
            Button("🔙 Back", id="btn_back_pos"),
            id="pos_container"
        )
        yield Footer()

    def on_mount(self):
        self.load_product_table()
        self.update_cart_table()
        self.load_customer_dropdown()

    def load_product_table(self, search_term=""):
        table = self.query_one("#pos_product_table", DataTable)
        table.clear()
        table.add_columns("ID", "SKU", "Name", "Price", "Stock")
        if search_term:
            rows = db.search_products(search_term)
        else:
            rows = db.get_all_products()
        for row in rows:
            table.add_row(
                str(row["id"]), row["sku"], row["name"],
                f"{row['price']:.2f}", str(row["stock"])
            )

    def load_customer_dropdown(self):
        customers = db.get_all_customers()
        options = [(str(c["id"]), c["name"]) for c in customers]
        self.query_one("#customer_select", Select).set_options(options)

    @on(Input.Submitted, "#pos_search")
    def search_or_scan(self):
        term = self.query_one("#pos_search", Input).value.strip()
        if not term:
            self.load_product_table()
            return
        prod = db.get_product_by_sku(term)
        if prod:
            self.query_one("#pos_search", Input).value = ""
            if prod["stock"] <= 0:
                self.notify("Out of stock!", severity="error")
                return
            self.app.push_screen(QuantityPopup(prod["name"], lambda qty: self._add_to_cart_from_scan(prod, qty)))
        else:
            self.load_product_table(term)

    def _add_to_cart_from_scan(self, prod, qty):
        if qty is None:
            return
        if qty > prod["stock"]:
            self.notify(f"Only {prod['stock']} in stock", severity="error")
            return
        for item in self.cart:
            if item["product_id"] == prod["id"]:
                new_qty = item["quantity"] + qty
                if new_qty > prod["stock"]:
                    self.notify("Not enough stock", severity="error")
                    return
                item["quantity"] = new_qty
                self.update_cart_table()
                return
        self.cart.append({
            "product_id": prod["id"],
            "name": prod["name"],
            "price": prod["price"],
            "quantity": qty
        })
        self.update_cart_table()

    @on(Button.Pressed, "#btn_add_cart")
    def add_to_cart(self):
        table = self.query_one("#pos_product_table", DataTable)
        try:
            row_key = table.coordinate_to_cell_key(table.cursor_coordinate)
            row_data = table.get_row(row_key)
            if row_data:
                pid = int(row_data[0])
                stock = int(row_data[4])
                if stock <= 0:
                    self.notify("Out of stock!", severity="error")
                    return
                name = row_data[2]
                self.app.push_screen(QuantityPopup(name, lambda qty: self._add_to_cart_from_table(pid, name, float(row_data[3]), qty)))
        except Exception as e:
            self.notify(f"Select a product first. {e}", severity="error")

    def _add_to_cart_from_table(self, pid, name, price, qty):
        if qty is None:
            return
        for item in self.cart:
            if item["product_id"] == pid:
                item["quantity"] += qty
                self.update_cart_table()
                return
        self.cart.append({
            "product_id": pid,
            "name": name,
            "price": price,
            "quantity": qty
        })
        self.update_cart_table()

    def update_cart_table(self):
        cart_table = self.query_one("#cart_table", DataTable)
        cart_table.clear()
        cart_table.add_columns("Product", "Price", "Qty", "Subtotal")
        total = 0
        for item in self.cart:
            subtotal = item["price"] * item["quantity"]
            cart_table.add_row(item["name"], f"{item['price']:.2f}", str(item["quantity"]), f"{subtotal:.2f}")
            total += subtotal
        self.query_one("#total_label", Static).update(f"Total: ${total:.2f}")

    @on(Button.Pressed, "#btn_remove_item")
    def remove_item(self):
        cart_table = self.query_one("#cart_table", DataTable)
        try:
            row_key = cart_table.coordinate_to_cell_key(cart_table.cursor_coordinate)
            if row_key and self.cart:
                idx = row_key.row_index
                if idx < len(self.cart):
                    del self.cart[idx]
                    self.update_cart_table()
        except Exception:
            self.notify("Select an item to remove.", severity="error")

    @on(Button.Pressed, "#btn_quick")
    def quick_add_sku(self):
        self.search_or_scan()

    @on(Button.Pressed, "#btn_checkout")
    def checkout(self):
        if not self.cart:
            self.notify("Cart is empty!", severity="error")
            return
        cust_val = self.query_one("#customer_select", Select).value
        cust_id = int(cust_val) if (cust_val and cust_val != "None") else None
        
        items = [{"product_id": i["product_id"], "quantity": i["quantity"]} for i in self.cart]
        
        try:
            total, sale_id = db.create_sale(items, cust_id)
            
            customer_name = "Walk-in"
            if cust_id:
                cust = db.get_connection().execute("SELECT name FROM customers WHERE id=?", (cust_id,)).fetchone()
                if cust:
                    customer_name = cust["name"]
            
            receipt = f"--- Receipt Sale #{sale_id} ---\n"
            receipt += f"Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n"
            receipt += f"Customer: {customer_name}\n\n"
            for i in self.cart:
                receipt += f"{i['name']} x{i['quantity']} @ ${i['price']:.2f} = ${i['price']*i['quantity']:.2f}\n"
            receipt += f"\nTOTAL: ${total:.2f}\n"
            receipt += "Thank you!"
            
            self.app.push_screen(ReceiptScreen(receipt))
            self.cart = []
            self.update_cart_table()
            self.load_product_table()
            self.query_one("#pos_search", Input).value = ""
            self.notify("Sale completed successfully!")
        except ValueError as e:
            self.notify(str(e), severity="error")
        except Exception as e:
            self.notify(f"Checkout failed: {e}", severity="error")

    @on(Button.Pressed, "#btn_back_pos")
    def go_back(self):
        self.app.pop_screen()

    @on(Button.Pressed, "#btn_refresh_cust")
    def refresh_customers(self):
        self.load_customer_dropdown()

class ReceiptScreen(Screen):
    def __init__(self, text):
        super().__init__()
        self.text = text

    def compose(self) -> ComposeResult:
        yield Header()
        yield Container(
            Static(self.text, id="receipt_text"),
            Button("Close", id="btn_close"),
            id="receipt_container"
        )
        yield Footer()

    @on(Button.Pressed, "#btn_close")
    def close(self):
        self.app.pop_screen()

# ---------- Customer Management ----------
class CustomerListScreen(Screen):
    def compose(self) -> ComposeResult:
        yield Header()
        yield Container(
            Static("👥 Customers", id="title"),
            DataTable(id="cust_table"),
            Horizontal(
                Input(placeholder="Search customers...", id="cust_search"),
                Button("🔍 Search", id="btn_cust_search"),
                Button("➕ New Customer", id="btn_cust_add"),
                Button("✏️ Edit", id="btn_cust_edit"),
                Button("🗑 Delete", id="btn_cust_delete"),
                Button("🔙 Back", id="btn_cust_back"),
            ),
            id="cust_container"
        )
        yield Footer()

    def on_mount(self):
        self.load_table()

    def load_table(self, term=""):
        table = self.query_one("#cust_table", DataTable)
        table.clear()
        table.add_columns("ID", "Name", "Phone", "Email")
        if term:
            rows = db.search_customers(term)
        else:
            rows = db.get_all_customers()
        for r in rows:
            table.add_row(str(r["id"]), r["name"], r["phone"] or "", r["email"] or "")

    @on(Button.Pressed, "#btn_cust_search")
    def search(self):
        self.load_table(self.query_one("#cust_search", Input).value)

    @on(Button.Pressed, "#btn_cust_add")
    def add_customer(self):
        self.app.push_screen(CustomerFormScreen())

    @on(Button.Pressed, "#btn_cust_edit")
    def edit_customer(self):
        table = self.query_one("#cust_table", DataTable)
        try:
            row_key = table.coordinate_to_cell_key(table.cursor_coordinate)
            row_data = table.get_row(row_key)
            if row_data:
                cid = int(row_data[0])
                self.app.push_screen(CustomerFormScreen(customer_id=cid))
        except:
            self.notify("Select a customer", severity="error")

    @on(Button.Pressed, "#btn_cust_delete")
    def delete_customer(self):
        table = self.query_one("#cust_table", DataTable)
        try:
            row_key = table.coordinate_to_cell_key(table.cursor_coordinate)
            row_data = table.get_row(row_key)
            if row_data:
                cid = int(row_data[0])
                db.delete_customer(cid)
                self.load_table()
                self.notify("Customer deleted.")
        except:
            self.notify("Select a customer", severity="error")

    @on(Button.Pressed, "#btn_cust_back")
    def go_back(self):
        self.app.pop_screen()

class CustomerFormScreen(Screen):
    def __init__(self, customer_id=None):
        super().__init__()
        self.customer_id = customer_id

    def compose(self) -> ComposeResult:
        yield Header()
        yield Container(
            Static("Customer Details", id="title"),
            Input(placeholder="Name", id="cust_name"),
            Input(placeholder="Phone", id="cust_phone"),
            Input(placeholder="Email", id="cust_email"),
            Horizontal(
                Button("💾 Save", id="btn_save_cust"),
                Button("🔙 Cancel", id="btn_cancel_cust"),
            ),
            id="cust_form"
        )
        yield Footer()

    def on_mount(self):
        if self.customer_id:
            conn = db.get_connection()
            row = conn.execute("SELECT * FROM customers WHERE id=?", (self.customer_id,)).fetchone()
            conn.close()
            if row:
                self.query_one("#cust_name", Input).value = row["name"]
                self.query_one("#cust_phone", Input).value = row["phone"] or ""
                self.query_one("#cust_email", Input).value = row["email"] or ""

    @on(Button.Pressed, "#btn_save_cust")
    def save(self):
        name = self.query_one("#cust_name", Input).value.strip()
        phone = self.query_one("#cust_phone", Input).value.strip()
        email = self.query_one("#cust_email", Input).value.strip()
        if not name:
            self.notify("Name required", severity="error")
            return
        if self.customer_id:
            db.update_customer(self.customer_id, name, phone, email)
        else:
            db.add_customer(name, phone, email)
        self.app.pop_screen()
        self.notify("Customer saved!")

    @on(Button.Pressed, "#btn_cancel_cust")
    def cancel(self):
        self.app.pop_screen()

# ---------- Expense Tracking ----------class ExpenseScreen(Screen):
    def compose(self) -> ComposeResult:
        yield Header()
        yield Container(
            Static("💸 Expenses", id="title"),
            DataTable(id="expense_table"),
            Horizontal(
                Button("➕ New Expense", id="btn_exp_add"),
                Button("🔙 Back", id="btn_exp_back"),
            ),
            id="exp_container"
        )
        yield Footer()

    def on_mount(self):
        self.load_expenses()

    def load_expenses(self):
        table = self.query_one("#expense_table", DataTable)
        table.clear()
        table.add_columns("ID", "Date/Time", "Amount", "Category", "Description")
        expenses = db.get_expenses()
        for e in expenses:
            table.add_row(str(e["id"]), e["timestamp"], f"${e['amount']:.2f}", e["category"], e["description"] or "")

    @on(Button.Pressed, "#btn_exp_add")
    def add_expense(self):
        self.app.push_screen(ExpenseFormScreen())

    @on(Button.Pressed, "#btn_exp_back")
    def go_back(self):
        self.app.pop_screen()

class ExpenseFormScreen(Screen):
    def compose(self) -> ComposeResult:
        yield Header()
        yield Container(
            Static("New Expense", id="title"),
            Input(placeholder="Amount", id="exp_amount", type="number"),
            Select([("Materials","Materials"), ("Utilities","Utilities"), ("Rent","Rent"), ("Wages","Wages"), ("Other","Other")], id="exp_category"),
            Input(placeholder="Description (optional)", id="exp_desc"),
            Horizontal(
                Button("💾 Save", id="btn_exp_save"),
                Button("🔙 Cancel", id="btn_exp_cancel"),
            ),
            id="exp_form"
        )
        yield Footer()

    @on(Button.Pressed, "#btn_exp_save")
    def save(self):
        try:
            amount = float(self.query_one("#exp_amount", Input).value)
        except:
            self.notify("Invalid amount", severity="error")
            return
        cat = self.query_one("#exp_category", Select).value
        desc = self.query_one("#exp_desc", Input).value.strip()
        db.add_expense(amount, cat, desc)
        self.app.pop_screen()
        self.notify("Expense recorded!")

    @on(Button.Pressed, "#btn_exp_cancel")
    def cancel(self):
        self.app.pop_screen()

# ---------- Reports ----------
class ReportScreen(Screen):
    def compose(self) -> ComposeResult:
        yield Header()
        yield Container(
            Static("📊 Daily Sales Report", id="title"),
            Input(placeholder="Date (YYYY-MM-DD), leave empty for today", id="report_date"),
            Button("🔄 Generate", id="btn_report_gen"),
            Static("", id="report_summary"),
            DataTable(id="report_products"),
            Button("🔙 Back", id="btn_report_back"),
            id="report_container"
        )
        yield Footer()

    def on_mount(self):
        self.query_one("#report_date", Input).value = datetime.now().strftime("%Y-%m-%d")

    @on(Button.Pressed, "#btn_report_gen")
    def generate(self):
        date_str = self.query_one("#report_date", Input).value.strip()
        if not date_str:
            date_str = datetime.now().strftime("%Y-%m-%d")
        summary = db.get_sales_summary(date_str)
        expenses = db.get_total_expenses(date_str)
        cogs = db.get_cogs(date_str)
        
        gross_profit = summary["total"] - cogs
        net_profit = gross_profit - expenses
        
        text = f"Date: {date_str}\n"
        text += f"Transactions: {summary['count']}\n"
        text += f"Total Sales: ${summary['total']:.2f}\n"
        text += f"Cost of Goods Sold: ${cogs:.2f}\n"
        text += f"Gross Profit: ${gross_profit:.2f}\n"
        text += f"Total Expenses: ${expenses:.2f}\n"
        text += f"Net Profit: ${net_profit:.2f}"
        self.query_one("#report_summary", Static).update(text)

        table = self.query_one("#report_products", DataTable)
        table.clear()
        table.add_columns("Product", "Sold", "Revenue")
        top = db.get_top_products(date_str, 10)
        for r in top:
            table.add_row(r["name"], str(r["sold"]), f"${r['revenue']:.2f}")

    @on(Button.Pressed, "#btn_report_back")
    def go_back(self):
        self.app.pop_screen()

# ---------- User Management (Admin only) ----------
class UserManagementScreen(Screen):
    def compose(self) -> ComposeResult:
        yield Header()
        yield Container(
            Static("👤 Users", id="title"),
            DataTable(id="user_table"),
            Horizontal(
                Button("➕ New User", id="btn_user_add"),
                Button("🗑 Delete User", id="btn_user_del"),
                Button("🔙 Back", id="btn_user_back"),
            ),
            id="user_container"
        )
        yield Footer()

    def on_mount(self):
        self.load_users()

    def load_users(self):
        table = self.query_one("#user_table", DataTable)
        table.clear()
        table.add_columns("ID", "Username", "Role")
        for u in db.get_all_users():
            table.add_row(str(u["id"]), u["username"], u["role"])

    @on(Button.Pressed, "#btn_user_add")
    def add_user(self):
        self.app.push_screen(NewUserScreen())

    @on(Button.Pressed, "#btn_user_del")
    def delete_user(self):
        table = self.query_one("#user_table", DataTable)
        try:
            row_key = table.coordinate_to_cell_key(table.cursor_coordinate)
            row_data = table.get_row(row_key)
            if row_data:
                uid = int(row_data[0])
                if uid == self.app.user["id"]:
                    self.notify("Cannot delete yourself!", severity="error")
                    return
                db.delete_user(uid)
                self.load_users()
                self.notify("User deleted.")
        except:
            self.notify("Select a user", severity="error")

    @on(Button.Pressed, "#btn_user_back")
    def go_back(self):
        self.app.pop_screen()

class NewUserScreen(Screen):
    def compose(self) -> ComposeResult:
        yield Header()
        yield Container(
            Static("Create User", id="title"),
            Input(placeholder="Username", id="new_username"),
            Input(placeholder="Password", id="new_password", password=True),
            Select([("cashier","Cashier"), ("admin","Admin")], id="new_role"),
            Horizontal(
                Button("💾 Save", id="btn_newuser_save"),
                Button("🔙 Cancel", id="btn_newuser_cancel"),
            ),
            id="newuser_form"
        )
        yield Footer()

    @on(Button.Pressed, "#btn_newuser_save")
    def save(self):
        user = self.query_one("#new_username", Input).value.strip()
        pw = self.query_one("#new_password", Input).value.strip()
        role = self.query_one("#new_role", Select).value
        if not user or not pw:
            self.notify("Fill all fields", severity="error")
            return
        db.add_user(user, pw, role)
        self.app.pop_screen()
        self.notify("User created!")

    @on(Button.Pressed, "#btn_newuser_cancel")
    def cancel(self):
        self.app.pop_screen()

