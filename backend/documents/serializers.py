from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Document, DocumentGroupAccess, DocumentChunk
from accounts.models import Group


class DocumentGroupAccessSerializer(serializers.ModelSerializer):
    group_name = serializers.CharField(source="group.name", read_only=True)
    group_description = serializers.CharField(source="group.description", read_only=True)

    class Meta:
        model = DocumentGroupAccess
        fields = ["id", "group", "group_name", "group_description", "access_level", "granted_at"]
        read_only_fields = ["id", "granted_at"]


class DocumentChunkSerializer(serializers.ModelSerializer):
    class Meta:
        model = DocumentChunk
        fields = ["id", "chunk_index", "content"]
        read_only_fields = fields


class DocumentSerializer(serializers.ModelSerializer):
    group_accesses = DocumentGroupAccessSerializer(many=True, read_only=True)
    chunks = DocumentChunkSerializer(many=True, read_only=True)
    group_ids = serializers.PrimaryKeyRelatedField(
        queryset=Group.objects.all(),
        many=True,
        write_only=True,
        required=False,
    )
    uploaded_by_name = serializers.SerializerMethodField()
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = Document
        fields = [
            "id", "title", "description", "file", "file_url", "file_type",
            "uploaded_by", "uploaded_by_name", "uploaded_at", "updated_at",
            "status", "error_message", "chunk_count",
            "group_accesses", "group_ids", "chunks",
        ]
        read_only_fields = [
            "id", "file_type", "uploaded_by", "uploaded_at", "updated_at",
            "status", "error_message", "chunk_count", "group_accesses", "chunks",
        ]

    def get_uploaded_by_name(self, obj):
        if obj.uploaded_by:
            return obj.uploaded_by.get_full_name() or obj.uploaded_by.username
        return "Unknown"

    def get_file_url(self, obj):
        request = self.context.get("request")
        if obj.file and request:
            return request.build_absolute_uri(obj.file.url)
        return None

    def create(self, validated_data):
        group_ids = validated_data.pop("group_ids", [])
        document = Document.objects.create(**validated_data)

        for group in group_ids:
            DocumentGroupAccess.objects.create(
                document=document,
                group=group,
                access_level=DocumentGroupAccess.ACCESS_FULL,
            )

        return document


class DocumentUpdateSerializer(serializers.ModelSerializer):
    """
    Used for PATCH /api/documents/<id>/
    Accepts group_accesses as a list of {group_id, access_level} dicts
    allowing admin to set Full or Limited access per group.
    """
    group_accesses_input = serializers.ListField(
        child=serializers.DictField(),
        write_only=True,
        required=False,
        source="group_access_input",
    )

    class Meta:
        model = Document
        fields = ["title", "description", "group_accesses_input"]

    def update(self, instance, validated_data):
        accesses_input = validated_data.pop("group_access_input", None)
        instance.title = validated_data.get("title", instance.title)
        instance.description = validated_data.get("description", instance.description)
        instance.save()

        if accesses_input is not None:
            # Full replace: delete old, create new with explicit access levels
            instance.group_accesses.all().delete()
            for entry in accesses_input:
                group_id = entry.get("group_id")
                access_level = entry.get("access_level", DocumentGroupAccess.ACCESS_FULL)
                if group_id:
                    try:
                        from accounts.models import Group as AccountGroup
                        group = AccountGroup.objects.get(id=group_id)
                        DocumentGroupAccess.objects.create(
                            document=instance,
                            group=group,
                            access_level=access_level,
                        )
                    except AccountGroup.DoesNotExist:
                        pass

        return instance
