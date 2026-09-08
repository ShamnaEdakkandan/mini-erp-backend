from django.db import IntegrityError, OperationalError
from django.db.models.deletion import ProtectedError
from rest_framework.response import Response
from rest_framework.views import exception_handler


def api_exception_handler(exc, context):
    if isinstance(exc, ProtectedError):
        return Response({"detail": "This record is referenced by business history. Mark it inactive instead."}, status=409)
    if isinstance(exc, IntegrityError):
        return Response({"detail": "A unique value already exists or a related record changed. Reload and check your request."}, status=409)
    if isinstance(exc, OperationalError) and "locked" in str(exc).lower():
        return Response({"detail": "The database is busy. Reload to check the result before retrying."}, status=503)
    return exception_handler(exc, context)
