from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from accounts.models import Group, UserProfile


class Command(BaseCommand):
    help = "Seed initial groups and test users for ALIIS"

    def handle(self, *args, **options):
        self.stdout.write("Seeding ALIIS demo data...")

        # Create Groups
        iot_group, _ = Group.objects.get_or_create(
            name="IoT",
            defaults={"description": "IoT hardware, firmware, and sensor engineering team"}
        )
        presales_group, _ = Group.objects.get_or_create(
            name="Presales",
            defaults={"description": "Presales engineering, proposals, and client solutions team"}
        )
        eng_group, _ = Group.objects.get_or_create(
            name="Engineering",
            defaults={"description": "Core software platforms and R&D engineering group"}
        )

        self.stdout.write(self.style.SUCCESS("[OK] Created Groups: IoT, Presales, Engineering"))

        # Create Admin User
        admin_user, created = User.objects.get_or_create(
            username="admin",
            defaults={
                "email": "admin@company.internal",
                "first_name": "System",
                "last_name": "Administrator",
                "is_staff": True,
                "is_superuser": True,
            }
        )
        if created:
            admin_user.set_password("admin123")
            admin_user.save()

        admin_profile = admin_user.profile
        admin_profile.role = UserProfile.ROLE_ADMIN
        admin_profile.save()
        self.stdout.write(self.style.SUCCESS("[OK] Created Admin user: admin / admin123"))

        # Create IoT Member User
        iot_user, created = User.objects.get_or_create(
            username="iot_user",
            defaults={
                "email": "iot@company.internal",
                "first_name": "IoT",
                "last_name": "Engineer",
            }
        )
        if created:
            iot_user.set_password("user123")
            iot_user.save()

        iot_profile = iot_user.profile
        iot_profile.group = iot_group
        iot_profile.role = UserProfile.ROLE_MEMBER
        iot_profile.save()
        self.stdout.write(self.style.SUCCESS("[OK] Created IoT user: iot_user / user123 (Group: IoT)"))

        # Create Presales Member User
        presales_user, created = User.objects.get_or_create(
            username="presales_user",
            defaults={
                "email": "presales@company.internal",
                "first_name": "Presales",
                "last_name": "Specialist",
            }
        )
        if created:
            presales_user.set_password("user123")
            presales_user.save()

        presales_profile = presales_user.profile
        presales_profile.group = presales_group
        presales_profile.role = UserProfile.ROLE_MEMBER
        presales_profile.save()
        self.stdout.write(self.style.SUCCESS("[OK] Created Presales user: presales_user / user123 (Group: Presales)"))

        self.stdout.write(self.style.SUCCESS("\nDemo data seeding complete!"))
