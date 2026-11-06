DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM "User" LIMIT 1) THEN
        RAISE EXCEPTION
            'Migration blocked: User.passwordHash is required, and existing User rows need an approved credential reset/backfill plan. No dummy password hashes are generated.';
    END IF;
END
$$;

ALTER TABLE "User"
    ADD COLUMN "passwordHash" TEXT NOT NULL;
