import time
from os import environ

from django.contrib.auth import get_user_model
from django.db.utils import IntegrityError

user_model = get_user_model()

print(environ["DEFAULT_SUPER_USER"],
      environ["DEFAULT_SUPER_EMAIL"],
      environ["DEFAULT_SUPER_PASSWORD"],)
def create_super():
    try:
        user_model.objects.create_superuser(
            environ["DEFAULT_SUPER_USER"],
            environ["DEFAULT_SUPER_EMAIL"],
            environ["DEFAULT_SUPER_PASSWORD"],
        )
    except IntegrityError:
        pass
    except KeyError:
        exit(1)


print()
start_time = time.time()

print("- Creating Initial Superuser... ", end="")
create_super()
print("OK")

end = time.time()
print()
print(f"--- {end - start_time} seconds ---")
