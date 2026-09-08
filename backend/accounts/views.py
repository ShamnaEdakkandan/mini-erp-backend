import json
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from django.views.decorators.csrf import csrf_protect
from drf_spectacular.utils import extend_schema
from .schema import SignupRequest, LoginRequest, SessionResponse, AccountError
from operations.permissions import workspace

from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.forms import UserCreationForm
from django.http import JsonResponse
from django.db import IntegrityError, transaction
from django.middleware.csrf import get_token
from django.views.decorators.http import require_GET, require_POST
from django.views.decorators.cache import never_cache


def user_data(user):
    if not user.is_authenticated:
        return None
    owner, role = workspace(user)
    return {"id": user.pk, "username": user.username, "role": role, "workspace_id": owner.pk}


def body(request):
    if request.content_type != "application/json":
        return None
    try:
        data = request.data
        return data if isinstance(data, dict) and all(isinstance(v, str) for v in data.values()) else None
    except (ValueError, UnicodeDecodeError):
        return None


@never_cache
@extend_schema(responses=SessionResponse, auth=[], tags=["Authentication"])
@api_view(["GET"])
@permission_classes([AllowAny])
@require_GET
def session(request):
    return JsonResponse({"user": user_data(request.user), "csrfToken": get_token(request._request)})


@extend_schema(request=SignupRequest, responses={201: SessionResponse, 400: AccountError}, auth=[], tags=["Authentication"])
@api_view(["POST"])
@permission_classes([AllowAny])
@csrf_protect
@require_POST
def signup(request):
    data = body(request)
    if data is None:
        return JsonResponse({"detail": "Send a JSON object with text fields."}, status=400)
    form = UserCreationForm(data)
    if not form.is_valid():
        return JsonResponse({"errors": dict(form.errors)}, status=400)
    try:
        with transaction.atomic():
            user = form.save()
    except IntegrityError:
        return JsonResponse({"detail": "This username is already taken."}, status=400)
    login(request._request, user)
    return JsonResponse({"user": user_data(user), "csrfToken": get_token(request._request)}, status=201)


@extend_schema(request=LoginRequest, responses={200: SessionResponse, 400: AccountError}, auth=[], tags=["Authentication"])
@api_view(["POST"])
@permission_classes([AllowAny])
@csrf_protect
@require_POST
def signin(request):
    data = body(request)
    if data is None:
        return JsonResponse({"detail": "Send a JSON object with text fields."}, status=400)
    user = authenticate(request, username=data.get("username", ""), password=data.get("password", ""))
    if user is None:
        return JsonResponse({"detail": "Incorrect username or password."}, status=400)
    login(request._request, user)
    return JsonResponse({"user": user_data(user), "csrfToken": get_token(request._request)})


@extend_schema(request=None, responses={200: SessionResponse, 400: AccountError}, auth=[], tags=["Authentication"])
@api_view(["POST"])
@permission_classes([AllowAny])
@csrf_protect
@require_POST
def signout(request):
    logout(request._request)
    return JsonResponse({"user": None, "csrfToken": get_token(request._request)})
