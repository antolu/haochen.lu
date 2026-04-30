# Subapps cleanup + explicit Postgres config

## Background

The subapps feature was originally designed to register apps, generate OIDC
credentials, and eventually deploy containers via YAML import. Keycloak and
TrueNAS/Terraform now own all of that. What remains useful is the app registry:
name, URL, icon, access flags, ordering — the nav launcher.

Separately, `DATABASE_URL` is a single opaque env var. To run prod and staging
on the same Postgres host (same physical server, different roles/databases), each
deployment needs independently configurable user, password, and database name.

## Part 1: Subapps cleanup

### Remove entirely

**Backend:**
- `client_id`, `client_secret` columns from `subapps` table — new migration (017)
- `regenerate_application_credentials` in `crud/application.py`
- `get_application_by_client_id` in `crud/application.py`
- Auto-generation of `client_id`/`client_secret` in `create_application` and `update_application`
- `app_integration.py` router
- `app_config.py` schema file
- Route mount for `app-integration` in `main.py`
- `/regenerate-credentials` endpoint in `applications.py`
- Export endpoint entirely (`/export`) — it exported OIDC credentials and is unused

**Frontend:**
- `AdminAppImport` page (`pages/admin/AdminAppImport.tsx`)
- `YamlEditor` component (`components/YamlEditor.tsx`)
- Route for `/admin/applications/import` in `App.tsx`
- "Import via YAML" button in `AdminApplications.tsx`
- `useRegenerateCredentials` hook in `hooks/useApplications.ts`
- `onRegenerateCredentials` prop from `AppForm` and its call site
- OIDC section block in `AppForm.tsx` (client ID/secret display + regenerate button)
- `client_id`, `client_secret` from `Application` TypeScript type in `types/index.ts`

**Repo root:**
- `subapps/` directory

### Keep with cleanup

- `redirect_uris` — stays as a plain text field on the model, schema, and form.
  No generation, no OIDC semantics. Just a reference field.
- `requires_auth` — stays, controls visibility gating in the nav.
- All other registry fields (name, slug, url, admin_url, icon, color, access
  flags, order, enabled) unchanged.

### Schema changes

`ApplicationBase` and `ApplicationUpdate`: remove `client_id`, `client_secret`.
`ApplicationResponse`: remove `client_id`, `client_secret`.
`ApplicationPublicResponse`: already omits them — no change.

### Migration 017

```sql
ALTER TABLE subapps DROP COLUMN client_id;
ALTER TABLE subapps DROP COLUMN client_secret;
```

## Part 2: Explicit Postgres env vars

### Problem

`DATABASE_URL=postgresql+asyncpg://postgres:password@db:5432/portfolio` is a
single env var. To run prod and staging on the same host, Terraform needs to set
user, password, and database independently. A single URL string makes that
awkward.

### Solution

Replace `DATABASE_URL` with five explicit vars. The backend assembles the
connection URL internally.

**New env vars:**

| Var               | Default     | Required |
|-------------------|-------------|----------|
| `POSTGRES_USER`   | `postgres`  | no       |
| `POSTGRES_PASSWORD` | —         | yes      |
| `POSTGRES_HOST`   | `localhost` | no       |
| `POSTGRES_PORT`   | `5432`      | no       |
| `POSTGRES_DB`     | `portfolio` | no       |

### `backend/app/config.py`

Remove `database_url` as a `str` field. Add the five fields. Add a computed
`@property database_url` that assembles:

```
postgresql+asyncpg://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}
```

Remove `normalize_async_database_url` — no longer needed since we always
construct the URL ourselves with the correct driver prefix.

### `docker-compose.dev.yml`

Replace in the backend service environment:
```yaml
- DATABASE_URL=postgresql+asyncpg://postgres:${POSTGRES_PASSWORD:-password}@db:5432/${POSTGRES_DB:-portfolio}
```
with:
```yaml
- POSTGRES_USER=postgres
- POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-password}
- POSTGRES_HOST=db
- POSTGRES_PORT=5432
- POSTGRES_DB=${POSTGRES_DB:-portfolio}
```

### `.env.example`

Remove `DATABASE_URL`. Add the five vars with their dev defaults documented.

### `CLAUDE.md`

Update the env var table in the Development Setup section to replace
`DATABASE_URL` with the five individual vars.

### `backend/alembic/env.py`

Currently reads `DATABASE_URL` from the environment directly. Update to import
`settings` from `app.config` and use `settings.database_url` instead, removing
the `normalize_async_database_url` call (no longer needed).

## Out of scope
- Any Terraform changes — user must update `../arcadia-terraform` separately
  to replace the `DATABASE_URL` env var with the five individual vars in the
  TrueNAS app config.
