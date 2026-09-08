from decimal import Decimal

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers
from drf_spectacular.utils import extend_schema_field

from . import models, services
from .permissions import workspace


class WorkspacePK(serializers.PrimaryKeyRelatedField):
    """Foreign keys may only reference records in the current workspace."""
    def __init__(self, model, owner_path="owner", **kwargs):
        self.related_model = model
        self.owner_path = owner_path
        super().__init__(queryset=model.objects.none(), **kwargs)

    def get_queryset(self):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return self.related_model.objects.none()
        owner, _ = workspace(request.user)
        return self.related_model.objects.filter(**{self.owner_path: owner})


class SupplierSerializer(serializers.ModelSerializer):
    total = serializers.SerializerMethodField()
    balance = serializers.SerializerMethodField()
    credit = serializers.SerializerMethodField()

    class Meta:
        model = models.Supplier
        fields = ["id", "name", "phone", "email", "address", "status", "total", "balance", "credit"]

    def amount(self, obj, key):
        docs = models.Document.objects.filter(owner_id=obj.owner_id, supplier=obj, kind="Purchase Bill", status="Posted")
        return str(sum((services.balances(doc)[key] for doc in docs), Decimal("0.00")))

    def get_total(self, obj) -> str:
        return self.amount(obj, "net_total")

    def get_balance(self, obj) -> str:
        return self.amount(obj, "balance")

    def get_credit(self, obj) -> str:
        return self.amount(obj, "credit")


class ProductSerializer(serializers.ModelSerializer):
    stock_status = serializers.SerializerMethodField()

    class Meta:
        model = models.Product
        fields = ["id", "name", "sku", "category", "cost", "price", "stock", "min", "unit", "tax", "status", "stock_status"]
        read_only_fields = ["stock"]
        validators = []
        extra_kwargs = {"min": {"max_value": 1000000000}}

    def validate_sku(self, value):
        owner, _ = workspace(self.context["request"].user)
        query = models.Product.objects.filter(owner=owner, sku=value)
        if self.instance:
            query = query.exclude(pk=self.instance.pk)
        if query.exists():
            raise serializers.ValidationError("This SKU already exists in your workspace.")
        return value

    def get_stock_status(self, obj) -> str:
        return "Out of Stock" if obj.stock == 0 else "Low Stock" if obj.stock < obj.min else "In Stock"


class CompanySerializer(serializers.ModelSerializer):
    class Meta:
        model = models.CompanySettings
        fields = ["company", "email", "phone", "address", "currency", "tax", "prefix", "next_number", "low_stock", "show_address"]

    def validate(self, attrs):
        owner, _ = workspace(self.context["request"].user)
        if self.instance:
            if attrs.get("next_number", self.instance.next_number) < self.instance.next_number:
                raise serializers.ValidationError({"next_number": "Document numbering cannot move backwards."})
            if attrs.get("currency", self.instance.currency) != self.instance.currency:
                if models.Document.objects.filter(owner=owner).exists() or models.Transaction.objects.filter(owner=owner).exists():
                    raise serializers.ValidationError({"currency": "Currency is locked after financial records exist."})
        return attrs


class LineInputSerializer(serializers.Serializer):
    product = WorkspacePK(models.Product)
    quantity = serializers.IntegerField(min_value=1, max_value=1000000)
    price = serializers.DecimalField(max_digits=14, decimal_places=2, min_value=0)
    tax = serializers.DecimalField(max_digits=5, decimal_places=2, min_value=0, max_value=100, default=0)


class LineSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.DocumentLine
        fields = ["id", "product", "product_name", "quantity", "price", "tax", "subtotal", "tax_amount", "total", "unit_cost"]


