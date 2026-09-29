from django.urls import path
from accounts.views.group_views import GroupListCreateView, GroupDetailView, GroupDocumentAccessView

urlpatterns = [
    path("", GroupListCreateView.as_view(), name="group-list-create"),
    path("<int:pk>/", GroupDetailView.as_view(), name="group-detail"),
    path("<int:pk>/documents/", GroupDocumentAccessView.as_view(), name="group-documents"),
]

