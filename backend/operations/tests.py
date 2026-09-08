from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import Client
from rest_framework.test import APITestCase

from customers.models import Customer
from . import models


class ERPTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.owner = get_user_model().objects.create_user(username="erp-owner", password="Cedar!8736River")
        cls.other = get_user_model().objects.create_user(username="other-owner", password="Cedar!8736River")
        cls.customer = Customer.objects.create(owner=cls.owner, name="Customer")
        cls.foreign_customer = Customer.objects.create(owner=cls.other, name="Foreign customer")
        cls.supplier = models.Supplier.objects.create(owner=cls.owner, name="Supplier")
        cls.product = models.Product.objects.create(owner=cls.owner, name="Keyboard", sku="KEY-1", category="Electronics", cost=4, price=10, min=3)
        cls.foreign_product = models.Product.objects.create(owner=cls.other, name="Private", sku="KEY-1", category="Electronics", price=12)

    def setUp(self):
        self.client.force_login(self.owner)

    def post(self, path, data, expected=201):
        response = self.client.post("/api/" + path, data, format="json")
        self.assertEqual(response.status_code, expected, response.data)
        return response.data

    def stock(self, quantity=10, product=None):
        return self.post("stock-movements/", {"product": (product or self.product).pk, "kind": "In", "quantity": quantity, "reason": "Opening stock"})

    def draft(self, kind="Sale", quantity=2, price="10.00", tax="0.00", discount="0.00", **extra):
        data = {"kind": kind, "date": "2026-09-07", "discount": discount,
                "items": [{"product": self.product.pk, "quantity": quantity, "price": price, "tax": tax}]}
        data["customer" if kind == "Sale" else "supplier"] = (self.customer if kind == "Sale" else self.supplier).pk
        data.update(extra)
        return self.post("documents/", data)

    def posted(self, **kwargs):
        self.stock()
        doc = self.draft(**kwargs)
        return self.post(f"documents/{doc['id']}/post/", {}, 200)

    def payment(self, doc, amount, refund=False, expected=201):
        return self.post(f"documents/{doc['id']}/payments/", {"amount": amount, "method": "Cash", "date": "2026-09-07", "refund": refund}, expected)

    def returned(self, doc, quantity, expected=201):
        return self.post("returns/", {"document": doc["id"], "date": "2026-09-07", "reason": "Customer return", "items": [{"line": doc["items"][0]["id"], "quantity": quantity}]}, expected)

    def test_draft_decimal_totals_and_no_stock_effect(self):
        doc = self.draft(tax="5.00", discount="1.00")
        self.assertEqual(doc["subtotal"], "20.00")
        self.assertEqual(doc["tax_total"], "0.95")
        self.assertEqual(doc["total"], "19.95")
        self.assertEqual(doc["items"][0]["subtotal"], "19.00")
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 0)
        self.assertEqual(models.Transaction.objects.count(), 0)
        self.assertEqual(models.StockMovement.objects.count(), 0)

    def test_invalid_document_rolls_back_number_and_lines(self):
        self.post("documents/", {"kind": "Sale", "customer": self.customer.pk, "discount": "100", "items": [{"product": self.product.pk, "quantity": 1, "price": "10"}]}, 400)
        self.assertEqual(models.Document.objects.count(), 0)
        self.assertEqual(models.DocumentLine.objects.count(), 0)
        self.assertEqual(self.draft()["number"], "INV-000001")

    def test_draft_update_recalculates_and_delete(self):
        doc = self.draft()
        response = self.client.patch(f"/api/documents/{doc['id']}/", {"discount": "2.50"}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["total"], "17.50")
        self.assertEqual(self.client.delete(f"/api/documents/{doc['id']}/").status_code, 204)
        self.assertEqual(models.DocumentLine.objects.count(), 0)

    def test_atomic_post_and_duplicate_post_guard(self):
        doc = self.posted()
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 8)
        self.assertEqual(doc["status"], "Posted")
        self.post(f"documents/{doc['id']}/post/", {}, 400)
        self.assertEqual(models.StockMovement.objects.count(), 2)
        self.assertEqual(self.client.patch(f"/api/documents/{doc['id']}/", {"discount": 1}, format="json").status_code, 400)
        self.assertEqual(self.client.delete(f"/api/documents/{doc['id']}/").status_code, 400)

    def test_post_failure_rolls_back_all_product_movements(self):
        second = models.Product.objects.create(owner=self.owner, name="Empty", sku="EMPTY", category="Office")
        self.stock(5)
        doc = self.draft(items=[{"product": self.product.pk, "quantity": 2, "price": "10"}, {"product": second.pk, "quantity": 2, "price": "10"}])
        self.post(f"documents/{doc['id']}/post/", {}, 400)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 5)
        self.assertEqual(models.StockMovement.objects.count(), 1)
        self.assertEqual(models.Document.objects.get(pk=doc["id"]).status, "Draft")

    def test_purchase_order_conversion_and_bill_stock(self):
        order = self.draft(kind="Purchase Order", quantity=4)
        self.post(f"documents/{order['id']}/convert-to-bill/", {}, 400)
        self.post(f"documents/{order['id']}/post/", {}, 200)
        self.assertEqual(models.StockMovement.objects.count(), 0)
        self.payment(order, "1", expected=400)
        bill = self.post(f"documents/{order['id']}/convert-to-bill/", {})
        self.assertEqual(bill["kind"], "Purchase Bill")
        self.assertEqual(bill["source_order"], order["id"])
        self.post(f"documents/{order['id']}/convert-to-bill/", {}, 400)
        self.post(f"documents/{bill['id']}/post/", {}, 200)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 4)
        entry = self.payment(bill, "15")
        self.assertEqual(entry["amount"], "-15.00")

    def test_payment_balances_and_overpayment_guard(self):
        doc = self.posted()
        self.payment(doc, "5")
        current = self.client.get(f"/api/documents/{doc['id']}/").data
        self.assertEqual(current["balances"]["payment_status"], "Partial")
        self.assertEqual(current["balances"]["balance"], "15.00")
        self.payment(doc, "16", expected=400)
        self.payment(doc, "0", expected=400)
        self.payment(doc, "15")
        self.payment(doc, "1", expected=400)
        self.assertEqual(models.Transaction.objects.count(), 2)
        self.assertEqual(self.client.get(f"/api/documents/{doc['id']}/").data["balances"]["payment_status"], "Paid")

    def test_return_credit_refund_and_quantity_limits(self):
        doc = self.posted()
        self.payment(doc, "20")
        self.payment(doc, "1", refund=True, expected=400)
        returned = self.returned(doc, 1)
        self.assertEqual(returned["total"], "10.00")
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 9)
        current = self.client.get(f"/api/documents/{doc['id']}/").data
        self.assertEqual(current["balances"]["credit"], "10.00")
        self.assertEqual(self.payment(doc, "10", refund=True)["amount"], "-10.00")
        self.returned(doc, 2, expected=400)
        self.returned(doc, 1)
        self.payment(doc, "10", refund=True)
        self.assertEqual(sum(models.Transaction.objects.values_list("amount", flat=True)), 0)
        self.assertEqual(models.Return.objects.count(), 2)

    def test_purchase_return_cannot_make_stock_negative(self):
        bill = self.draft(kind="Purchase Bill", quantity=2)
        bill = self.post(f"documents/{bill['id']}/post/", {}, 200)
        self.post("stock-movements/", {"product": self.product.pk, "kind": "Out", "quantity": 2, "reason": "Consumed"})
        self.returned(bill, 1, expected=400)
        self.assertEqual(models.Return.objects.count(), 0)
        self.assertEqual(models.ReturnLine.objects.count(), 0)

    def test_return_rounding_reconciles_full_original_total(self):
        doc = self.posted(quantity=3, price="0.05", tax="10", discount="0.01")
        parts = [Decimal(self.returned(doc, 1)["total"]) for _ in range(3)]
        self.assertEqual(sum(parts), Decimal(doc["total"]))
        self.assertEqual(sum(models.Return.objects.values_list("tax_total", flat=True)), Decimal(doc["tax_total"]))

    def test_multi_line_discount_rounding_never_negative(self):
        items = []
        for index in range(10):
            product = models.Product.objects.create(owner=self.owner, name=f"Small {index}", sku=f"SM-{index}", category="Office")
            items.append({"product": product.pk, "quantity": 1, "price": "0.01", "tax": "10"})
        doc = self.draft(items=items, discount="0.04")
        self.assertTrue(all(Decimal(line["subtotal"]) >= 0 for line in doc["items"]))
        self.assertEqual(sum(Decimal(line["total"]) for line in doc["items"]), Decimal(doc["total"]))

    def test_stock_adjustment_and_readonly_stock_field(self):
        self.stock(4)
        self.post("stock-movements/", {"product": self.product.pk, "kind": "Adjustment", "quantity": 1, "reason": "Counted"})
        self.post("stock-movements/", {"product": self.product.pk, "kind": "Out", "quantity": 2, "reason": "Too many"}, 400)
        self.client.patch(f"/api/products/{self.product.pk}/", {"stock": 1000}, format="json")
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 1)
        self.assertEqual(self.client.get(f"/api/products/{self.product.pk}/").data["stock_status"], "Low Stock")
        self.assertEqual(self.client.get("/api/products/?stock_status=Low%20Stock").data["count"], 1)

    def test_expense_transaction_stays_in_sync(self):
        expense = self.post("expenses/", {"name": "Rent", "category": "Office", "amount": "10", "method": "Cash", "date": "2026-09-07"})
        self.assertEqual(models.Transaction.objects.get(expense_id=expense["id"]).amount, Decimal("-10"))
        response = self.client.patch(f"/api/expenses/{expense['id']}/", {"amount": "12", "method": "Card"}, format="json")
        self.assertEqual(response.status_code, 200)
        entry = models.Transaction.objects.get(expense_id=expense["id"])
        self.assertEqual(entry.amount, Decimal("-12"))
        self.assertEqual(entry.method, "Card")
        self.assertEqual(self.client.delete(f"/api/expenses/{expense['id']}/").status_code, 204)
        self.assertEqual(models.Transaction.objects.count(), 0)

    def test_foreign_keys_cannot_cross_workspaces(self):
        self.post("documents/", {"kind": "Sale", "customer": self.foreign_customer.pk, "items": [{"product": self.product.pk, "quantity": 1, "price": "1"}]}, 400)
        self.post("documents/", {"kind": "Sale", "customer": self.customer.pk, "items": [{"product": self.foreign_product.pk, "quantity": 1, "price": "1"}]}, 400)
        self.post("stock-movements/", {"product": self.foreign_product.pk, "quantity": 1, "kind": "In", "reason": "Unauthorized"}, 400)
        self.assertEqual(self.client.get(f"/api/products/{self.foreign_product.pk}/").status_code, 404)
        self.assertEqual(self.client.get("/api/products/").data["count"], 1)

    def test_unrelated_return_lines_and_duplicate_lines_rejected(self):
        first = self.posted()
        second = self.posted()
        self.post("returns/", {"document": first["id"], "reason": "Wrong", "items": [{"line": second["items"][0]["id"], "quantity": 1}]}, 400)
        self.post("returns/", {"document": first["id"], "reason": "Duplicate", "items": [{"line": first["items"][0]["id"], "quantity": 1}] * 2}, 400)
        self.assertEqual(models.Return.objects.count(), 0)

    def test_referenced_records_cannot_be_deleted(self):
        self.draft()
        for path in [f"customers/{self.customer.pk}/", f"products/{self.product.pk}/"]:
            self.assertEqual(self.client.delete("/api/" + path).status_code, 409)

    def test_users_roles_and_deactivation(self):
        user = self.post("users/", {"username": "teammate", "password": "Cedar!8736River", "name": "Team mate", "role": "Staff"})
        member = get_user_model().objects.get(pk=user["id"])
        self.assertTrue(member.check_password("Cedar!8736River"))
        self.assertFalse(member.is_staff)
        self.client.force_login(member)
        self.assertEqual(self.client.get("/api/customers/").data[0]["id"], self.customer.pk)
        created = self.post("customers/", {"name": "Staff customer"})
        self.assertEqual(self.client.patch(f"/api/customers/{created['id']}/", {"phone": "12345"}, format="json").status_code, 200)
        self.assertEqual(self.client.delete(f"/api/customers/{created['id']}/").status_code, 403)
        self.assertEqual(self.client.patch("/api/settings/", {"company": "Forbidden"}, format="json").status_code, 403)
        self.assertEqual(self.client.post("/api/users/", {"username": "forbidden"}, format="json").status_code, 403)
        self.assertEqual(self.client.get("/api/users/").status_code, 403)
        self.client.force_login(self.owner)
        self.assertEqual(self.client.patch(f"/api/users/{member.pk}/", {"role": "Manager"}, format="json").status_code, 200)
        self.client.force_login(member)
        self.post("suppliers/", {"name": "Team supplier"})
        self.assertEqual(self.client.patch("/api/settings/", {"company": "Forbidden"}, format="json").status_code, 403)
        self.client.force_login(self.owner)
        self.assertEqual(self.client.delete(f"/api/users/{member.pk}/").status_code, 204)
        member.refresh_from_db()
        self.assertFalse(member.is_active)
        self.assertTrue(models.Membership.objects.filter(user=member).exists())

    def test_owner_protection_and_no_global_user_exposure(self):
        self.assertEqual(self.client.get("/api/users/").data["count"], 1)
        self.assertEqual(self.client.get(f"/api/users/{self.other.pk}/").status_code, 404)
        self.assertEqual(self.client.delete(f"/api/users/{self.owner.pk}/").status_code, 400)
        self.assertEqual(self.client.patch(f"/api/users/{self.owner.pk}/", {"role": "Staff"}, format="json").status_code, 400)
        self.post("users/", {"username": "weak", "password": "123"}, 400)

    def test_settings_numbering_currency_lock_and_opening_balance(self):
        response = self.client.patch("/api/settings/", {"company": "My company", "prefix": "SALE-", "next_number": 25, "currency": "INR"}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        doc = self.draft()
        self.assertEqual(doc["number"], "SALE-000025")
        self.assertEqual(doc["currency"], "INR")
        self.assertEqual(self.client.patch("/api/settings/", {"currency": "USD"}, format="json").status_code, 400)
        self.assertEqual(self.client.patch("/api/settings/", {"next_number": 1}, format="json").status_code, 400)
        self.post("transactions/opening-balance/", {"amount": "100", "method": "Cash", "date": "2026-09-01"})
        self.post("transactions/opening-balance/", {"amount": "100", "method": "Cash"}, 400)
        self.assertEqual(Decimal(self.client.get("/api/accounting/").data["cash_balance"]), 100)

    def test_dashboard_accounting_and_reports_use_actual_records(self):
        doc = self.posted(tax="10")
        self.payment(doc, "11")
        self.returned(doc, 1)
        self.post("expenses/", {"name": "Rent", "category": "Office", "amount": "2", "method": "Cash", "date": "2026-09-07"})
        result = self.client.get("/api/dashboard/").data
        self.assertEqual(Decimal(result["sales"]), Decimal("11"))
        self.assertEqual(Decimal(result["profit"]), Decimal("4"))
        self.assertEqual(Decimal(result["cash_balance"]), Decimal("9"))
        self.assertEqual(Decimal(result["receivables"]), 0)
        self.assertEqual(len(result["recent_sales"]), 1)
        for name in ["sales", "purchases", "inventory", "expenses", "customer-balances", "supplier-balances", "profit-loss"]:
            response = self.client.get(f"/api/reports/{name}/?date_from=2026-09-01&date_to=2026-09-30")
            self.assertEqual(response.status_code, 200, response.data)
        before = self.client.get("/api/accounting/?date_to=2026-09-06").data
        self.assertEqual(Decimal(before["cash_balance"]), 0)
        self.assertEqual(Decimal(before["sales"]), 0)
        self.assertEqual(self.client.get("/api/reports/sales/?date_from=2026-09-30&date_to=2026-09-01").status_code, 400)

    def test_reports_and_actions_are_workspace_isolated(self):
        doc = self.posted()
        self.client.force_login(self.other)
        self.assertEqual(self.client.get("/api/documents/").data["count"], 0)
        self.assertEqual(self.client.get("/api/stock-movements/").data["count"], 0)
        self.assertEqual(self.client.get("/api/dashboard/").data["recent_sales"], [])
        self.assertEqual(self.client.get("/api/reports/customer-balances/").data["count"], 1)
        self.post(f"documents/{doc['id']}/post/", {}, 404)
        self.payment(doc, "1", expected=404)

    def test_search_pagination_and_anonymous_rejection(self):
        self.post("suppliers/", {"name": "Needle"})
        self.assertEqual(self.client.get("/api/suppliers/?search=Needle").data["count"], 1)
        response = self.client.get("/api/suppliers/?limit=1&offset=1")
        self.assertEqual(response.data["count"], 2)
        self.assertEqual(len(response.data["results"]), 1)
        self.client.logout()
        for path in ["products", "suppliers", "documents", "returns", "stock-movements", "expenses", "transactions", "users", "settings", "accounting", "dashboard", "reports/sales"]:
            self.assertEqual(self.client.get(f"/api/{path}/").status_code, 403)

    def test_new_mutations_require_csrf(self):
        client = Client(enforce_csrf_checks=True)
        client.force_login(self.owner)
        self.assertEqual(client.post("/api/suppliers/", {"name": "No token"}, content_type="application/json").status_code, 403)

    def test_swagger_schema_includes_auth_and_business_contracts(self):
        self.client.logout()
        response = self.client.get("/api/schema/?format=json")
        self.assertEqual(response.status_code, 200)
        schema = response.json()
        for path in ["/api/auth/login/", "/api/auth/signup/", "/api/products/", "/api/documents/{id}/post/", "/api/documents/{id}/payments/", "/api/returns/", "/api/reports/{report}/"]:
            self.assertIn(path, schema["paths"])
        self.assertIn("requestBody", schema["paths"]["/api/documents/"]["post"])
        self.assertEqual(self.client.get("/api/docs/").status_code, 200)
        self.assertEqual(self.client.get("/api/redoc/").status_code, 200)

    def test_contact_balances_are_calculated_and_cannot_be_spoofed(self):
        doc = self.posted()
        self.payment(doc, "5")
        self.returned(doc, 1)
        response = self.client.patch(f"/api/customers/{self.customer.pk}/", {"total": "999", "balance": "999"}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(Decimal(response.data["total"]), 10)
        self.assertEqual(Decimal(response.data["balance"]), 5)
        self.assertEqual(Decimal(response.data["credit"]), 0)

    def test_document_event_dates_cannot_go_backwards(self):
        doc = self.posted()
        self.post(f"documents/{doc['id']}/payments/", {"amount": "5", "method": "Cash", "date": "2026-09-09"})
        self.returned(doc, 1, expected=400)
        self.payment(doc, "5", expected=400)
        self.assertEqual(models.Return.objects.count(), 0)

    def test_inactive_products_and_contacts_cannot_be_posted(self):
        self.stock()
        doc = self.draft()
        self.customer.status = "Inactive"
        self.customer.save()
        self.post(f"documents/{doc['id']}/post/", {}, 400)
        self.customer.status = "Active"
        self.customer.save()
        self.product.status = "Inactive"
        self.product.save()
        self.post(f"documents/{doc['id']}/post/", {}, 400)
        self.assertEqual(models.StockMovement.objects.count(), 1)

    def test_unique_sku_validation_and_history_immutability(self):
        self.post("products/", {"name": "Duplicate", "sku": self.product.sku, "category": "Office"}, 400)
        self.post("products/", {"name": "Invalid", "sku": "NEG", "category": "Office", "price": "-1"}, 400)
        movement = self.stock()
        self.assertEqual(self.client.delete(f"/api/stock-movements/{movement['id']}/").status_code, 405)
        doc = self.draft()
        doc = self.post(f"documents/{doc['id']}/post/", {}, 200)
        payment = self.payment(doc, "1")
        self.assertEqual(self.client.patch(f"/api/transactions/{payment['id']}/", {"amount": "999"}, format="json").status_code, 405)
