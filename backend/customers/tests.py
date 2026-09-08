from django.core.exceptions import ValidationError
from django.test import TestCase

from .models import Customer


class CustomerModelTests(TestCase):
    def test_contact_details_survive_a_database_round_trip(self):
        customer = Customer(
            name="Learning Customer",
            phone="+00123456789",
            email="learner@example.com",
            address="12 Example Street",
        )
        customer.full_clean()
        customer.save()

        stored = Customer.objects.get(pk=customer.pk)
        self.assertEqual(stored.name, "Learning Customer")
        self.assertEqual(stored.phone, "+00123456789")
        self.assertEqual(stored.email, "learner@example.com")
        self.assertEqual(stored.address, "12 Example Street")
        self.assertEqual(stored.status, "Active")
        self.assertEqual(str(stored), "Learning Customer")

    def test_only_name_is_required(self):
        customer = Customer(name="Walk-in Customer")
        customer.full_clean()
        customer.save()
        customer.refresh_from_db()
        self.assertEqual((customer.phone, customer.email, customer.address), ("", "", ""))

    def test_validation_rejects_invalid_field_values(self):
        examples = [
            ({"name": ""}, "name"),
            ({"name": "x" * 201}, "name"),
            ({"phone": "1" * 31}, "phone"),
            ({"email": "not-an-email"}, "email"),
            ({"status": "Unknown"}, "status"),
        ]
        for values, field in examples:
            with self.subTest(field=field, values=values):
                customer = Customer(**{"name": "Example", **values})
                with self.assertRaises(ValidationError) as error:
                    customer.full_clean()
                self.assertIn(field, error.exception.message_dict)
        self.assertEqual(Customer.objects.count(), 0)

    def test_customers_with_the_same_name_have_distinct_ids(self):
        first = Customer.objects.create(name="Same Name")
        second = Customer.objects.create(name="Same Name")
        self.assertNotEqual(first.pk, second.pk)

    def test_update_and_delete_target_only_one_customer(self):
        customer = Customer.objects.create(name="First")
        other = Customer.objects.create(name="Second")
        customer.status = "Inactive"
        customer.full_clean()
        customer.save()
        customer.refresh_from_db()
        self.assertEqual(customer.status, "Inactive")

        customer_id = customer.pk
        customer.delete()
        self.assertFalse(Customer.objects.filter(pk=customer_id).exists())
        self.assertTrue(Customer.objects.filter(pk=other.pk).exists())
