# Subapps Cleanup + Explicit Postgres Config Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strip dead OIDC/credential machinery from the subapps feature and replace the single `DATABASE_URL` env var with five explicit Postgres vars.

**Architecture:** Two independent tracks — backend/frontend cleanup of credential fields, and config refactor. Migration 017 drops the DB columns. Config change replaces `database_url: str` with a computed `@property` assembled from five env vars. Alembic `env.py` is updated to use `settings.database_url`.

**Tech Stack:** FastAPI, SQLAlchemy 2.0/asyncpg, Alembic, Pydantic Settings, React 19, TypeScript, TanStack Query

---

## File Map

**Modified (backend):**
- `backend/app/config.py` — replace `database_url` field + `normalize_async_database_url` with five fields + `@property`
- `backend/alembic/env.py` — use `settings.database_url` instead of `os.getenv("DATABASE_URL")`
- `backend/app/models/application.py` — drop `client_id`, `client_secret` columns
- `backend/app/schemas/application.py` — drop `client_id`, `client_secret` from all schemas
- `backend/app/crud/application.py` — remove credential generation, `get_application_by_client_id`, `regenerate_application_credentials`
- `backend/app/api/applications.py` — remove `/regenerate-credentials` and `/export` endpoints
- `backend/app/api/__init__.py` or `backend/app/main.py` — remove `app_integration` router mount

**Deleted (backend):**
- `backend/app/api/app_integration.py`
- `backend/app/schemas/app_config.py`

**Modified (frontend):**
- `frontend/src/types/index.ts` — remove `client_id`, `client_secret` from `Application` type
- `frontend/src/api/client.ts` — remove `regenerateCredentials` method
- `frontend/src/hooks/useApplications.ts` — remove `useRegenerateCredentials`
- `frontend/src/components/AppForm.tsx` — remove OIDC section, `onRegenerateCredentials` prop
- `frontend/src/pages/admin/AdminApplications.tsx` — remove "Import via YAML" button, `useRegenerateCredentials` usage
- `frontend/src/App.tsx` — remove `AdminAppImport` lazy import and route

**Deleted (frontend):**
- `frontend/src/pages/admin/AdminAppImport.tsx`
- `frontend/src/components/YamlEditor.tsx`

**Deleted (repo root):**
- `subapps/` directory

**Modified (infra/docs):**
- `docker-compose.dev.yml` — replace `DATABASE_URL` with five individual vars in backend service
- `.env.example` — add `POSTGRES_HOST`, `POSTGRES_PORT`; remove `DATABASE_URL` if present
- `CLAUDE.md` — update env var table

**New migration:**
- `backend/alembic/versions/017_remove_application_credentials.py`

---

### Task 1: Postgres config refactor

**Files:**
- Modify: `backend/app/config.py`
- Modify: `backend/alembic/env.py`
- Modify: `docker-compose.dev.yml`
- Modify: `.env.example`

- [ ] **Step 1: Update `config.py`**

Replace the `database_url` field and `normalize_async_database_url` function with five explicit fields and a computed property. The full new top of the file:

```python
from __future__ import annotations

from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    postgres_user: str = "postgres"
    postgres_password: str = "password"
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_db: str = "portfolio"

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )
```

