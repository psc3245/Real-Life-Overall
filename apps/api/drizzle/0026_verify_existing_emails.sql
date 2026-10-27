-- Email confirmation is now required to sign in. Accounts made before it are trusted as-is.
UPDATE "auth_users" SET "email_verified" = true WHERE "email_verified" = false;
