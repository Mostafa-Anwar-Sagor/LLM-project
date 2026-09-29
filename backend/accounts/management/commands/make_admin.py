from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from accounts.models import UserProfile


class Command(BaseCommand):
    help = "Promote an existing user to admin role (sets UserProfile.role='admin')"

    def add_arguments(self, parser):
        parser.add_argument("username", type=str)

    def handle(self, *args, **options):
        username = options["username"]
        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            self.stderr.write(self.style.ERROR(f"User '{username}' not found."))
            return

        profile, _ = UserProfile.objects.get_or_create(user=user)
        profile.role = "admin"
        profile.save()

        self.stdout.write(self.style.SUCCESS(
            f"✓ User '{username}' is now an admin."
        ))
