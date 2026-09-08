from django.db import models
from django.conf import settings


class Customer(models.Model):
    """A customer's identity and contact details, without accounting totals."""

    STATUS_CHOICES = [
        ("Active", "Active"),
        ("Inactive", "Inactive"),
    ]

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True, related_name="customers")

    name = models.CharField(max_length=200)
    phone = models.CharField(max_length=30, blank=True)
    email = models.EmailField(blank=True)
    address = models.TextField(blank=True)
    status = models.CharField(
        max_length=8,
        choices=STATUS_CHOICES,
        default="Active",
    )

    def __str__(self):
        return self.name
