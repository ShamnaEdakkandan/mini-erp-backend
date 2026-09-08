"""Public account request/response contracts used by Swagger."""
from rest_framework import serializers


class SignupRequest(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    password1 = serializers.CharField(write_only=True)
    password2 = serializers.CharField(write_only=True)


class LoginRequest(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)


class AccountUser(serializers.Serializer):
    id = serializers.IntegerField()
    username = serializers.CharField()
    role = serializers.ChoiceField(choices=["Admin", "Manager", "Staff"])
    workspace_id = serializers.IntegerField()


class SessionResponse(serializers.Serializer):
    user = AccountUser(allow_null=True)
    csrfToken = serializers.CharField()


class AccountError(serializers.Serializer):
    detail = serializers.CharField(required=False)
    errors = serializers.DictField(child=serializers.ListField(child=serializers.CharField()), required=False)
