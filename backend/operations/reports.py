"""Read-only summaries derived from stored records, never from frontend totals."""

from decimal import Decimal

from django.db.models import Q
from rest_framework import serializers

from customers.models import Customer
from . import models, services
from .serializers import DocumentReadSerializer, ExpenseSerializer, ProductSerializer, TransactionSerializer


class ReportFilters(serializers.Serializer):
    date_from = serializers.DateField(required=False)
    date_to = serializers.DateField(required=False)
    search = serializers.CharField(required=False, allow_blank=True)
    limit = serializers.IntegerField(min_value=1, max_value=500, default=50)
    offset = serializers.IntegerField(min_value=0, default=0)

    def validate(self, data):
        if data.get("date_from") and data.get("date_to") and data["date_from"] > data["date_to"]:
            raise serializers.ValidationError("date_from cannot be after date_to.")
        return data


class SummarySerializer(serializers.Serializer):
    sales = serializers.DecimalField(max_digits=20, decimal_places=2)
    purchases = serializers.DecimalField(max_digits=20, decimal_places=2)
    expenses = serializers.DecimalField(max_digits=20, decimal_places=2)
    net_sales_excluding_tax = serializers.DecimalField(max_digits=20, decimal_places=2)
    cost_of_goods = serializers.DecimalField(max_digits=20, decimal_places=2)
    profit = serializers.DecimalField(max_digits=20, decimal_places=2)
    receivables = serializers.DecimalField(max_digits=20, decimal_places=2)
    payables = serializers.DecimalField(max_digits=20, decimal_places=2)
    customer_credit = serializers.DecimalField(max_digits=20, decimal_places=2)
    supplier_credit = serializers.DecimalField(max_digits=20, decimal_places=2)
    cash_balance = serializers.DecimalField(max_digits=20, decimal_places=2)
    bank_balance = serializers.DecimalField(max_digits=20, decimal_places=2)
    products = serializers.IntegerField()
    low_stock_items = serializers.IntegerField()
    basis = serializers.CharField()


class MonthSerializer(serializers.Serializer):
    month = serializers.CharField()
    total = serializers.DecimalField(max_digits=20, decimal_places=2)


class DashboardSerializer(SummarySerializer):
    recent_sales = DocumentReadSerializer(many=True)
    recent_purchases = DocumentReadSerializer(many=True)
    recent_transactions = TransactionSerializer(many=True)
    low_stock_products = ProductSerializer(many=True)
    sales_overview = MonthSerializer(many=True)


class ReportResponseSerializer(serializers.Serializer):
    report = serializers.CharField()
    count = serializers.IntegerField()
    results = serializers.ListField(child=serializers.DictField(), help_text="Document, product, expense, or contact balance rows according to the selected report. Profit-loss has no detail rows.")
    summary = SummarySerializer()


def dated(queryset, filters, since=True):
    if since and filters.get("date_from"):
        queryset = queryset.filter(date__gte=filters["date_from"])
    if filters.get("date_to"):
        queryset = queryset.filter(date__lte=filters["date_to"])
    return queryset


def outstanding(document, filters):
    net = document.total - services.total(dated(document.returns.all(), filters, since=False), "total")
    paid = services.total(dated(document.payments.all(), filters, since=False)) * (1 if document.kind == "Sale" else -1)
    return net, paid, max(net - paid, Decimal(0)), max(paid - net, Decimal(0))


def summary(owner, filters):
    posted = models.Document.objects.filter(owner=owner, status="Posted")
    documents = dated(posted, filters)
    sales = documents.filter(kind="Sale")
    purchases = documents.filter(kind="Purchase Bill")
    returns = dated(models.Return.objects.filter(owner=owner), filters)
    sales_returns = returns.filter(document__kind="Sale")
    purchase_returns = returns.filter(document__kind="Purchase Bill")
    expenses = services.total(dated(models.Expense.objects.filter(owner=owner), filters))
    sales_total = services.total(sales, "total") - services.total(sales_returns, "total")
    purchases_total = services.total(purchases, "total") - services.total(purchase_returns, "total")
    tax = services.total(sales, "tax_total") - services.total(sales_returns, "tax_total")
    cost = services.total(sales, "cost_total") - services.total(sales_returns, "cost_total")
    receivable = payable = customer_credit = supplier_credit = Decimal(0)
    for document in dated(posted.exclude(kind="Purchase Order"), filters, since=False):
        _, _, balance, credit = outstanding(document, filters)
        if document.kind == "Sale":
            receivable += balance
            customer_credit += credit
        else:
            payable += balance
            supplier_credit += credit
    transactions = dated(models.Transaction.objects.filter(owner=owner), filters, since=False)
    products = models.Product.objects.filter(owner=owner)
    from django.db.models import F
    return {
        "sales": str(sales_total), "purchases": str(purchases_total), "expenses": str(expenses),
        "net_sales_excluding_tax": str(sales_total - tax), "cost_of_goods": str(cost),
        "profit": str(sales_total - tax - cost - expenses),
        "receivables": str(receivable), "payables": str(payable),
        "customer_credit": str(customer_credit), "supplier_credit": str(supplier_credit),
        "cash_balance": str(services.total(transactions.filter(method="Cash"))),
        "bank_balance": str(services.total(transactions.exclude(method="Cash"))),
        "products": products.count(), "low_stock_items": products.filter(Q(stock__lt=F("min")) | Q(stock=0)).count(),
        "basis": "Posted document and return dates; profit excludes sales tax and uses product cost captured at sale posting. Cash and outstanding balances are cumulative through date_to. Inventory is current, not historical.",
    }


