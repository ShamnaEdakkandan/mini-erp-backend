"""Basic ERP records. Posted business events are changed through services only."""

from decimal import Decimal

from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator
from django.db import models
from django.utils import timezone


ACTIVE = [("Active", "Active"), ("Inactive", "Inactive")]
METHODS = [("Cash", "Cash"), ("Bank transfer", "Bank transfer"), ("Card", "Card")]
ROLES = [("Admin", "Admin"), ("Manager", "Manager"), ("Staff", "Staff")]


def money_field(default=0):
    return models.DecimalField(max_digits=14, decimal_places=2, default=default,
                               validators=[MinValueValidator(Decimal("0"))])


class Owned(models.Model):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
                              related_name="%(class)s_records")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        abstract = True


class Membership(Owned):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
                                related_name="workspace_membership")
    role = models.CharField(max_length=7, choices=ROLES, default="Staff")

    def __str__(self):
        return f"{self.user.username} - {self.role}"


class Supplier(Owned):
    name = models.CharField(max_length=200)
    phone = models.CharField(max_length=30, blank=True)
    email = models.EmailField(blank=True)
    address = models.TextField(blank=True)
    status = models.CharField(max_length=8, choices=ACTIVE, default="Active")

    def __str__(self):
        return self.name


class Product(Owned):
    name = models.CharField(max_length=200)
    sku = models.CharField(max_length=80)
    category = models.CharField(max_length=100)
    cost = money_field()
    price = money_field()
    stock = models.PositiveIntegerField(default=0)
    min = models.PositiveIntegerField(default=0)
    unit = models.CharField(max_length=30, default="pcs")
    tax = models.DecimalField(max_digits=5, decimal_places=2, default=0,
                              validators=[MinValueValidator(0), MaxValueValidator(100)])
    status = models.CharField(max_length=8, choices=ACTIVE, default="Active")

    class Meta:
        constraints = [models.UniqueConstraint(fields=["owner", "sku"], name="workspace_sku")]

    def __str__(self):
        return f"{self.name} ({self.sku})"


class CompanySettings(Owned):
    company = models.CharField(max_length=200, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=30, blank=True)
    address = models.TextField(blank=True)
    currency = models.CharField(max_length=3, choices=[(x, x) for x in ["USD", "INR", "EUR", "GBP"]], default="USD")
    tax = models.DecimalField(max_digits=5, decimal_places=2, default=0,
                              validators=[MinValueValidator(0), MaxValueValidator(100)])
    prefix = models.CharField(max_length=30, default="INV-")
    next_number = models.PositiveIntegerField(default=1, validators=[MinValueValidator(1)])
    low_stock = models.BooleanField(default=True)
    show_address = models.BooleanField(default=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["owner"], name="one_company_per_workspace")]


class Document(Owned):
    KINDS = [(x, x) for x in ["Sale", "Purchase Order", "Purchase Bill"]]
    number = models.CharField(max_length=80)
    kind = models.CharField(max_length=14, choices=KINDS)
    customer = models.ForeignKey("customers.Customer", null=True, blank=True, on_delete=models.PROTECT)
    supplier = models.ForeignKey(Supplier, null=True, blank=True, on_delete=models.PROTECT)
    source_order = models.OneToOneField("self", null=True, blank=True, on_delete=models.PROTECT,
                                       related_name="converted_bill")
    date = models.DateField(default=timezone.localdate)
    status = models.CharField(max_length=6, choices=[("Draft", "Draft"), ("Posted", "Posted")], default="Draft")
    discount = money_field()
    subtotal = money_field()
    tax_total = money_field()
    total = money_field()
    cost_total = money_field()
    currency = models.CharField(max_length=3, default="USD")
    notes = models.TextField(blank=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["owner", "number"], name="workspace_document_number")]

    def __str__(self):
        return self.number


class DocumentLine(models.Model):
    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey(Product, on_delete=models.PROTECT)
    product_name = models.CharField(max_length=200)
    quantity = models.PositiveIntegerField(validators=[MinValueValidator(1), MaxValueValidator(1000000)])
    price = money_field()
    tax = models.DecimalField(max_digits=5, decimal_places=2, validators=[MinValueValidator(0), MaxValueValidator(100)])
    subtotal = money_field()
    tax_amount = money_field()
    total = money_field()
    unit_cost = money_field()


class StockMovement(Owned):
    product = models.ForeignKey(Product, on_delete=models.PROTECT)
    quantity = models.IntegerField()
    balance = models.PositiveIntegerField()
    kind = models.CharField(max_length=30)
    reason = models.CharField(max_length=300)
    document = models.ForeignKey(Document, null=True, blank=True, on_delete=models.PROTECT)


class Return(Owned):
    document = models.ForeignKey(Document, on_delete=models.PROTECT, related_name="returns")
    date = models.DateField(default=timezone.localdate)
    reason = models.CharField(max_length=300)
    total = money_field()
    tax_total = money_field()
    cost_total = money_field()


class ReturnLine(models.Model):
    return_record = models.ForeignKey(Return, on_delete=models.CASCADE, related_name="items")
    line = models.ForeignKey(DocumentLine, on_delete=models.PROTECT, related_name="returned_items")
    quantity = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    amount = money_field()
    tax_amount = money_field()
    cost_amount = money_field()


class Expense(Owned):
    date = models.DateField(default=timezone.localdate)
    name = models.CharField(max_length=200)
    category = models.CharField(max_length=100)
    amount = money_field()
    method = models.CharField(max_length=13, choices=METHODS, default="Cash")
    description = models.TextField(blank=True)


class Transaction(Owned):
    """Cash movement register, not a double-entry general ledger."""
    document = models.ForeignKey(Document, null=True, blank=True, on_delete=models.PROTECT,
                                 related_name="payments")
    expense = models.OneToOneField(Expense, null=True, blank=True, on_delete=models.CASCADE)
    date = models.DateField(default=timezone.localdate)
    name = models.CharField(max_length=200)
    category = models.CharField(max_length=20, choices=[(x, x) for x in ["Sales", "Purchases", "Expenses", "Opening balance"]])
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    method = models.CharField(max_length=13, choices=METHODS, default="Cash")
    refund = models.BooleanField(default=False)
