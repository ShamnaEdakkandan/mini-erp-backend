from django.urls import reverse
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Customer


class CustomerAPITests(APITestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username="tester", password="test-password-983")
        self.client.force_login(self.user)
        self.list_url = reverse("customer-list")

    def test_empty_list_is_a_json_array(self):
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json(), [])
        self.assertEqual(response["Content-Type"], "application/json")

    def test_create_retrieve_and_list(self):
        response = self.client.post(
            self.list_url,
            {"name": "  Sample Customer  ", "phone": "+001234", "email": "hello@example.com"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        customer = Customer.objects.get(pk=response.data["id"])
        self.assertEqual(customer.name, "Sample Customer")
        self.assertEqual(customer.phone, "+001234")
        self.assertEqual(customer.status, "Active")
        self.assertEqual(customer.address, "")
        detail = self.client.get(reverse("customer-detail", args=[customer.pk]))
        self.assertEqual(detail.status_code, status.HTTP_200_OK)
        self.assertEqual(detail.data, response.data)
        self.assertEqual(self.client.get(self.list_url).data, [response.data])
        self.assertEqual(set(response.data), {"id", "name", "phone", "email", "address", "status", "total", "balance", "credit"})

    def test_invalid_create_does_not_save(self):
        examples = [
            ({}, "name"),
            ({"name": "   "}, "name"),
            ({"name": "x" * 201}, "name"),
            ({"name": "Example", "email": "bad-email"}, "email"),
            ({"name": "Example", "phone": "1" * 31}, "phone"),
            ({"name": "Example", "status": "Unknown"}, "status"),
            ({"name": "Example", "email": None}, "email"),
        ]
        for payload, field in examples:
            with self.subTest(payload=payload):
                response = self.client.post(self.list_url, payload, format="json")
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertIn(field, response.data)
        self.assertEqual(Customer.objects.count(), 0)

    def test_partial_update_preserves_omitted_fields_and_read_only_id(self):
        customer = Customer.objects.create(owner=self.user, name="Original", email="old@example.com")
        url = reverse("customer-detail", args=[customer.pk])
        response = self.client.patch(url, {"status": "Inactive", "id": 99999}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        customer.refresh_from_db()
        self.assertEqual(customer.status, "Inactive")
        self.assertEqual(customer.name, "Original")
        self.assertEqual(customer.email, "old@example.com")
        self.assertEqual(response.data["id"], customer.pk)
        self.assertFalse(Customer.objects.filter(pk=99999).exists())

    def test_invalid_update_does_not_partially_write(self):
        customer = Customer.objects.create(owner=self.user, name="Original", email="old@example.com")
        response = self.client.patch(
            reverse("customer-detail", args=[customer.pk]),
            {"name": "Changed", "email": "invalid"}, format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        customer.refresh_from_db()
        self.assertEqual(customer.name, "Original")
        self.assertEqual(customer.email, "old@example.com")

    def test_put_requires_name_and_updates_supplied_fields(self):
        customer = Customer.objects.create(owner=self.user, name="Original")
        url = reverse("customer-detail", args=[customer.pk])
        self.assertEqual(self.client.put(url, {"status": "Inactive"}, format="json").status_code, 400)
        response = self.client.put(url, {"name": "Replacement", "status": "Inactive"}, format="json")
        self.assertEqual(response.status_code, 200)
        customer.refresh_from_db()
        self.assertEqual(customer.name, "Replacement")
        self.assertEqual(customer.status, "Inactive")

    def test_delete_removes_only_requested_customer(self):
        customer = Customer.objects.create(owner=self.user, name="Remove")
        other = Customer.objects.create(owner=self.user, name="Keep")
        response = self.client.delete(reverse("customer-detail", args=[customer.pk]))
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(response.content, b"")
        self.assertFalse(Customer.objects.filter(pk=customer.pk).exists())
        self.assertTrue(Customer.objects.filter(pk=other.pk).exists())

    def test_missing_record_returns_404(self):
        url = reverse("customer-detail", args=[99999])
        for method in ["get", "patch", "put", "delete"]:
            with self.subTest(method=method):
                response = getattr(self.client, method)(url)
                self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_malformed_json_and_unsupported_content_type(self):
        response = self.client.post(self.list_url, '{"name":', content_type="application/json")
        self.assertEqual(response.status_code, 400)
        response = self.client.post(self.list_url, "name=Sample", content_type="application/x-www-form-urlencoded")
        self.assertEqual(response.status_code, 415)
        self.assertEqual(Customer.objects.count(), 0)
