from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    # Django admin (debug only — real admin is the React custom panel)
    path("django-admin/", admin.site.urls),

    # API routes
    path("api/auth/", include("accounts.urls.auth_urls")),
    path("api/groups/", include("accounts.urls.group_urls")),
    path("api/users/", include("accounts.urls.user_urls")),
    path("api/documents/", include("documents.urls")),
    path("api/chat/", include("chat.urls")),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
