# @13axis/database

Prisma/PostgreSQL foundation for the MVP entities. All IDs are caller supplied
UUID v7 values so a client can create an entity offline; use `createId()` from
`@13axis/shared`. Prisma intentionally has no `uuid()` default here because that
would generate a different UUID version in some Prisma/database versions.

## Local commands

Set `DATABASE_URL` to a PostgreSQL connection string before validation or
migration commands. `db:validate` and `db:generate` do not connect to a running
database; `db:migrate:deploy` applies checked-in migrations to the configured
database. `db:migrate:dev` is for development only.

The initial migration creates the core tables and enums; the next migration
adds the required `User.passwordHash`. The initial migration does not read,
rewrite, or delete existing application data. The password migration stops
with an explicit error if any `User` rows already exist; it never creates
dummy hashes. Before applying it to a populated database, plan an approved
credential reset/backfill that produces a valid Argon2id hash for every
existing user, then apply a reviewed migration tailored to that database.
Until that plan exists, this migration is intentionally blocked for databases
with users. The initial migration requires names it creates not to exist; the
password migration has no automatic down migration. For a disposable database
only, take a backup and explicitly remove affected tables/constraints/indexes
and enum types in dependency order. Do not tear down a database containing
data.

## Recreating a local database (destructive)

The commands below delete every local record, including restaurants, users,
tables, menu items, and orders. Use them only for a disposable development
database and stop running apps first.

Full reset, including the Docker volume:

```powershell
docker compose down -v
docker compose up -d --wait postgres
pnpm --filter @13axis/database db:migrate:deploy
pnpm --filter @13axis/database db:generate
pnpm --filter @13axis/database create-admin
```

Schema-only reset, keeping the PostgreSQL container and volume:

```powershell
docker compose up -d --wait postgres
docker compose exec -T postgres psql -U 13axis -d 13axis -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
pnpm --filter @13axis/database db:migrate:deploy
pnpm --filter @13axis/database create-admin
```

Prisma can also reset the schema and reapply migrations:

```powershell
docker compose up -d --wait postgres
pnpm --filter @13axis/database exec prisma migrate reset --force --skip-seed
pnpm --filter @13axis/database create-admin
```

After any reset, recreate the first restaurant/ADMIN with `create-admin`. The
demo seeds are separate and must be run explicitly when needed.

## First-install administrator bootstrap

Apply migrations, then from the repository workspace run:

```powershell
$env:DATABASE_URL = "postgresql://..."
pnpm --filter @13axis/database create-admin
```

The command interactively asks for the restaurant name, administrator email,
display name, and password. Password input requires a real terminal and is
read without echo; it is not accepted through command-line arguments or
environment variables. Argon2id generates a random salt and stores only the
encoded hash in `User.passwordHash`. The operation creates Restaurant and its
first ADMIN in one transaction, using UUID v7 IDs from `@13axis/shared`. A
transaction-scoped advisory lock serializes concurrent bootstrap attempts;
the command refuses if any Restaurant already exists in the database. It
prints generated IDs and the email, never the password, hash, database URL, or
raw database error.

`AUTH_SECRET` is not used by this bootstrap command: it creates no session or
token. Configure the application authentication secret separately before
starting the application; this CLI does not supply or print any default
credential or secret.

## Persisted sync fields

Every entity has `version` (starts at 1), `updatedAt` (`TIMESTAMPTZ(3)`),
nullable `lastSyncedAt`, nullable `deviceId`, and nullable `deletedAt`.
Prisma's `@updatedAt` updates timestamps on Prisma writes; version increments,
sync watermarks, and conflict decisions must be implemented transactionally by
the future sync service. This package does not implement sync endpoints.
`User.passwordHash` contains an encoded Argon2id hash only; never return it in
user API responses or sync payloads.

Money uses PostgreSQL `DECIMAL(12,2)` and quantity uses `DECIMAL(10,3)`; clients
should transport decimals as strings rather than JavaScript floating-point
numbers. Currency, maximum business values, table-number uniqueness, and
cross-tenant relation enforcement are not specified and are deliberately not
encoded as extra rules.

Multiple `OPEN` orders on one table are permitted in the MVP. There is no
unique constraint on `tableId` or conditional unique index for open orders.
Each order's client-generated `id` is its persistent identity and must also be
reused as the create-mutation idempotency identity on retries; a retry must not
mint a second order ID. The future sync endpoint must return the canonical
record for a duplicate ID. No numeric limit on orders per table is imposed.
