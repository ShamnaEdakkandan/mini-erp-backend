"""Business rules shared by the API. Keep stock and money changes atomic."""

from decimal import Decimal, ROUND_HALF_UP

from django.db import transaction
from django.db.models import F, Sum, Max
from rest_framework.exceptions import ValidationError

from .models import (CompanySettings, Document, DocumentLine, Product, Return,
                     ReturnLine, StockMovement, Transaction)


ZERO = Decimal("0.00")
MAX_MONEY = Decimal("999999999999.99")


def money(value):
    value = Decimal(value).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    if abs(value) > MAX_MONEY:
        raise ValidationError("Amount exceeds the supported limit.")
    return value


def total(queryset, field="amount"):
    return queryset.aggregate(value=Sum(field))["value"] or ZERO


def balances(document):
    returned = total(document.returns.all(), "total")
    net = document.total - returned
    paid = total(document.payments.all()) * (1 if document.kind == "Sale" else -1)
    return {"returned": returned, "net_total": net, "paid": paid,
            "balance": max(net - paid, ZERO), "credit": max(paid - net, ZERO),
            "payment_status": "Paid" if paid >= net else "Partial" if paid > 0 else "Unpaid"}


def validate_event_date(document, date):
    dates = [document.date,
             document.payments.aggregate(value=Max("date"))["value"],
             document.returns.aggregate(value=Max("date"))["value"]]
    if date < max(value for value in dates if value is not None):
        raise ValidationError({"date": "Payments and returns must be dated on or after the latest document event."})


def next_number(owner, kind):
    CompanySettings.objects.get_or_create(owner=owner)
    company = CompanySettings.objects.select_for_update().get(owner=owner)
    prefix = company.prefix if kind == "Sale" else "PO-" if kind == "Purchase Order" else "BILL-"
    number = f"{prefix}{company.next_number:06d}"
    if Document.objects.filter(owner=owner, number=number).exists():
        raise ValidationError("This document number exists. Increase the next number in Settings.")
    company.next_number += 1
    company.save(update_fields=["next_number"])
    return number, company.currency


def set_lines(document, items):
    """Allocate the document discount before tax; keep every stored total exact."""
    raw = [money(item["quantity"] * item["price"]) for item in items]
    subtotal = sum(raw, ZERO)
    if document.discount > subtotal:
        raise ValidationError({"discount": "Discount cannot exceed the subtotal."})
    document.items.all().delete()
    allocated = ZERO
    accumulated = ZERO
    tax_total = ZERO
    cost_total = ZERO
    for index, (item, base) in enumerate(zip(items, raw)):
        accumulated += base
        cumulative_discount = money(document.discount * accumulated / subtotal) if subtotal else ZERO
        discount = cumulative_discount - allocated
        allocated = cumulative_discount
        net = base - discount
        tax_amount = money(net * item["tax"] / 100)
        cost = money(item["product"].cost * item["quantity"])
        DocumentLine.objects.create(
            document=document, product=item["product"], product_name=item["product"].name,
            quantity=item["quantity"], price=item["price"], tax=item["tax"],
            subtotal=net, tax_amount=tax_amount, total=net + tax_amount,
            unit_cost=item["product"].cost)
        tax_total += tax_amount
        cost_total += cost
    document.subtotal = money(subtotal)
    document.tax_total = money(tax_total)
    document.total = money(subtotal - document.discount + tax_total)
    document.cost_total = money(cost_total)
    document.save()


@transaction.atomic
def save_document(owner, data, instance=None):
    items = data.pop("items", None)
    if instance:
        document = Document.objects.select_for_update().get(pk=instance.pk, owner=owner)
        if document.status != "Draft":
            raise ValidationError("Posted documents are immutable. Use a return or a payment.")
        for key, value in data.items():
            setattr(document, key, value)
    else:
        number, currency = next_number(owner, data["kind"])
        document = Document.objects.create(owner=owner, number=number, currency=currency, **data)
    if items is None:
        items = [dict(product=line.product, quantity=line.quantity, price=line.price, tax=line.tax)
                 for line in document.items.select_related("product")]
    set_lines(document, items)
    return document


def move_stock(owner, product, delta, kind, reason, document=None):
    """Called inside a transaction. Conditional updates also prevent negative stock."""
    queryset = Product.objects.filter(pk=product.pk, owner=owner)
    if delta < 0:
        queryset = queryset.filter(stock__gte=-delta)
    else:
        queryset = queryset.filter(stock__lte=1000000000 - delta)
    if not queryset.update(stock=F("stock") + delta):
        raise ValidationError(f"Insufficient stock or stock limit exceeded for {product.name}.")
    product.refresh_from_db()
    return StockMovement.objects.create(owner=owner, product=product, quantity=delta,
                                        balance=product.stock, kind=kind, reason=reason,
                                        document=document)


