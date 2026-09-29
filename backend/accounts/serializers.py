from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Group, UserProfile


class GroupSerializer(serializers.ModelSerializer):
    member_count = serializers.SerializerMethodField()
    full_access_count = serializers.SerializerMethodField()
    limited_access_count = serializers.SerializerMethodField()
    total_document_count = serializers.SerializerMethodField()

    class Meta:
        model = Group
        fields = [
            "id", "name", "description", "default_access_level", "member_count",
            "full_access_count", "limited_access_count", "total_document_count",
            "created_at", "updated_at"
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


    def get_member_count(self, obj):
        return obj.members.count()

    def get_full_access_count(self, obj):
        from documents.models import Document
        if obj.default_access_level == "full":
            total_docs = Document.objects.count()
            explicit_limited = obj.document_accesses.filter(access_level="limited").count()
            return max(0, total_docs - explicit_limited)
        return obj.document_accesses.filter(access_level="full").count()

    def get_limited_access_count(self, obj):
        if obj.default_access_level == "limited":
            explicit_limited = obj.document_accesses.filter(access_level="limited").count()
            total_assigned = obj.document_accesses.count()
            return explicit_limited or total_assigned
        return obj.document_accesses.filter(access_level="limited").count()

    def get_total_document_count(self, obj):
        if obj.default_access_level == "full":
            from documents.models import Document
            return Document.objects.count()
        return obj.document_accesses.count()




class UserProfileSerializer(serializers.ModelSerializer):
    group = GroupSerializer(read_only=True)
    group_id = serializers.PrimaryKeyRelatedField(
        queryset=Group.objects.all(),
        source="group",
        write_only=True,
        required=False,
        allow_null=True,
    )

    class Meta:
        model = UserProfile
        fields = ["id", "role", "group", "group_id", "is_active", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]


class UserSerializer(serializers.ModelSerializer):
    profile = UserProfileSerializer(read_only=True)
    role = serializers.CharField(write_only=True, required=False, default="member")
    group_id = serializers.PrimaryKeyRelatedField(
        queryset=Group.objects.all(),
        write_only=True,
        required=False,
        allow_null=True,
    )
    password = serializers.CharField(write_only=True, required=False, allow_blank=True, min_length=6)

    class Meta:
        model = User
        fields = [
            "id", "username", "email", "first_name", "last_name",
            "password", "profile", "role", "group_id", "is_active",
            "date_joined",
        ]
        read_only_fields = ["id", "date_joined"]

    def create(self, validated_data):
        role = validated_data.pop("role", "member")
        group = validated_data.pop("group_id", None)
        password = validated_data.pop("password", None)

        if not password:
            raise serializers.ValidationError({"password": ["Password is required for new users."]})

        user = User(**validated_data)
        user.set_password(password)
        user.save()

        # Profile is created by signal, update it
        profile = user.profile
        profile.role = role
        profile.group = group
        profile.is_active = user.is_active
        profile.save()

        return user

    def update(self, instance, validated_data):
        role = validated_data.pop("role", None)
        group = validated_data.pop("group_id", None)
        password = validated_data.pop("password", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if password:
            instance.set_password(password)
        instance.save()

        if hasattr(instance, "profile"):
            if role is not None:
                instance.profile.role = role
            if group is not None:
                instance.profile.group = group
            instance.profile.is_active = instance.is_active
            instance.profile.save()

        return instance



class UserMeSerializer(serializers.ModelSerializer):
    """Lightweight serializer for /api/auth/me/"""
    group = serializers.SerializerMethodField()
    role = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "email", "first_name", "last_name", "group", "role"]

    def get_group(self, obj):
        if hasattr(obj, "profile") and obj.profile.group:
            return {"id": obj.profile.group.id, "name": obj.profile.group.name}
        return None

    def get_role(self, obj):
        if hasattr(obj, "profile"):
            return obj.profile.role
        return "member"
