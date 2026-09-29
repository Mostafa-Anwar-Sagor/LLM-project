from rest_framework import status, generics
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from core.drf_permissions import IsMemberOrAdmin, IsAdminRole
from .models import ChatLog, Conversation, ChatMessage
from .serializers import ChatMessageSerializer, ChatLogSerializer, ConversationSerializer, ChatMessageModelSerializer
from .rag import run_rag_query


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated, IsMemberOrAdmin])
def conversation_list_create_view(request):
    """
    GET /api/chat/conversations/ — list user's conversation threads
    POST /api/chat/conversations/ — create a new conversation thread
    """
    if request.method == "GET":
        conversations = Conversation.objects.filter(user=request.user).order_by("-updated_at")
        serializer = ConversationSerializer(conversations, many=True)
        return Response(serializer.data)

    elif request.method == "POST":
        title = request.data.get("title", "New Conversation")
        conv = Conversation.objects.create(user=request.user, title=title)
        serializer = ConversationSerializer(conv)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


@api_view(["GET", "DELETE"])
@permission_classes([IsAuthenticated, IsMemberOrAdmin])
def conversation_detail_view(request, pk):
    """
    GET /api/chat/conversations/<id>/ — retrieve messages for a conversation
    DELETE /api/chat/conversations/<id>/ — delete a conversation thread
    """
    conv = get_object_or_404(Conversation, pk=pk, user=request.user)

    if request.method == "GET":
        serializer = ConversationSerializer(conv)
        return Response(serializer.data)

    elif request.method == "DELETE":
        conv.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsMemberOrAdmin])
def chat_view(request):
    """
    POST /api/chat/
    Send a question; receive an AI-generated answer from permitted documents only.
    Saves multi-turn messages to the active conversation thread.
    """
    serializer = ChatMessageSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    question = serializer.validated_data["question"]
    conversation_id = request.data.get("conversation_id")

    conv = None
    if conversation_id:
        conv = Conversation.objects.filter(id=conversation_id, user=request.user).first()

    if not conv:
        conv_title = question[:35] + ("..." if len(question) > 35 else "")
        conv = Conversation.objects.create(user=request.user, title=conv_title)

    # Save user message
    ChatMessage.objects.create(
        conversation=conv,
        sender=ChatMessage.SENDER_USER,
        content=question
    )

    # Run RAG query
    result = run_rag_query(user=request.user, question=question)

    # Save assistant message
    asst_msg = ChatMessage.objects.create(
        conversation=conv,
        sender=ChatMessage.SENDER_ASSISTANT,
        content=result["answer"],
        source_documents=result["source_documents"],
        chunks_retrieved=result["chunks_retrieved"]
    )

    # Update conversation title if default
    if conv.title == "New Conversation" or conv.messages.count() <= 2:
        conv.title = question[:35] + ("..." if len(question) > 35 else "")
        conv.save(update_fields=["title", "updated_at"])

    result["conversation_id"] = conv.id
    result["message_id"] = asst_msg.id
    return Response(result, status=status.HTTP_200_OK)


class ChatHistoryView(generics.ListAPIView):
    """
    GET /api/chat/history/
    Returns the current user's chat history (paginated).
    """
    serializer_class = ChatLogSerializer
    permission_classes = [IsAuthenticated, IsMemberOrAdmin]

    def get_queryset(self):
        user = self.request.user
        is_admin = hasattr(user, "profile") and user.profile.is_admin

        if is_admin:
            user_id = self.request.query_params.get("user_id")
            if user_id:
                return ChatLog.objects.filter(user_id=user_id).select_related("user")
            return ChatLog.objects.all().select_related("user")

        return ChatLog.objects.filter(user=user)
