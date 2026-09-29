from django.contrib import admin
from .models import ChatLog


@admin.register(ChatLog)
class ChatLogAdmin(admin.ModelAdmin):
    list_display = ("user", "timestamp", "was_out_of_scope", "chunks_retrieved")
    list_filter = ("was_out_of_scope",)
    search_fields = ("user__username", "question")
    readonly_fields = ("timestamp",)
