from django.db import models
from django.contrib.auth.models import User


class Group(models.Model):
    """
    A configurable user group (e.g. "IoT", "Presales").
    Fully CRUD-able by admins — never hardcoded.
    Each group defines its default document access level:
      - 'full': Members can view, download, and query all allowed documents.
      - 'limited': Members can query knowledge via AI Chatbot RAG, but cannot download raw documents.
    """
    ACCESS_FULL = "full"
    ACCESS_LIMITED = "limited"
    ACCESS_CHOICES = [
        (ACCESS_FULL, "Full Access"),
        (ACCESS_LIMITED, "Limited Access"),
    ]

    name = models.CharField(max_length=150, unique=True)
    description = models.TextField(blank=True, default="")
    default_access_level = models.CharField(
        max_length=20,
        choices=ACCESS_CHOICES,
        default=ACCESS_FULL,
        help_text="Default access level for documents assigned to this group.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class UserProfile(models.Model):
    """
    Extends Django's built-in User with a group assignment and a role.
    Every user (except superuser) must belong to exactly one Group.
    """
    ROLE_ADMIN = "admin"
    ROLE_MEMBER = "member"
    ROLE_CHOICES = [
        (ROLE_ADMIN, "Admin"),
        (ROLE_MEMBER, "Member"),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    group = models.ForeignKey(
        Group,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="members",
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default=ROLE_MEMBER)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["user__username"]

    def __str__(self):
        return f"{self.user.username} ({self.role})"

    @property
    def is_admin(self):
        return self.role == self.ROLE_ADMIN
