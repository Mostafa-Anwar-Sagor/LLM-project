from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.contrib.auth.models import User
from django.shortcuts import get_object_or_404
from django.db.models import Q
from core.drf_permissions import IsAdminRole
from accounts.serializers import UserSerializer


class UserListCreateView(generics.ListCreateAPIView):
    """List all users or create a new user (admin only). Supports search and status filtering."""
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get_queryset(self):
        qs = User.objects.select_related("profile__group").order_by("-date_joined")

        # Search query
        search = self.request.query_params.get("search", "").strip()
        if search:
            qs = qs.filter(
                Q(username__icontains=search) |
                Q(email__icontains=search) |
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search)
            )

        # Filter by status: 'active', 'inactive', 'all'
        status_filter = self.request.query_params.get("status")
        if status_filter == "active":
            qs = qs.filter(is_active=True)
        elif status_filter == "inactive":
            qs = qs.filter(is_active=False)

        # Filter by group_id
        group_id = self.request.query_params.get("group_id")
        if group_id:
            qs = qs.filter(profile__group_id=group_id)

        # Filter by role
        role = self.request.query_params.get("role")
        if role:
            qs = qs.filter(profile__role=role)

        return qs


class UserDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve, update, or deactivate a user (admin only)."""
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated, IsAdminRole]
    queryset = User.objects.select_related("profile__group").all()

    def destroy(self, request, *args, **kwargs):
        user = self.get_object()

        # Prevent deactivating yourself while logged in
        if user.id == request.user.id:
            return Response(
                {"detail": "You cannot deactivate your own administrative account."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Soft-delete: deactivate user and profile
        user.is_active = False
        user.save()
        if hasattr(user, "profile"):
            user.profile.is_active = False
            user.profile.save()
        return Response({"detail": f"User '{user.username}' has been deactivated."}, status=status.HTTP_200_OK)


@api_view(["PATCH"])
@permission_classes([IsAuthenticated, IsAdminRole])
def activate_user_view(request, pk):
    """Re-activate a previously deactivated user."""
    user = get_object_or_404(User, pk=pk)
    user.is_active = True
    user.save()
    if hasattr(user, "profile"):
        user.profile.is_active = True
        user.profile.save()
    return Response({"detail": f"User '{user.username}' has been re-activated."})


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsAdminRole])
def reset_user_password_view(request, pk):
    """Reset a user's password directly (admin only)."""
    user = get_object_or_404(User, pk=pk)
    new_password = request.data.get("password")

    if not new_password or len(new_password) < 6:
        return Response(
            {"detail": "Password must be at least 6 characters long."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user.set_password(new_password)
    user.save()
    return Response({"detail": f"Password for '{user.username}' successfully reset."})

