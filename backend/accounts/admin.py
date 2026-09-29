from django.contrib import admin
from django.contrib.auth.models import User
from .models import Group, UserProfile


@admin.register(Group)
class GroupAdmin(admin.ModelAdmin):
    list_display = ("name", "description", "created_at")
    search_fields = ("name",)


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "role", "group", "is_active", "created_at")
    list_filter = ("role", "group", "is_active")
    search_fields = ("user__username", "user__email")
