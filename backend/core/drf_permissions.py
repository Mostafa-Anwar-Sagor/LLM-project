from rest_framework.permissions import BasePermission


class IsAdminRole(BasePermission):
    """
    DRF permission: only users with profile.role == 'admin' are allowed.
    """
    message = "Admin role required."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return (
            hasattr(request.user, "profile")
            and request.user.profile.is_admin
        )


class IsMemberOrAdmin(BasePermission):
    """
    DRF permission: any authenticated user with a UserProfile.
    """
    message = "Authentication with a valid profile required."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return hasattr(request.user, "profile")
