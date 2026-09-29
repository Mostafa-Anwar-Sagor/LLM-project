from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth.models import User
from accounts.serializers import UserMeSerializer
import rest_framework_simplejwt.tokens as jwt_tokens


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Add user info to the JWT login response."""
    def validate(self, attrs):
        data = super().validate(attrs)
        user = self.user
        data["user"] = UserMeSerializer(user).data
        return data


class LoginView(TokenObtainPairView):
    permission_classes = [AllowAny]
    serializer_class = CustomTokenObtainPairSerializer


class TokenRefreshView(TokenRefreshView):
    permission_classes = [AllowAny]


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me_view(request):
    """Return current user info."""
    serializer = UserMeSerializer(request.user)
    return Response(serializer.data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def logout_view(request):
    """Blacklist refresh token (client should also clear access token)."""
    try:
        refresh_token = request.data.get("refresh")
        if refresh_token:
            token = jwt_tokens.RefreshToken(refresh_token)
            token.blacklist()
    except Exception:
        pass  # Already invalid or not using blacklisting
    return Response({"detail": "Successfully logged out."}, status=status.HTTP_200_OK)