def contact_balances(owner, filters, supplier=False):
    contacts = (models.Supplier if supplier else Customer).objects.filter(owner=owner)
    if filters.get("search"):
        contacts = contacts.filter(name__icontains=filters["search"])
    documents = dated(models.Document.objects.filter(owner=owner, status="Posted", kind="Purchase Bill" if supplier else "Sale"), filters, since=False)
    result = []
    for contact in contacts.order_by("id"):
        matched = documents.filter(**{"supplier" if supplier else "customer": contact})
        net = paid = balance = credit = Decimal(0)
        for document in matched:
            values = outstanding(document, filters)
            net += values[0]
            paid += values[1]
            balance += values[2]
            credit += values[3]
        result.append({"id": contact.pk, "name": contact.name, "total": str(net), "paid": str(paid),
                       "balance": str(balance), "credit": str(credit)})
    return result


REPORT_NAMES = ["sales", "purchases", "inventory", "expenses", "customer-balances", "supplier-balances", "profit-loss"]


def report(owner, name, filters):
    totals = summary(owner, filters)
    if name in ["customer-balances", "supplier-balances"]:
        rows = contact_balances(owner, filters, supplier=name == "supplier-balances")
    elif name == "profit-loss":
        rows = []
    else:
        if name in ["sales", "purchases"]:
            query = dated(models.Document.objects.filter(owner=owner, status="Posted", kind="Sale" if name == "sales" else "Purchase Bill"), filters)
            if filters.get("search"):
                query = query.filter(Q(number__icontains=filters["search"]) | Q(customer__name__icontains=filters["search"]) | Q(supplier__name__icontains=filters["search"]))
            serializer = DocumentReadSerializer
        elif name == "inventory":
            query = models.Product.objects.filter(owner=owner)
            if filters.get("search"):
                query = query.filter(Q(name__icontains=filters["search"]) | Q(sku__icontains=filters["search"]))
            serializer = ProductSerializer
        else:
            query = dated(models.Expense.objects.filter(owner=owner), filters)
            if filters.get("search"):
                query = query.filter(name__icontains=filters["search"])
            serializer = ExpenseSerializer
        count = query.count()
        rows = serializer(query.order_by("id")[filters["offset"]:filters["offset"] + filters["limit"]], many=True).data
        return {"report": name, "count": count, "results": rows, "summary": totals}
    return {"report": name, "count": len(rows), "results": rows[filters["offset"]:filters["offset"] + filters["limit"]], "summary": totals}


def dashboard(owner, filters):
    data = summary(owner, filters)
    documents = dated(models.Document.objects.filter(owner=owner, status="Posted"), filters).order_by("-date", "-id")
    data["recent_sales"] = DocumentReadSerializer(documents.filter(kind="Sale")[:5], many=True).data
    data["recent_purchases"] = DocumentReadSerializer(documents.filter(kind="Purchase Bill")[:5], many=True).data
    data["recent_transactions"] = TransactionSerializer(dated(models.Transaction.objects.filter(owner=owner), filters).order_by("-date", "-id")[:5], many=True).data
    from django.db.models import F
    data["low_stock_products"] = ProductSerializer(models.Product.objects.filter(owner=owner).filter(Q(stock__lt=F("min")) | Q(stock=0)).order_by("stock", "id")[:10], many=True).data
    months = {}
    for sale in documents.filter(kind="Sale"):
        month = sale.date.strftime("%Y-%m")
        months[month] = months.get(month, Decimal(0)) + sale.total
    for returned in dated(models.Return.objects.filter(owner=owner, document__kind="Sale"), filters):
        month = returned.date.strftime("%Y-%m")
        months[month] = months.get(month, Decimal(0)) - returned.total
    data["sales_overview"] = [{"month": key, "total": str(value)} for key, value in sorted(months.items())]
    return data
