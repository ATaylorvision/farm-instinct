"""Create or reset the admin account.

Usage (inside the backend container):
    docker compose exec backend python -m app.seed.reset_admin

Defaults can be overridden with env vars:
    ADMIN_EMAIL    (default: taylor@vblt.com)
    ADMIN_PASSWORD (default: test1234)
    ADMIN_NAME     (default: Taylor)

If a user with that email already exists, the password is reset and the
is_admin flag is forced on. Otherwise a new admin user is created.
"""

import os
import sys

from sqlalchemy import select

from app.database import SessionLocal
from app.models import User
from app.security import hash_password


def main() -> int:
    email = os.environ.get("ADMIN_EMAIL", "taylor@vblt.com")
    password = os.environ.get("ADMIN_PASSWORD", "test1234")
    name = os.environ.get("ADMIN_NAME", "Taylor")

    with SessionLocal() as db:
        existing = db.scalar(select(User).where(User.email == email))
        if existing:
            existing.hashed_password = hash_password(password)
            existing.is_admin = True
            if not existing.full_name:
                existing.full_name = name
            action = "reset"
        else:
            db.add(
                User(
                    email=email,
                    hashed_password=hash_password(password),
                    full_name=name,
                    preferred_locale="en",
                    is_admin=True,
                )
            )
            action = "created"
        db.commit()

    print(f"Admin {action}: {email}  (password: {password})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