@transaction.atomic
def adjust_stock(owner, product, kind, quantity, reason):
    product = Product.objects.select_for_update().get(pk=product.pk, owner=owner)
    delta = quantity - product.stock if kind == "Adjustment" else quantity * (1 if kind == "In" else -1)
    if delta == 0:
        raise ValidationError("The movement must change the stock quantity.")
    return move_stock(owner, product, delta, kind, reason)


@transaction.atomic
def post_document(owner, instance):
    document = Document.objects.select_for_update().get(pk=instance.pk, owner=owner)
    if document.status != "Draft":
        raise ValidationError("This document has already been posted.")
    contact = document.customer if document.kind == "Sale" else document.supplier
    if not contact or contact.owner_id != owner.pk or contact.status != "Active":
        raise ValidationError("Choose an active contact in this workspace.")
    lines = list(document.items.select_related("product").order_by("product_id"))
    if not lines:
        raise ValidationError("Add at least one document line.")
    cost_total = ZERO
    for line in lines:
        product = Product.objects.select_for_update().get(pk=line.product_id, owner=owner)
        if product.status != "Active":
            raise ValidationError(f"{product.name} is inactive.")
        line.unit_cost = product.cost
        line.save(update_fields=["unit_cost"])
        cost_total += money(product.cost * line.quantity)
        if document.kind != "Purchase Order":
            move_stock(owner, product, line.quantity * (-1 if document.kind == "Sale" else 1),
                       document.kind, f"Posted {document.number}", document)
    document.cost_total = money(cost_total)
    document.status = "Posted"
    document.save(update_fields=["cost_total", "status"])
    return document


@transaction.atomic
def convert_order(owner, instance):
    order = Document.objects.select_for_update().get(pk=instance.pk, owner=owner)
    if order.kind != "Purchase Order" or order.status != "Posted":
        raise ValidationError("Only a posted purchase order can become a bill.")
    if Document.objects.filter(source_order=order).exists():
        raise ValidationError("This order already has a bill.")
    items = [dict(product=line.product, quantity=line.quantity, price=line.price, tax=line.tax)
             for line in order.items.select_related("product")]
    return save_document(owner, dict(kind="Purchase Bill", supplier=order.supplier,
                                     source_order=order, date=order.date, discount=order.discount,
                                     notes=order.notes, items=items))


@transaction.atomic
def record_payment(owner, document, amount, method, date, refund=False):
    document = Document.objects.select_for_update().get(pk=document.pk, owner=owner)
    if document.status != "Posted" or document.kind == "Purchase Order":
        raise ValidationError("Payments require a posted sale or purchase bill.")
    validate_event_date(document, date)
    state = balances(document)
    limit = state["credit" if refund else "balance"]
    if amount <= 0 or amount > limit:
        raise ValidationError({"amount": f"Amount must be positive and no more than {limit}."})
    sign = (1 if document.kind == "Sale" else -1) * (-1 if refund else 1)
    return Transaction.objects.create(owner=owner, document=document, date=date, amount=amount * sign,
                                       method=method, refund=refund,
                                       category="Sales" if document.kind == "Sale" else "Purchases",
                                       name=f"{'Refund' if refund else 'Payment'}: {document.number}")


@transaction.atomic
def create_return(owner, data):
    document = Document.objects.select_for_update().get(pk=data["document"].pk, owner=owner)
    if document.status != "Posted" or document.kind == "Purchase Order":
        raise ValidationError("Returns require a posted sale or purchase bill.")
    validate_event_date(document, data["date"])
    result = Return.objects.create(owner=owner, document=document, date=data["date"], reason=data["reason"])
    for item in sorted(data["items"], key=lambda item: item["line"].product_id):
        line, quantity = item["line"], item["quantity"]
        previous = line.returned_items.aggregate(qty=Sum("quantity"), amount=Sum("amount"), tax=Sum("tax_amount"), cost=Sum("cost_amount"))
        returned = previous["qty"] or 0
        if returned + quantity > line.quantity:
            raise ValidationError("Returned quantity exceeds the remaining document quantity.")
        ratio = Decimal(returned + quantity) / line.quantity
        amount = money(line.total * ratio) - (previous["amount"] or ZERO)
        tax = money(line.tax_amount * ratio) - (previous["tax"] or ZERO)
        cost = money(line.unit_cost * line.quantity * ratio) - (previous["cost"] or ZERO)
        ReturnLine.objects.create(return_record=result, line=line, quantity=quantity,
                                  amount=amount, tax_amount=tax, cost_amount=cost)
        move_stock(owner, line.product, quantity * (1 if document.kind == "Sale" else -1),
                   "Sales Return" if document.kind == "Sale" else "Purchase Return", data["reason"], document)
        result.total += amount
        result.tax_total += tax
        result.cost_total += cost
    result.save()
    return result
