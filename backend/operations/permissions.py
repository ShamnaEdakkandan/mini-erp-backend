from rest_framework.permissions import BasePermission, SAFE_METHODS

from .models import Membership


def workspace(user):
    """Existing sign-ups own their workspace; invited users use their membership."""
    membership = Membership.objects.filter(user=user).select_related("owner").first()
    return (membership.owner, membership.role) if membership else (user, "Admin")


class WorkspacePermission(BasePermission):
    message = "Your role does not permit this action."

    def has_permission(self, request, view):
        if not request.user.is_authenticated or not request.user.is_active:
            return False
        owner, role = workspace(request.user)
        if not owner.is_active:
            return False
        if getattr(view, "admin_only", False):
            return role == "Admin"
        if role == "Staff":
            return request.method in SAFE_METHODS or request.method in ["POST", "PUT", "PATCH"]
        return request.method in SAFE_METHODS or role in ["Admin", "Manager"]
