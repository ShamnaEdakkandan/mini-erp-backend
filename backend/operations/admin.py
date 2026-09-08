from django.contrib import admin

from . import models


class HistoryAdmin(admin.ModelAdmin):
    """Inspect financial history here; use validated API workflows to change it."""
    list_display = ["id", "owner", "created_at"]
    list_filter = ["owner"]

    def get_readonly_fields(self, request, obj=None):
        return [field.name for field in self.model._meta.fields]

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(models.Document)
class DocumentAdmin(HistoryAdmin):
    list_display = ["number", "kind", "status", "owner", "date", "total"]
    list_filter = ["kind", "status", "owner"]
    search_fields = ["number", "customer__name", "supplier__name"]


@admin.register(models.Product)
class ProductAdmin(HistoryAdmin):
    list_display = ["name", "sku", "owner", "stock", "status"]
    search_fields = ["name", "sku"]


for model in [models.Supplier, models.CompanySettings, models.Membership,
              models.StockMovement, models.Return, models.Expense, models.Transaction]:
    admin.site.register(model, HistoryAdmin)


class LineAdmin(admin.ModelAdmin):
    def get_readonly_fields(self, request, obj=None):
        return [field.name for field in self.model._meta.fields]

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


admin.site.register(models.DocumentLine, LineAdmin)
admin.site.register(models.ReturnLine, LineAdmin)
