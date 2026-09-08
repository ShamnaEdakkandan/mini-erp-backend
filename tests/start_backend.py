import os
import sys
from pathlib import Path

backend = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend))
os.environ["DJANGO_SETTINGS_MODULE"] = "config.e2e_settings"
from django.core.management import execute_from_command_line
execute_from_command_line(["manage.py", "migrate", "--noinput"])
execute_from_command_line(["manage.py", "runserver", "127.0.0.1:8001", "--noreload"])
