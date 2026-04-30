# arcadia-auth: OIDC client package + haochen.lu refactor

## Goal

Extract the hand-rolled OIDC logic from `haochen.lu` into a reusable `arcadia-auth` package so any future app on the Arcadia server can authenticate against Keycloak without reimplementing discovery, JWKS validation, and the OAuth2 flows.

## Package structure (`../arcadia-auth`)

```
arcadia_auth/
    __init__.py       # re-exports public API
    config.py         # OidcSettings (pydantic-settings BaseSettings)
    validator.py      # OidcValidator — JWKS cache + token validation
    client.py         # OidcClient — discovery, token exchange, refresh, revoke
    exceptions.py     # OidcError hierarchy
```

### `OidcSettings`

Standalone `pydantic-settings` `BaseSettings` subclass. Reads OIDC-specific env vars directly — consumer apps instantiate it independently, no inheritance required.

Fields:
- `oidc_endpoint` — internal container URL (e.g. `http://keycloak:8080`)
- `oidc_public_endpoint` — browser-facing URL, also used for `iss` claim validation
- `oidc_realm`
- `oidc_client_id`
- `oidc_client_secret`
- `oidc_redirect_uri`
- `oidc_jwks_cache_ttl: int = 3600`
- `oidc_init_retries: int = 5`
- `oidc_init_backoff: float = 2.0`

Properties (derived, not env vars):
- `oidc_base_url` → `{oidc_endpoint}/realms/{oidc_realm}`
- `oidc_public_base_url` → `{oidc_public_endpoint}/realms/{oidc_realm}`
- `oidc_issuer_url` → `oidc_public_base_url` (Keycloak's `iss` claim uses the public URL)

### `exceptions.py`

```
OidcError               # base
├── DiscoveryError      # can't reach /.well-known/openid-configuration
├── JwksError           # can't fetch or parse JWKS
├── TokenExpiredError   # valid signature, expired
└── TokenInvalidError   # bad signature, wrong issuer, missing claims
```

### `OidcValidator`

- Takes `OidcSettings`.
- `async initialize()` — fetches discovery doc to find `jwks_uri`, then fetches JWKS. Retries with exponential backoff (`oidc_init_retries`, `oidc_init_backoff`). Raises `DiscoveryError` or `JwksError` if the retry window is exhausted.
- Rewrites `jwks_uri` hostname from public to internal before fetching (same as current behaviour).
- Caches the `authlib.jose.JsonWebKeySet` with `oidc_jwks_cache_ttl`. Re-fetches on expiry.
- `async validate_token(token: str) -> dict[str, Any]` — raises `TokenExpiredError` or `TokenInvalidError` on bad tokens, `JwksError` if keys are unavailable. Never returns `None`.

### `OidcClient`

- Takes `OidcSettings`.
- Uses `authlib.integrations.httpx_client.AsyncOAuth2Client`.
- `async initialize()` — fetches `/.well-known/openid-configuration` and caches endpoint URLs (`authorization_endpoint`, `token_endpoint`, `revocation_endpoint`, `userinfo_endpoint`). Retries with same backoff settings. Raises `DiscoveryError` on failure. Discovery is cached for process lifetime (no TTL — only changes on Keycloak redeploy).
- `authorization_url(redirect_uri, state, scope) -> str` — builds the authorization redirect URL.
- `async fetch_tokens(code, redirect_uri) -> dict` — authorization code exchange.
- `async refresh_token(refresh_token: str) -> dict` — token refresh.
- `async revoke_token(token: str) -> None` — best-effort revocation, does not raise on Keycloak errors.
- `async fetch_userinfo(access_token: str) -> dict` — fetches userinfo endpoint.

### Dependencies (`arcadia-auth` `pyproject.toml`)

Replace placeholder deps with:
- `authlib >= 1.3`
- `httpx >= 0.27`
- `pydantic-settings >= 2.0`
- `cryptography >= 40`  (authlib RS256 requires it)

## `haochen.lu` changes

### `config.py`

Remove all `oidc_*` fields and properties from `haochen.lu`'s `Settings`. Add at module level:

```python
from arcadia_auth import OidcSettings
oidc_settings = OidcSettings()
```

### `app/core/oidc.py`

Replaced entirely:

```python
from arcadia_auth import OidcClient, OidcValidator
from app.config import oidc_settings

oidc_validator = OidcValidator(oidc_settings)
oidc_client = OidcClient(oidc_settings)
```

### `app/main.py` — lifespan

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    await oidc_client.initialize()
    await oidc_validator.initialize()
    yield
```

Both retry with backoff so Docker Compose race conditions are handled. App fails fast with a clear error if Keycloak never becomes reachable.

### `app/api/auth.py`

- `login_redirect` — replace manual `urlencode` with `oidc_client.authorization_url(...)`
- `_fetch_oidc_tokens` — replace with `oidc_client.fetch_tokens(...)`; function removed
- `_fetch_oidc_profile` — replace with `oidc_client.fetch_userinfo(...)`; function removed
- `refresh_session` — replace inline `httpx` block with `oidc_client.refresh_token(...)`
- `logout` — replace inline `httpx` revoke block with `oidc_client.revoke_token(...)`
- Catch `OidcError` subclasses and translate to appropriate HTTP status codes

### `app/users.py` and `app/dependencies.py`

Replace `if payload is None` checks with `try/except TokenExpiredError, TokenInvalidError` and raise `HTTPException(401)`. `JwksError` maps to `HTTPException(503)`.

### `pyproject.toml`

- Remove `PyJWT`
- Add `arcadia-auth @ file://${PROJECT_ROOT}/../arcadia-auth` or install via `pip install -e ../arcadia-auth` in dev. In prod/CI, reference a published version tag once the package is released to the private registry.

## Testing

### `arcadia-auth` tests

Use `respx` to mock httpx at the transport level. A shared fixture generates an RSA keypair, builds a fake JWKS response and a fake discovery doc, and signs test tokens — no env var bypasses in source code.

Tests cover:
- `OidcValidator`: valid token, expired token, wrong issuer, tampered token, JWKS unavailable (raises `JwksError`), cache hit, cache expiry
- `OidcClient`: `authorization_url` shape, `fetch_tokens` happy path, `refresh_token`, `revoke_token` (best-effort, no raise)
- `initialize()` retry behaviour: succeeds on second attempt, raises after exhausting retries

### `haochen.lu` tests

- Remove `TESTING=true` + `test-token-*` bypass from source entirely
- `test_oidc_validator.py` — update to mock at method level (`oidc_validator.validate_token`) or use the `respx`-based fixture from `arcadia-auth`
- Integration test `conftest.py` — replace `test-token-*` fixture tokens with validly-signed tokens using the shared RSA fixture
- Auth flow tests mock `oidc_client` methods directly

## What does not change

- `app/core/security.py` — internal HS256 tokens are a separate concern, untouched
- `app/core/redis.py` — token blocklist logic untouched
- `app/crud/user.py`, `app/models/user.py` — user sync logic stays in `auth.py`
- All non-auth API routes
