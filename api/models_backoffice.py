from django.db import models
from .models import Product, User

class StockAdjustment(models.Model):
    ADJUSTMENT_TYPES = (
        ('RESTOCK', 'Restock/Purchase'),
        ('DAMAGE', 'Damaged Goods'),
        ('RETURN', 'Customer Return'),
        ('ADJUST', 'Manual Adjustment'),
    )
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='adjustments')
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    quantity = models.IntegerField()  # Positive or negative
    reason = models.CharField(max_length=10, choices=ADJUSTMENT_TYPES)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

# In views.py, add an Advanced Analytics view
from django.db.models import Sum, F
from django.db.models.functions import TruncDate

class AnalyticsViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAdminUser]

    @action(detail=False, methods=['get'])
    def daily_sales_trend(self, req):
        # Last 30 days of sales
        data = Sale.objects.annotate(date=TruncDate('created_at'))\
            .values('date')\
            .annotate(revenue=Sum('total_amount'), count=Count('id'))\
            .order_by('date')
        return Response(data)

    @action(detail=False, methods=['get'])
    def stock_value(self, req):
        # Total capital tied in inventory
        total_value = Product.objects.aggregate(
            total=Sum(F('stock_level') * F('cost_price'))
        )
        return Response(total_value)
