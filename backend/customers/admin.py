from django.contrib import admin
from .models import Customer


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ["name", "email", "phone", "owner", "status"]
    list_filter = ["status", "owner"]
    search_fields = ["name", "email", "phone"]

    def get_readonly_fields(self, request, obj=None):
        # Legacy unowned contacts may be deliberately assigned by a superuser.
        return ["owner"] if not request.user.is_superuser or (obj and obj.owner_id) else []
