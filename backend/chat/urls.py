from django.urls import path
from .views import (
    chat_view, ChatHistoryView,
    conversation_list_create_view, conversation_detail_view
)

urlpatterns = [
    path("", chat_view, name="chat"),
    path("history/", ChatHistoryView.as_view(), name="chat-history"),
    path("conversations/", conversation_list_create_view, name="conversations-list"),
    path("conversations/<int:pk>/", conversation_detail_view, name="conversations-detail"),
]
