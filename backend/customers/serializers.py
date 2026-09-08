from rest_framework import serializers
from decimal import Decimal
from operations.models import Document
from operations.services import balances

from .models import Customer


class CustomerSerializer(serializers.ModelSerializer):
    """Convert customer records and validate incoming contact details."""

    total = serializers.SerializerMethodField()
    balance = serializers.SerializerMethodField()
    credit = serializers.SerializerMethodField()

    class Meta:
        model = Customer
        fields = ["id", "name", "phone", "email", "address", "status", "total", "balance", "credit"]
        read_only_fields = ["id"]

    def amount(self, obj, key):
        docs = Document.objects.filter(owner_id=obj.owner_id, customer=obj, kind="Sale", status="Posted")
        return str(sum((balances(doc)[key] for doc in docs), Decimal("0.00")))

    def get_total(self, obj) -> str:
        return self.amount(obj, "net_total")

    def get_balance(self, obj) -> str:
        return self.amount(obj, "balance")

    def get_credit(self, obj) -> str:
        return self.amount(obj, "credit")
