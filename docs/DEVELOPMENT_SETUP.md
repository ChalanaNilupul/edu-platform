# EduPlatform — Development Setup Guide

This guide explains how to set up and run EduPlatform on a new Windows PC.

## 1. Prerequisites

Install the following software:

- Git
- Node.js 26
- pnpm 12.18.0
- Docker Desktop
- Visual Studio Code (recommended)

Make sure Docker Desktop is running before starting the database.

## 2. Clone the Repository

Open PowerShell and run:

```powershell
git clone https://github.com/ChalanaNilupul/edu-platform.git
cd edu-platform
git switch feat/phase-2-identity
```

## 3. Install Dependencies

From the project root:

```powershell
pnpm install --frozen-lockfile
```

## 4. Configure Environment Variables

Create these files using the provided examples:

- `infra/docker/.env` from `infra/docker/.env.example`
- `apps/api/.env` from `apps/api/.env.example`

Configure the PostgreSQL username, password, and database name.

The `DATABASE_URL` in `apps/api/.env` must match the PostgreSQL credentials in `infra/docker/.env`.

Example connection string:

```env
DATABASE_URL="postgresql://edu_admin:your_password@localhost:5432/edu_platform?schema=public"
```

If your password contains special characters, URL-encode them in `DATABASE_URL`.

The API environment also controls mail and cross-origin behavior:

- `MAIL_DRIVER=console` logs verification and reset links to the API console in development. No SMTP credentials are required locally.
- `APP_WEB_URL` is used to build those links and should point at the frontend (`http://localhost:3000`).
- `CORS_ORIGIN` must match the frontend origin; unsafe requests are also checked against `Origin`/`Referer`.

Never commit real `.env` files to GitHub.

## 5. Start PostgreSQL

From the project root:

```powershell
docker compose --env-file infra/docker/.env -f infra/docker/compose.yaml up -d
```

Check the container:

```powershell
docker compose -f infra/docker/compose.yaml ps
```

## 6. Set Up Prisma

Navigate to the backend:

```powershell
cd apps/api
```

Apply existing migrations:

```powershell
pnpm exec prisma migrate deploy
```

Generate the Prisma Client:

```powershell
pnpm exec prisma generate
```

Return to the project root:

```powershell
cd ../..
```

## 7. Start EduPlatform

From the project root:

```powershell
pnpm dev
```

Development URLs:

- Frontend: http://localhost:3000
- Backend API: http://localhost:4000/api/v1
- API health: http://localhost:4000/api/v1/health
- Swagger: http://localhost:4000/api/docs

## 8. Run Code Quality Checks

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm --filter @edu-platform/api test:e2e
pnpm --filter @edu-platform/api test:integration
pnpm build
pnpm format:check
```

`pnpm test` runs unit tests. `test:e2e` runs the mocked HTTP end-to-end suite through supertest; it does not require a database but also does not prove database behavior. `test:integration` runs against a real PostgreSQL instance: it creates and migrates a dedicated `edu_platform_test` database, then executes auth, workspace, invitation and RLS tests. PostgreSQL must be running (step 5).

The RLS tests switch to a restricted `edu_rls_test` database role because the local `edu_admin` role is a superuser, and PostgreSQL bypasses RLS for superusers. This matches production expectations: a production deployment must use a non-superuser application role for RLS to be enforced.

GitHub Actions automatically runs these checks when code is pushed to the configured branches.

## 9. Working Across Multiple PCs

Before starting work:

```powershell
git switch feat/phase-2-identity
git pull
pnpm install
```

After making changes:

```powershell
git add .
git commit -m "describe your changes"
git push origin feat/phase-2-identity
```

Each PC maintains its own local PostgreSQL database and `.env` files. Git synchronizes source code and migration files, not local database records.

## 10. Stop the Database

From the project root:

```powershell
docker compose -f infra/docker/compose.yaml down
```

This stops the database container without deleting its named data volume.

**Important:** Do not use `down -v` unless you intentionally want to delete local database data.
