from rest_framework import serializers
from .models import ChatLog, Conversation, ChatMessage


class ChatMessageSerializer(serializers.Serializer):
    """Input serializer for sending a chat message."""
    question = serializers.CharField(max_length=4000)


class ChatMessageModelSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatMessage
        fields = ["id", "sender", "content", "source_documents", "chunks_retrieved", "created_at"]
        read_only_fields = fields


class ConversationSerializer(serializers.ModelSerializer):
    messages = ChatMessageModelSerializer(many=True, read_only=True)
    message_count = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = ["id", "title", "created_at", "updated_at", "message_count", "messages"]
        read_only_fields = ["id", "created_at", "updated_at", "message_count"]

    def get_message_count(self, obj):
        return obj.messages.count()


class ChatLogSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)

    class Meta:
        model = ChatLog
        fields = [
            "id", "username", "question", "answer", "timestamp",
            "source_document_ids", "source_chunk_ids",
            "chunks_retrieved", "was_out_of_scope",
        ]
        read_only_fields = fields
