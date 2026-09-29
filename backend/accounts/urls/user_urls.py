from django.urls import path
from accounts.views.user_views import UserListCreateView, UserDetailView, activate_user_view, reset_user_password_view

urlpatterns = [
    path("", UserListCreateView.as_view(), name="user-list-create"),
    path("<int:pk>/", UserDetailView.as_view(), name="user-detail"),
    path("<int:pk>/activate/", activate_user_view, name="user-activate"),
    path("<int:pk>/reset-password/", reset_user_password_view, name="user-reset-password"),
]

