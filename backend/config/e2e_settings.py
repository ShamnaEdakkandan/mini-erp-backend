"""Isolated browser-test configuration. Never reads or writes db.sqlite3."""
from .settings import *

DATABASES = {"default": {
    "ENGINE": "django.db.backends.sqlite3",
    "NAME": BASE_DIR / ".e2e.sqlite3",
    "OPTIONS": {"timeout": 20, "transaction_mode": "IMMEDIATE"},
}}
CSRF_TRUSTED_ORIGINS = ["http://localhost:3100", "http://127.0.0.1:3100"]
