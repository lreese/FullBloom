"""Create the first admin user in the local database.

Usage:
    python -m app.seed_admin --email admin@oregonflowers.com --supabase-id <uuid>
"""
import argparse
import asyncio

from tortoise import Tortoise

from app.config import TORTOISE_ORM
from app.models.user import User


async def seed(email: str, supabase_id: str) -> None:
    await Tortoise.init(config=TORTOISE_ORM)
    existing = await User.filter(email=email).first()
    if existing:
        print(f"User {email} already exists (role={existing.role}, status={existing.status})")
        return
    user = await User.create(
        supabase_user_id=supabase_id,
        email=email,
        display_name="Admin",
        role="admin",
        status="active",
    )
    print(f"Created admin user: {user.email} (id={user.id})")
    await Tortoise.close_connections()


def main():
    parser = argparse.ArgumentParser(description="Seed the first admin user")
    parser.add_argument("--email", required=True, help="Admin email address")
    parser.add_argument("--supabase-id", required=True, help="Supabase Auth user UUID")
    args = parser.parse_args()
    asyncio.run(seed(args.email, args.supabase_id))


if __name__ == "__main__":
    main()
