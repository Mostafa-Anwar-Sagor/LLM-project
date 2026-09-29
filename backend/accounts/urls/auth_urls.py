from django.urls import path
from accounts.views.auth_views import LoginView, TokenRefreshView, me_view, logout_view

urlpatterns = [
    path("login/", LoginView.as_view(), name="auth-login"),
    path("refresh/", TokenRefreshView.as_view(), name="auth-refresh"),
    path("me/", me_view, name="auth-me"),
    path("logout/", logout_view, name="auth-logout"),
]
