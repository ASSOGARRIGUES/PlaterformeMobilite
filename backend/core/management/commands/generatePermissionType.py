from django.contrib.auth import get_user_model
from django.core.management import BaseCommand


class Command(BaseCommand):
    help = 'Generate permission type in a typescript file'

    def add_arguments(self, parser):
        parser.add_argument('output', type=str, help='Output file')

    def handle(self, *args, **options):
        superuser = get_user_model().objects.filter(is_superuser=True).first()
        permissions = superuser.get_all_permissions()

        # Generate a type script Type definition file
        with open(options['output'], 'w') as f:
            f.write('export type PermissionType = true | ')
            f.write('|'.join([f"'{p}'" for p in permissions]))
            f.write(';\n')

