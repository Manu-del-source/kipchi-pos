from rest_framework import serializers
from .models import Product, Sale, SaleItem, Customer, User, StockAdjustment
from django.db import transaction

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'role', 'branch_name')

class StockAdjustmentSerializer(serializers.ModelSerializer):
    product_name = serializers.ReadOnlyField(source='product.name')
    user_name = serializers.ReadOnlyField(source='user.username')

    class Meta:
        model = StockAdjustment
        fields = '__all__'

    @transaction.atomic
    def create(self, validated_data):
        adjustment = StockAdjustment.objects.create(**validated_data)
        product = adjustment.product
        product.stock_level += adjustment.quantity
        product.save()
        return adjustment

class CustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = '__all__'

class ProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = '__all__'

class SaleItemSerializer(serializers.ModelSerializer):
    product_name = serializers.ReadOnlyField(source='product.name')
    class Meta:
        model = SaleItem
        fields = ('id', 'product', 'product_name', 'quantity', 'unit_price', 'subtotal')

class SaleSerializer(serializers.ModelSerializer):
    items = SaleItemSerializer(many=True)
    cashier_name = serializers.ReadOnlyField(source='cashier.username')
    customer_name = serializers.ReadOnlyField(source='customer.name')

    class Meta:
        model = Sale
        fields = ('id', 'sale_number', 'cashier', 'cashier_name', 'customer', 'customer_name', 
                  'total_amount', 'tax_amount', 'discount_amount', 'payment_method', 'items', 'created_at')

    @transaction.atomic
    def create(self, validated_data):
        items_data = validated_data.pop('items')
        sale = Sale.objects.create(**validated_data)
        
        for item_data in items_data:
            product = item_data['product']
            quantity = item_data['quantity']
            
            # Check stock
            if product.stock_level < quantity:
                raise serializers.ValidationError(f"Insufficient stock for {product.name}")
            
            # Create SaleItem
            SaleItem.objects.create(sale=sale, **item_data)
            
            # Deduct stock
            product.stock_level -= quantity
            product.save()
            
            # Log Inventory Change
            StockAdjustment.objects.create(
                product=product,
                user=sale.cashier,
                quantity=-quantity,
                type='ADJUST',
                notes=f"Sale {sale.sale_number}"
            )
            
        return sale
