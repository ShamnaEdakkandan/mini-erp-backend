from django.contrib.auth import get_user_model
from django.test import TestCase, Client
from .models import Customer


class AccountFlowTests(TestCase):
    def setUp(self):
        self.client = Client(enforce_csrf_checks=True)
        self.password = "River!Cedar-84726"

    def csrf(self, client=None):
        return (client or self.client).get("/api/auth/session/").json()["csrfToken"]

    def post(self, path, data, client=None):
        client = client or self.client
        return client.post(path, data, content_type="application/json", HTTP_X_CSRFTOKEN=self.csrf(client), HTTP_ORIGIN="http://localhost:3000")

    def signup(self, username="sample"):
        return self.post("/api/auth/signup/", {"username": username, "password1": self.password, "password2": self.password})

    def test_signup_session_password_hash_and_logout(self):
        response = self.signup()
        self.assertEqual(response.status_code, 201)
        user = get_user_model().objects.get(username="sample")
        self.assertTrue(user.check_password(self.password))
        self.assertNotEqual(user.password, self.password)
        self.assertFalse(user.is_staff)
        self.assertTrue(self.client.cookies["sessionid"]["httponly"])
        self.assertEqual(self.client.get("/api/auth/session/").json()["user"]["id"], user.pk)
        old_cookie = self.client.cookies["sessionid"].value
        self.assertEqual(self.post("/api/auth/logout/", {}).status_code, 200)
        self.assertIsNone(self.client.get("/api/auth/session/").json()["user"])
        replay = Client()
        replay.cookies["sessionid"] = old_cookie
        self.assertEqual(replay.get("/api/customers/").status_code, 403)
        self.assertEqual(self.post("/api/auth/login/", {"username": "sample", "password": self.password}).status_code, 200)

    def test_csrf_required_even_for_login_and_signup(self):
        for path in ["login", "signup", "logout"]:
            self.assertEqual(self.client.post(f"/api/auth/{path}/", {}, content_type="application/json").status_code, 403)
        response = self.client.post("/api/auth/login/", {}, content_type="application/json", HTTP_X_CSRFTOKEN=self.csrf(), HTTP_ORIGIN="https://untrusted.example")
        self.assertEqual(response.status_code, 403)

    def test_invalid_signup_and_login(self):
        self.assertEqual(self.post("/api/auth/signup/", {"username": "sample", "password1": "123", "password2": "123"}).status_code, 400)
        self.assertEqual(get_user_model().objects.count(), 0)
        self.assertEqual(self.signup().status_code, 201)
        self.assertEqual(self.signup().status_code, 400)
        self.assertEqual(self.post("/api/auth/login/", {"username": "sample", "password": "incorrect"}).status_code, 400)
        self.assertEqual(self.post("/api/auth/signup/", {"username": "other", "password1": self.password, "password2": "mismatch"}).status_code, 400)
        self.assertEqual(self.post("/api/auth/login/", {"username": []}).status_code, 400)

    def test_anonymous_and_cross_account_access_and_owner_spoofing(self):
        self.assertEqual(self.client.get("/api/customers/").status_code, 403)
        self.assertEqual(self.client.post("/api/customers/", {"name": "Blocked"}).status_code, 403)
        self.signup()
        user = get_user_model().objects.get(username="sample")
        other = get_user_model().objects.create_user(username="other", password=self.password)
        hidden = Customer.objects.create(owner=other, name="Private")
        legacy = Customer.objects.create(name="Legacy")
        response = self.post("/api/customers/", {"name": "Owned", "owner": other.pk})
        self.assertEqual(response.status_code, 201)
        owned = Customer.objects.get(pk=response.json()["id"])
        self.assertEqual(owned.owner, user)
        self.assertEqual(len(self.client.get("/api/customers/").json()), 1)
        for customer in [hidden, legacy]:
            for method in ["get", "patch", "put", "delete"]:
                response = getattr(self.client, method)(f"/api/customers/{customer.pk}/", data={} if method != "get" else None, content_type="application/json", HTTP_X_CSRFTOKEN=self.csrf())
                self.assertEqual(response.status_code, 404)
        self.assertEqual(self.client.patch(f"/api/customers/{owned.pk}/", {"name": "No token"}, content_type="application/json").status_code, 403)
        response = self.client.patch(f"/api/customers/{owned.pk}/", {"name": "Updated", "owner": other.pk}, content_type="application/json", HTTP_X_CSRFTOKEN=self.csrf())
        self.assertEqual(response.status_code, 200)
        owned.refresh_from_db()
        self.assertEqual(owned.owner, user)
        self.assertEqual(owned.name, "Updated")
        self.assertEqual(self.client.delete(f"/api/customers/{owned.pk}/", HTTP_X_CSRFTOKEN=self.csrf()).status_code, 204)
        self.assertTrue(Customer.objects.filter(pk=legacy.pk).exists())