Remove the `import os` line (it's no longer needed at the top — check if any other field still uses `os.getenv` directly; if so keep it). Remove the `@field_validator("database_url")` and `_normalize_database_url` method entirely.

> Note: All other fields in `Settings` that still use `os.getenv(...)` as defaults are fine — `pydantic-settings` reads from env automatically, but the existing `os.getenv` calls also work. Leave those untouched; just remove the `database_url` field and its validator.

- [ ] **Step 2: Update `alembic/env.py`**

Replace the import and `DATABASE_URL` block:

```python
# Before (remove these lines):
from app.config import normalize_async_database_url
...
database_url = os.getenv("DATABASE_URL")
if database_url:
    config.set_main_option("sqlalchemy.url", normalize_async_database_url(database_url))
```

```python
# After:
from app.config import settings
...
config.set_main_option("sqlalchemy.url", settings.database_url)
```

Remove the `import os` line from `env.py` if it's only used for `os.getenv("DATABASE_URL")`.

- [ ] **Step 3: Update `docker-compose.dev.yml`**

In the backend service `environment` block, replace:
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

- [ ] **Step 4: Update `.env.example`**

Add after the existing `POSTGRES_PASSWORD` line:
```
POSTGRES_HOST=db
POSTGRES_PORT=5432
```
(`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` are already there.)

- [ ] **Step 5: Verify the backend starts**

```bash
docker compose -f docker-compose.dev.yml up -d backend db
docker compose -f docker-compose.dev.yml logs backend --tail=30
```

Expected: no `DATABASE_URL` errors, backend starts and connects to postgres.

- [ ] **Step 6: Commit**

```bash
git add backend/app/config.py backend/alembic/env.py docker-compose.dev.yml .env.example
git commit -m "refactor(config): replace DATABASE_URL with explicit postgres vars"
```

---

### Task 2: Migration — drop credential columns

**Files:**
- Create: `backend/alembic/versions/017_remove_application_credentials.py`

- [ ] **Step 1: Create migration file**

Create `backend/alembic/versions/017_remove_application_credentials.py`:

```python
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "017_remove_application_credentials"
down_revision = "016_add_logged_in_only"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_index("ix_subapps_client_id", table_name="subapps", if_exists=True)
    op.drop_column("subapps", "client_id")
    op.drop_column("subapps", "client_secret")


def downgrade() -> None:
    op.add_column(
        "subapps",
        sa.Column("client_id", sa.String(100), nullable=True, unique=True),
    )
    op.add_column(
        "subapps",
        sa.Column("client_secret", sa.String(100), nullable=True),
    )
```

> Check that `down_revision` matches the actual revision value in `016_add_logged_in_only.py`. Open that file and copy the `revision` variable value exactly.

- [ ] **Step 2: Run migration**

```bash
docker compose -f docker-compose.dev.yml exec backend alembic upgrade head
```

Expected output ends with: `Running upgrade ... -> 017_remove_application_credentials`

- [ ] **Step 3: Commit**

```bash
git add backend/alembic/versions/017_remove_application_credentials.py
git commit -m "feat(db): drop client_id and client_secret from subapps"
```

---

### Task 3: Backend model + schema cleanup

**Files:**
- Modify: `backend/app/models/application.py`
- Modify: `backend/app/schemas/application.py`

- [ ] **Step 1: Update model**

In `backend/app/models/application.py`, remove these two fields:

```python
client_id: Mapped[str | None] = mapped_column(
    String(100), unique=True, nullable=True
)
client_secret: Mapped[str | None] = mapped_column(String(100), nullable=True)
```

Keep `redirect_uris`.

- [ ] **Step 2: Update schemas**

In `backend/app/schemas/application.py`:

Remove from `ApplicationBase`:
```python
client_id: str | None = None
client_secret: str | None = None
```

Remove from `ApplicationUpdate`:
```python
client_id: str | None = None
client_secret: str | None = None
```

`ApplicationResponse` extends `ApplicationBase` so it inherits the removal. `ApplicationPublicResponse` already didn't have them — no change needed.

- [ ] **Step 3: Verify no import errors**

```bash
docker compose -f docker-compose.dev.yml exec backend python -c "from app.models.application import Application; from app.schemas.application import ApplicationResponse; print('ok')"
```

Expected: `ok`

- [ ] **Step 4: Commit**

```bash
git add backend/app/models/application.py backend/app/schemas/application.py
git commit -m "feat(subapps): remove client_id and client_secret from model and schemas"
```

---

### Task 4: Backend CRUD cleanup

**Files:**
- Modify: `backend/app/crud/application.py`

- [ ] **Step 1: Remove credential functions and auto-generation**

In `backend/app/crud/application.py`:

1. Remove the entire `get_application_by_client_id` function.

2. Remove the entire `regenerate_application_credentials` function.

3. In `create_application`, remove this block:
```python
if app_data.get("requires_auth"):
    if not app_data.get("client_id"):
        app_data["client_id"] = secrets.token_urlsafe(16)
    if not app_data.get("client_secret"):
        app_data["client_secret"] = secrets.token_urlsafe(32)
    if not app_data.get("redirect_uris"):
        app_data["redirect_uris"] = default_redirect_uri(str(app_data["url"]))
```

4. In `update_application`, remove this block:
```python
if update_data.get("requires_auth"):
    update_data.setdefault(
        "client_id", db_app.client_id or secrets.token_urlsafe(16)
    )
    update_data.setdefault(
        "client_secret",
        db_app.client_secret or secrets.token_urlsafe(32),
    )
    update_data.setdefault(
        "redirect_uris",
        db_app.redirect_uris
        or default_redirect_uri(str(update_data.get("url") or db_app.url)),
    )
```

5. Remove the `import secrets` line at the top (no longer used).

6. Remove the `default_redirect_uri` helper function (no longer used).

- [ ] **Step 2: Verify**

```bash
docker compose -f docker-compose.dev.yml exec backend python -c "from app.crud.application import create_application, update_application, get_applications; print('ok')"
```

Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add backend/app/crud/application.py
git commit -m "feat(subapps): remove credential generation from CRUD"
```

---

### Task 5: Backend API cleanup

**Files:**
- Modify: `backend/app/api/applications.py`
- Delete: `backend/app/api/app_integration.py`
- Delete: `backend/app/schemas/app_config.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Remove endpoints from `applications.py`**

In `backend/app/api/applications.py`:

Remove the entire `regenerate_credentials` endpoint (the `@router.post("/{application_id}/regenerate-credentials")` block).

Remove the entire `export_application` endpoint (the `@router.get("/{application_id}/export")` block).

Remove the `yaml` import at the top and the `Response` import from `fastapi.responses` if they're only used by those two endpoints.

- [ ] **Step 2: Remove `app_integration` from `main.py`**

In `backend/app/main.py`, remove:
```python
app_integration,
```
from the import block, and remove:
```python
api_router.include_router(
    app_integration.router, prefix="/app-integration", tags=["app-integration"]
)
```

- [ ] **Step 3: Delete dead files**

```bash
rm -f backend/app/api/app_integration.py
rm -f backend/app/schemas/app_config.py
```

- [ ] **Step 4: Verify backend starts cleanly**

```bash
docker compose -f docker-compose.dev.yml restart backend
docker compose -f docker-compose.dev.yml logs backend --tail=20
```

Expected: no import errors, routes load.

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/applications.py backend/app/main.py
git rm backend/app/api/app_integration.py backend/app/schemas/app_config.py
git commit -m "feat(subapps): remove OIDC endpoints, app_integration router, and app_config schema"
```

---

### Task 6: Frontend type + API client cleanup

**Files:**
- Modify: `frontend/src/types/index.ts`
- Modify: `frontend/src/api/client.ts`

- [ ] **Step 1: Update `types/index.ts`**

In the `Application` interface, remove:
```typescript
client_id?: string;
client_secret?: string;
```

Keep `redirect_uris?: string`.

There is also a second `client_id?: string` around line 172 — check if it belongs to a different interface (likely `LoginRequest`). If it's in `LoginRequest`, leave it alone. Only remove from `Application`.

- [ ] **Step 2: Update `api/client.ts`**

Remove the `regenerateCredentials` method from the `applications` object:
```typescript
regenerateCredentials: async (id: string): Promise<Application> => {
  const response = await apiClient.post<Application>(
    `/applications/${id}/regenerate-credentials`,
  );
  return response.data;
},
```

- [ ] **Step 3: Check TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors (or only pre-existing errors unrelated to this change).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/api/client.ts
git commit -m "feat(subapps): remove credential fields from Application type and API client"
```

---

### Task 7: Frontend hook + component cleanup

**Files:**
- Modify: `frontend/src/hooks/useApplications.ts`
- Modify: `frontend/src/components/AppForm.tsx`
- Modify: `frontend/src/pages/admin/AdminApplications.tsx`
- Delete: `frontend/src/pages/admin/AdminAppImport.tsx`
- Delete: `frontend/src/components/YamlEditor.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Remove `useRegenerateCredentials` from `useApplications.ts`**

Delete the entire `useRegenerateCredentials` export (lines 196–220).

- [ ] **Step 2: Clean up `AppForm.tsx`**

Remove the `onRegenerateCredentials` prop from the `AppFormProps` interface:
```typescript
onRegenerateCredentials?: () => void;
```

Remove it from the destructured props in the function signature:
```typescript
const AppForm: React.FC<AppFormProps> = ({
  application,
  onSubmit,
  onCancel,
  onRegenerateCredentials,   // remove this line
  isLoading = false,
}) => {
```

Remove the entire OIDC section block — the `{watchRequiresAuth && (` block starting at the `{/* OIDC Section */}` comment and ending at its closing `)}`. This removes the client ID/secret display and the regenerate button.

Keep the `redirect_uris` field — it's in the main form body, not the OIDC section. Verify after editing that `redirect_uris` textarea still exists in the form.

Remove the `useWatch` import for `requires_auth` and the `watchRequiresAuth` variable if they're only used by the OIDC section. Keep `useWatch` for `url` and `color`.

- [ ] **Step 3: Clean up `AdminApplications.tsx`**

Remove the import:
```typescript
useRegenerateCredentials,
```

Remove:
```typescript
const regenerateCredentialsMutation = useRegenerateCredentials();
```

Remove the `onRegenerateCredentials` prop passed to `<AppForm>`:
```typescript
onRegenerateCredentials={
  editingApplication
    ? () =>
        regenerateCredentialsMutation.mutate(
          editingApplication.id,
        )
    : undefined
}
```

Remove the "Import via YAML" button:
```tsx
<Button
  variant="outline"
  size="lg"
  className={cn("rounded-full px-6")}
  asChild
>
  <Link to="/admin/applications/import">
    <FileCode2 className="h-4 w-4 mr-2" />
    Import via YAML
  </Link>
</Button>
```

Remove the `FileCode2` import from `lucide-react` if it's no longer used. Remove the `Link` import from `react-router-dom` if it's no longer used.

- [ ] **Step 4: Update `App.tsx`**

Remove:
```typescript
const AdminAppImport = lazy(() => import("./pages/admin/AdminAppImport"));
```

Remove the route:
```tsx
path="applications/import"
element={
  <Suspense fallback={<div>Loading...</div>}>
    <AdminAppImport />
  </Suspense>
}
```
(The exact JSX may vary slightly — find the route with `path="applications/import"` and remove it.)

- [ ] **Step 5: Delete dead files**

```bash
rm -f frontend/src/pages/admin/AdminAppImport.tsx
rm -f frontend/src/components/YamlEditor.tsx
```

- [ ] **Step 6: Check TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/hooks/useApplications.ts \
        frontend/src/components/AppForm.tsx \
        frontend/src/pages/admin/AdminApplications.tsx \
        frontend/src/App.tsx
git rm frontend/src/pages/admin/AdminAppImport.tsx \
       frontend/src/components/YamlEditor.tsx
git commit -m "feat(subapps): remove YAML import UI, credential display, and regenerate flow"
```

---

### Task 8: Delete repo-root subapps directory + update CLAUDE.md

**Files:**
- Delete: `subapps/`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Delete `subapps/`**

```bash
rm -rf subapps/
```

- [ ] **Step 2: Update `CLAUDE.md` env var table**

In the Development Setup section, replace the `DATABASE_URL` entry with the five individual vars:

```markdown
- `POSTGRES_USER`: database role name (default: `postgres`)
- `POSTGRES_PASSWORD`: database role password (required)
- `POSTGRES_HOST`: database host (default: `localhost`; use `db` in Docker)
- `POSTGRES_PORT`: database port (default: `5432`)
- `POSTGRES_DB`: database name (default: `portfolio`)
```

- [ ] **Step 3: Commit**

```bash
git rm -r subapps/
git add CLAUDE.md
git commit -m "chore: remove subapps directory and update CLAUDE.md env vars"
```

---

### Task 9: Run full test suite

- [ ] **Step 1: Run backend unit tests**

```bash
docker compose -f docker-compose.dev.yml exec backend python -m pytest tests/unit/ -v
```

Expected: all pass (or only pre-existing failures).

- [ ] **Step 2: Run frontend tests**

```bash
cd frontend && npm run test
```

Expected: all pass. If `auth-store.test.ts` fails due to `client_id` references in test fixtures (lines 65, 74), update those fixtures to remove `client_id: "subapp-client"` from the mock Application objects.

- [ ] **Step 3: Smoke test the admin UI**

```bash
docker compose -f docker-compose.dev.yml up -d
```

Open http://localhost/admin/applications — verify:
- App list loads
- "Import via YAML" button is gone
- Creating/editing an app shows no OIDC section
- `redirect_uris` field is still present in the form