class DocumentSerializer(serializers.ModelSerializer):
    from customers.models import Customer
    customer = WorkspacePK(Customer, required=False, allow_null=True)
    supplier = WorkspacePK(models.Supplier, required=False, allow_null=True)
    items = LineInputSerializer(many=True, allow_empty=False)
    balances = serializers.SerializerMethodField()

    class Meta:
        model = models.Document
        fields = ["id", "number", "kind", "customer", "supplier", "source_order", "date", "status",
                  "discount", "subtotal", "tax_total", "total", "cost_total", "currency", "notes", "items", "balances"]
        read_only_fields = ["number", "status", "source_order", "subtotal", "tax_total", "total", "cost_total", "currency"]
        validators = []

    def validate(self, attrs):
        kind = attrs.get("kind", getattr(self.instance, "kind", None))
        if self.instance and kind != self.instance.kind:
            raise serializers.ValidationError({"kind": "A document's kind cannot be changed."})
        customer = attrs.get("customer", getattr(self.instance, "customer", None))
        supplier = attrs.get("supplier", getattr(self.instance, "supplier", None))
        if kind == "Sale" and (not customer or supplier):
            raise serializers.ValidationError("A sale requires a customer and no supplier.")
        if kind != "Sale" and (not supplier or customer):
            raise serializers.ValidationError("A purchase requires a supplier and no customer.")
        if len(attrs.get("items", [])) > 100:
            raise serializers.ValidationError("A document supports at most 100 lines.")
        products = [item["product"].pk for item in attrs.get("items", [])]
        if len(products) != len(set(products)):
            raise serializers.ValidationError("Use one line per product.")
        return attrs

    def create(self, validated_data):
        owner = validated_data.pop("owner")
        return services.save_document(owner, validated_data)

    def update(self, instance, validated_data):
        return services.save_document(instance.owner, validated_data, instance)

    @extend_schema_field({"type": "object", "properties": {
        **{key: {"type": "string", "format": "decimal"} for key in ["returned", "net_total", "paid", "balance", "credit"]},
        "payment_status": {"type": "string", "enum": ["Paid", "Partial", "Unpaid"]}}})
    def get_balances(self, obj):
        values = services.balances(obj)
        return {key: str(value) for key, value in values.items()}

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["items"] = LineSerializer(instance.items.all(), many=True).data
        return data


class DocumentReadSerializer(DocumentSerializer):
    """Response includes immutable line IDs and calculation snapshots."""
    items = LineSerializer(many=True, read_only=True)


class StockInputSerializer(serializers.Serializer):
    product = WorkspacePK(models.Product)
    kind = serializers.ChoiceField(choices=["In", "Out", "Adjustment"])
    quantity = serializers.IntegerField(min_value=0, max_value=1000000000)
    reason = serializers.CharField(max_length=300)

    def validate(self, attrs):
        if attrs["kind"] != "Adjustment" and attrs["quantity"] == 0:
            raise serializers.ValidationError({"quantity": "Quantity must be positive."})
        return attrs


class StockSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.StockMovement
        fields = ["id", "product", "quantity", "balance", "kind", "reason", "document", "created_at"]


class PaymentSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=14, decimal_places=2, min_value=Decimal("0.01"))
    method = serializers.ChoiceField(choices=models.METHODS)
    date = serializers.DateField(default=timezone.localdate)
    refund = serializers.BooleanField(default=False)


class ReturnItemInputSerializer(serializers.Serializer):
    line = WorkspacePK(models.DocumentLine, owner_path="document__owner")
    quantity = serializers.IntegerField(min_value=1, max_value=1000000)


class ReturnInputSerializer(serializers.Serializer):
    document = WorkspacePK(models.Document)
    date = serializers.DateField(default=timezone.localdate)
    reason = serializers.CharField(max_length=300)
    items = ReturnItemInputSerializer(many=True, allow_empty=False, max_length=100)

    def validate(self, attrs):
        lines = [item["line"].pk for item in attrs["items"]]
        if len(lines) != len(set(lines)):
            raise serializers.ValidationError("Each original line may appear once per return.")
        if any(item["line"].document_id != attrs["document"].pk for item in attrs["items"]):
            raise serializers.ValidationError("All return lines must belong to the selected document.")
        return attrs


class ReturnItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.ReturnLine
        fields = ["id", "line", "quantity", "amount", "tax_amount", "cost_amount"]


class ReturnSerializer(serializers.ModelSerializer):
    items = ReturnItemSerializer(many=True)

    class Meta:
        model = models.Return
        fields = ["id", "document", "date", "reason", "total", "tax_total", "cost_total", "items"]


class ExpenseSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Expense
        fields = ["id", "date", "name", "category", "amount", "method", "description"]
        extra_kwargs = {"amount": {"min_value": Decimal("0.01")}}

    def sync_transaction(self, expense):
        models.Transaction.objects.update_or_create(expense=expense, defaults={
            "owner": expense.owner, "date": expense.date, "name": expense.name,
            "category": "Expenses", "amount": -expense.amount, "method": expense.method})

    @transaction.atomic
    def create(self, validated_data):
        expense = super().create(validated_data)
        self.sync_transaction(expense)
        return expense

    @transaction.atomic
    def update(self, instance, validated_data):
        expense = super().update(instance, validated_data)
        self.sync_transaction(expense)
        return expense


class TransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Transaction
        fields = ["id", "date", "name", "category", "amount", "method", "document", "expense", "refund"]


class OpeningBalanceSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=14, decimal_places=2)
    method = serializers.ChoiceField(choices=["Cash", "Bank transfer"])
    date = serializers.DateField(default=timezone.localdate)
    name = serializers.CharField(max_length=200, default="Opening balance")


class UserSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="first_name", max_length=150, required=False, allow_blank=True)
    role = serializers.ChoiceField(choices=models.ROLES, default="Staff")
    status = serializers.ChoiceField(choices=models.ACTIVE, default="Active")
    password = serializers.CharField(write_only=True, required=False, trim_whitespace=False)

    class Meta:
        model = get_user_model()
        fields = ["id", "username", "name", "email", "password", "role", "status"]

    def validate(self, attrs):
        owner, _ = workspace(self.context["request"].user)
        if self.instance and self.instance.pk in [owner.pk, self.context["request"].user.pk]:
            if attrs.get("status", "Active") != "Active" or attrs.get("role", "Admin") != "Admin":
                raise serializers.ValidationError("You cannot deactivate or demote yourself or the workspace owner.")
        if not self.instance and "password" not in attrs:
            raise serializers.ValidationError({"password": "A password is required for a new team account."})
        if "password" in attrs:
            candidate = get_user_model()(username=attrs.get("username", getattr(self.instance, "username", "")), email=attrs.get("email", ""))
            try:
                validate_password(attrs["password"], candidate)
            except DjangoValidationError as exc:
                raise serializers.ValidationError({"password": exc.messages})
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        owner = validated_data.pop("owner")
        role = validated_data.pop("role", "Staff")
        active = validated_data.pop("status", "Active") == "Active"
        user = get_user_model().objects.create_user(**validated_data, is_active=active)
        models.Membership.objects.create(owner=owner, user=user, role=role)
        return user

    @transaction.atomic
    def update(self, instance, validated_data):
        role = validated_data.pop("role", None)
        state = validated_data.pop("status", None)
        password = validated_data.pop("password", None)
        for key, value in validated_data.items():
            setattr(instance, key, value)
        if state is not None:
            instance.is_active = state == "Active"
        if password is not None:
            instance.set_password(password)
        instance.save()
        if role is not None:
            models.Membership.objects.filter(user=instance).update(role=role)
        return instance

    def to_representation(self, instance):
        return {"id": instance.pk, "username": instance.username, "name": instance.first_name,
                "email": instance.email, "role": workspace(instance)[1],
                "status": "Active" if instance.is_active else "Inactive"}
