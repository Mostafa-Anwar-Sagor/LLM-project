from django.db import models
from django.contrib.auth.models import User


class Conversation(models.Model):
    """
    Groups chat messages into multi-turn conversation threads (ChatGPT / Gemini style).
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="conversations")
    title = models.CharField(max_length=255, default="New Conversation")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self):
        return f"{self.user.username} - {self.title}"


class ChatMessage(models.Model):
    """
    Individual message in a conversation thread.
    """
    SENDER_USER = "user"
    SENDER_ASSISTANT = "assistant"
    SENDER_CHOICES = [
        (SENDER_USER, "User"),
        (SENDER_ASSISTANT, "Assistant"),
    ]

    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name="messages")
    sender = models.CharField(max_length=20, choices=SENDER_CHOICES)
    content = models.TextField()
    source_documents = models.JSONField(default=list, blank=True)
    chunks_retrieved = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]


class ChatLog(models.Model):
    """
    Logs every chat interaction for auditability.
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="chat_logs")
    question = models.TextField()
    answer = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)
    source_document_ids = models.JSONField(default=list, blank=True)
    source_chunk_ids = models.JSONField(default=list, blank=True)
    chunks_retrieved = models.IntegerField(default=0)
    was_out_of_scope = models.BooleanField(default=False)

    class Meta:
        ordering = ["-timestamp"]

    def __str__(self):
        return f"[{self.timestamp:%Y-%m-%d %H:%M}] {self.user.username}: {self.question[:60]}"
