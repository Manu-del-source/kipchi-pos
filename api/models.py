from django.db import models
from django.contrib.auth.models import AbstractUser
from django.core.validators import MinValueValidator
from decimal import Decimal

class User(AbstractUser):
    ROLE_CHOICES = (
        ('ADMIN', 'Admin'),
        ('CASHIER', 'Cashier'),
    )
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='CASHIER')
    branch_name = models.CharField(max_length=100, default='Main Branch')

class Customer(models.Model):
    name = models.CharField(max_length=255)
    phone = models.CharField(max_length=15, unique=True, db_index=True)
    loyalty_points = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.phone})"

class Product(models.Model):
    name = models.CharField(max_length=255)
    barcode = models.CharField(max_length=50, unique=True, db_index=True)
    sku = models.CharField(max_length=50, blank=True, null=True)
    category = models.CharField(max_length=100, blank=True, null=True)
    price = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(Decimal('0.01'))])
    cost_price = models.DecimalField(max_digits=10, decimal_places=2)
    stock_level = models.IntegerField(default=0)
    low_stock_threshold = models.IntegerField(default=10)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

class Sale(models.Model):
    PAYMENT_METHODS = (
        ('CASH', 'Cash'),
        ('MPESA', 'M-Pesa'),
        ('SPLIT', 'Split Payment'),
    )
    sale_number = models.CharField(max_length=50, unique=True, db_index=True)
    cashier = models.ForeignKey(User, on_delete=models.PROTECT)
    customer = models.ForeignKey(Customer, on_delete=models.SET_NULL, null=True, blank=True)
    total_amount = models.DecimalField(max_digits=10, decimal_places=2)
    tax_amount = models.DecimalField(max_digits=10, decimal_places=2)
    discount_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    payment_method = models.CharField(max_length=10, choices=PAYMENT_METHODS)
    created_at = models.DateTimeField(auto_now_add=True)

class SaleItem(models.Model):
    sale = models.ForeignKey(Sale, related_name='items', on_delete=models.CASCADE)
    product = models.ForeignKey(Product, on_delete=models.PROTECT)
    quantity = models.IntegerField()
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    subtotal = models.DecimalField(max_digits=10, decimal_places=2)

class StockAdjustment(models.Model):
    ADJUSTMENT_TYPES = (
        ('RESTOCK', 'Restock/Purchase'),
        ('DAMAGE', 'Damaged Goods'),
        ('RETURN', 'Customer Return'),
        ('ADJUST', 'Manual Adjustment'),
        ('EXPIRE', 'Expired Goods'),
    )
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='adjustments')
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    quantity = models.IntegerField()  # Positive or negative
    type = models.CharField(max_length=10, choices=ADJUSTMENT_TYPES)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.type} - {self.product.name} ({self.quantity})"

