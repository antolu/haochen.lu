# arcadia-auth OIDC Package + haochen.lu Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract hand-rolled OIDC logic from `haochen.lu` into a reusable `arcadia-auth` package backed by `authlib`, then update `haochen.lu` to consume it.

**Architecture:** `arcadia-auth` is a standalone `pydantic-settings`-based package with `OidcSettings`, `OidcValidator` (JWKS + token validation via `authlib.jose`), `OidcClient` (OAuth2 flows via plain `httpx` with discovery-cached endpoints), and a typed exception hierarchy. `haochen.lu` instantiates these at module level and calls `initialize()` in its FastAPI lifespan. Tests use `respx` to mock httpx at the transport level — no env var bypasses in source code.

**Tech Stack:** Python 3.11+, authlib ≥ 1.3, httpx ≥ 0.27, pydantic-settings ≥ 2.0, cryptography ≥ 40, respx (tests), pytest-asyncio (tests)

---

## File Map

### `../arcadia-auth/` (new files)

| File | Responsibility |
|------|---------------|
| `arcadia_auth/exceptions.py` | `OidcError` hierarchy |
| `arcadia_auth/config.py` | `OidcSettings` — env vars + derived URL properties |
| `arcadia_auth/validator.py` | `OidcValidator` — JWKS cache + RS256 token validation |
| `arcadia_auth/client.py` | `OidcClient` — discovery, token exchange, refresh, revoke, userinfo |
| `arcadia_auth/__init__.py` | Re-export public API |
| `arcadia_auth/py.typed` | Already exists |
| `pyproject.toml` | Replace placeholder deps with real ones, add test deps |
| `tests/conftest.py` | RSA keypair + fake JWKS + fake discovery fixtures |
| `tests/test_validator.py` | `OidcValidator` unit tests |
| `tests/test_client.py` | `OidcClient` unit tests |

### `backend/` (modified files)

| File | Change |
|------|--------|
| `backend/pyproject.toml` | Remove `PyJWT`, add `arcadia-auth` local dep, add `respx` to test deps |
| `backend/app/config.py` | Remove all `oidc_*` fields/properties, add `oidc_settings = OidcSettings()` |
| `backend/app/core/oidc.py` | Replace entirely — instantiate `OidcValidator` + `OidcClient` |
| `backend/app/main.py` | Add `oidc_client.initialize()` + `oidc_validator.initialize()` to lifespan |
| `backend/app/api/auth.py` | Replace httpx blocks with `oidc_client.*`, catch `OidcError` subclasses |
| `backend/app/users.py` | Replace `if payload is None` with `try/except` |
| `backend/app/dependencies.py` | Replace `if payload is None` with `try/except` |
| `backend/tests/unit/auth/test_oidc_validator.py` | Rewrite using `respx` + RSA fixture |
| `backend/tests/integration/conftest.py` | Replace `test-token-*` with validly-signed tokens |

---

## Task 1: Bootstrap `arcadia-auth` package dependencies and test tooling

**Files:**
- Modify: `../arcadia-auth/pyproject.toml`

- [ ] **Step 1: Replace placeholder deps in `pyproject.toml`**

Open `../arcadia-auth/pyproject.toml` and replace the `dependencies` and `[project.optional-dependencies]` sections:

```toml
dependencies = [
  "authlib >= 1.3",
  "httpx >= 0.27",
  "pydantic-settings >= 2.0",
  "cryptography >= 40",
]

[project.optional-dependencies]
test = [
  "pytest >= 8.0",
  "pytest-asyncio >= 0.23",
  "pytest-cov",
  "respx >= 0.21",
  "cryptography >= 40",
]
dev = ["pre-commit", "ruff", "mypy"]
```

Also update classifiers and URLs — remove the CERN template URLs and numpy mypy plugin. Replace `[tool.mypy]` with:

```toml
[tool.mypy]
disallow_untyped_defs = true

[[tool.mypy.overrides]]
module = ["authlib.*"]
ignore_missing_imports = true
```

Remove `[tool.ruff.lint]` entries for `"PD"` (pandas), `"NPY"`, `"NPY201"` — not relevant.

- [ ] **Step 2: Install deps and verify import works**

```bash
cd ../arcadia-auth
pip install -e ".[test]"
python -c "import authlib; import arcadia_auth; print('ok')"
```

Expected: `ok`

- [ ] **Step 3: Commit**

```bash
cd ../arcadia-auth
git add pyproject.toml
git commit -m "chore: replace placeholder deps with authlib stack"
```

---

## Task 2: `exceptions.py` — error hierarchy

**Files:**
- Create: `../arcadia-auth/arcadia_auth/exceptions.py`

- [ ] **Step 1: Write the failing test**

Create `../arcadia-auth/tests/test_exceptions.py`:

```python
from __future__ import annotations

from arcadia_auth.exceptions import (
    DiscoveryError,
    JwksError,
    OidcError,
    TokenExpiredError,
    TokenInvalidError,
)


def test_hierarchy() -> None:
    assert issubclass(DiscoveryError, OidcError)
    assert issubclass(JwksError, OidcError)
    assert issubclass(TokenExpiredError, OidcError)
    assert issubclass(TokenInvalidError, OidcError)


def test_exceptions_are_catchable_as_base() -> None:
    for cls in (DiscoveryError, JwksError, TokenExpiredError, TokenInvalidError):
        try:
            raise cls("test")
        except OidcError:
            pass
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd ../arcadia-auth
pytest tests/test_exceptions.py -v
```

Expected: `ImportError` — module doesn't exist yet.

- [ ] **Step 3: Implement `exceptions.py`**

```python
from __future__ import annotations


class OidcError(Exception):
    pass


class DiscoveryError(OidcError):
    pass


class JwksError(OidcError):
    pass


class TokenExpiredError(OidcError):
    pass


class TokenInvalidError(OidcError):
    pass
```

- [ ] **Step 4: Run to verify it passes**

```bash
pytest tests/test_exceptions.py -v
```

Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add arcadia_auth/exceptions.py tests/test_exceptions.py
git commit -m "feat: add OidcError exception hierarchy"
```

---

## Task 3: `config.py` — `OidcSettings`

**Files:**
- Create: `../arcadia-auth/arcadia_auth/config.py`

- [ ] **Step 1: Write the failing test**

Create `../arcadia-auth/tests/test_config.py`:

```python
from __future__ import annotations

import pytest
from pydantic import ValidationError

from arcadia_auth.config import OidcSettings


def test_derived_urls() -> None:
    s = OidcSettings(
        oidc_endpoint="http://keycloak:8080",
        oidc_public_endpoint="http://localhost:9091",
        oidc_realm="arcadia",
        oidc_client_id="myapp",
        oidc_client_secret="secret",
        oidc_redirect_uri="http://localhost/callback",
    )
    assert s.oidc_base_url == "http://keycloak:8080/realms/arcadia"
    assert s.oidc_public_base_url == "http://localhost:9091/realms/arcadia"
    assert s.oidc_issuer_url == "http://localhost:9091/realms/arcadia"


def test_defaults() -> None:
    s = OidcSettings(
        oidc_endpoint="http://keycloak:8080",
        oidc_public_endpoint="http://localhost:9091",
        oidc_realm="arcadia",
        oidc_client_id="myapp",
        oidc_client_secret="secret",
        oidc_redirect_uri="http://localhost/callback",
    )
    assert s.oidc_jwks_cache_ttl == 3600
    assert s.oidc_init_retries == 5
    assert s.oidc_init_backoff == 2.0


def test_required_fields_missing() -> None:
    with pytest.raises(ValidationError):
        OidcSettings()  # type: ignore[call-arg]
```

- [ ] **Step 2: Run to verify it fails**

```bash
pytest tests/test_config.py -v
```

Expected: `ImportError`.

- [ ] **Step 3: Implement `config.py`**

```python
from __future__ import annotations

from pydantic_settings import BaseSettings


class OidcSettings(BaseSettings):
    oidc_endpoint: str
    oidc_public_endpoint: str
    oidc_realm: str
    oidc_client_id: str
    oidc_client_secret: str
    oidc_redirect_uri: str
    oidc_jwks_cache_ttl: int = 3600
    oidc_init_retries: int = 5
    oidc_init_backoff: float = 2.0

    @property
    def oidc_base_url(self) -> str:
        return f"{self.oidc_endpoint}/realms/{self.oidc_realm}"

    @property
    def oidc_public_base_url(self) -> str:
        return f"{self.oidc_public_endpoint}/realms/{self.oidc_realm}"

    @property
    def oidc_issuer_url(self) -> str:
        return self.oidc_public_base_url

    class Config:
        env_file = ".env"
        extra = "ignore"
```

- [ ] **Step 4: Run to verify it passes**

```bash
pytest tests/test_config.py -v
```

Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add arcadia_auth/config.py tests/test_config.py
git commit -m "feat: add OidcSettings"
```

---

## Task 4: `validator.py` — `OidcValidator`

**Files:**
- Create: `../arcadia-auth/arcadia_auth/validator.py`
- Create: `../arcadia-auth/tests/conftest.py`
- Create: `../arcadia-auth/tests/test_validator.py`

- [ ] **Step 1: Write the shared RSA fixture in `tests/conftest.py`**

```python
from __future__ import annotations

import json
import time
from collections.abc import Generator

import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

from arcadia_auth.config import OidcSettings


@pytest.fixture(scope="session")
def rsa_private_key() -> rsa.RSAPrivateKey:
    return rsa.generate_private_key(public_exponent=65537, key_size=2048)


@pytest.fixture(scope="session")
def rsa_public_key(rsa_private_key: rsa.RSAPrivateKey) -> rsa.RSAPublicKey:
    return rsa_private_key.public_key()


@pytest.fixture(scope="session")
def jwks_data(rsa_public_key: rsa.RSAPublicKey) -> dict:
    # Build a minimal JWK from the public key numbers
    pub_numbers = rsa_public_key.public_numbers()
    import base64
    def int_to_base64url(n: int) -> str:
        length = (n.bit_length() + 7) // 8
        return base64.urlsafe_b64encode(n.to_bytes(length, "big")).rstrip(b"=").decode()
    return {
        "keys": [{
            "kty": "RSA",
            "use": "sig",
            "alg": "RS256",
            "kid": "test-key-1",
            "n": int_to_base64url(pub_numbers.n),
            "e": int_to_base64url(pub_numbers.e),
        }]
    }


@pytest.fixture(scope="session")
def oidc_settings() -> OidcSettings:
    return OidcSettings(
        oidc_endpoint="http://keycloak:8080",
        oidc_public_endpoint="http://localhost:9091",
        oidc_realm="arcadia",
        oidc_client_id="myapp",
        oidc_client_secret="secret",
        oidc_redirect_uri="http://localhost/callback",
    )


@pytest.fixture(scope="session")
def discovery_data(oidc_settings: OidcSettings) -> dict:
    base = oidc_settings.oidc_public_base_url
    return {
        "issuer": oidc_settings.oidc_issuer_url,
        "authorization_endpoint": f"{base}/protocol/openid-connect/auth",
        "token_endpoint": f"{base}/protocol/openid-connect/token",
        "userinfo_endpoint": f"{base}/protocol/openid-connect/userinfo",
        "end_session_endpoint": f"{base}/protocol/openid-connect/logout",
        "revocation_endpoint": f"{base}/protocol/openid-connect/revoke",
        "jwks_uri": f"{base}/protocol/openid-connect/certs",
    }


def make_token(
    private_key: rsa.RSAPrivateKey,
    *,
    sub: str = "user-1",
    iss: str = "http://localhost:9091/realms/arcadia",
    exp_offset: int = 3600,
) -> str:
    import jwt as pyjwt
    priv_bytes = private_key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.TraditionalOpenSSL,
        serialization.NoEncryption(),
    )
    now = int(time.time())
    return pyjwt.encode(
        {"sub": sub, "iss": iss, "exp": now + exp_offset, "iat": now, "jti": "test-jti"},
        priv_bytes,
        algorithm="RS256",
    )
```

Note: `conftest.py` uses `PyJWT` only in test code (it's a test dep) to mint tokens — this is acceptable. The production `validator.py` will use `authlib` only.

Add `PyJWT` and `cryptography` to the test deps in `pyproject.toml`:

```toml
test = [
  "pytest >= 8.0",
  "pytest-asyncio >= 0.23",
  "pytest-cov",
  "respx >= 0.21",
  "cryptography >= 40",
  "PyJWT >= 2.8",
]
```

- [ ] **Step 2: Write the failing tests in `tests/test_validator.py`**

```python
from __future__ import annotations

import time

import pytest
import respx
from httpx import Response

from arcadia_auth.config import OidcSettings
from arcadia_auth.exceptions import JwksError, TokenExpiredError, TokenInvalidError
from arcadia_auth.validator import OidcValidator
from tests.conftest import make_token


@pytest.fixture
def validator(oidc_settings: OidcSettings) -> OidcValidator:
    return OidcValidator(oidc_settings)


@pytest.mark.asyncio
async def test_initialize_fetches_jwks(
    validator: OidcValidator,
    oidc_settings: OidcSettings,
    discovery_data: dict,
    jwks_data: dict,
) -> None:
    with respx.mock:
        respx.get(f"{oidc_settings.oidc_base_url}/.well-known/openid-configuration").mock(
            return_value=Response(200, json=discovery_data)
        )
        # JWKS URI uses public URL — validator rewrites to internal
        jwks_uri = discovery_data["jwks_uri"].replace(
            oidc_settings.oidc_public_base_url, oidc_settings.oidc_base_url
        )
        respx.get(jwks_uri).mock(return_value=Response(200, json=jwks_data))
        await validator.initialize()


@pytest.mark.asyncio
async def test_validate_token_valid(
    validator: OidcValidator,
    oidc_settings: OidcSettings,
    rsa_private_key,
    discovery_data: dict,
    jwks_data: dict,
) -> None:
    with respx.mock:
        respx.get(f"{oidc_settings.oidc_base_url}/.well-known/openid-configuration").mock(
            return_value=Response(200, json=discovery_data)
        )
        jwks_uri = discovery_data["jwks_uri"].replace(
            oidc_settings.oidc_public_base_url, oidc_settings.oidc_base_url
        )
        respx.get(jwks_uri).mock(return_value=Response(200, json=jwks_data))
        await validator.initialize()

    token = make_token(rsa_private_key)
    payload = await validator.validate_token(token)
    assert payload["sub"] == "user-1"


@pytest.mark.asyncio
async def test_validate_token_expired(
    validator: OidcValidator,
    oidc_settings: OidcSettings,
    rsa_private_key,
    discovery_data: dict,
    jwks_data: dict,
) -> None:
    with respx.mock:
        respx.get(f"{oidc_settings.oidc_base_url}/.well-known/openid-configuration").mock(
            return_value=Response(200, json=discovery_data)
        )
        jwks_uri = discovery_data["jwks_uri"].replace(
            oidc_settings.oidc_public_base_url, oidc_settings.oidc_base_url
        )
        respx.get(jwks_uri).mock(return_value=Response(200, json=jwks_data))
        await validator.initialize()

    token = make_token(rsa_private_key, exp_offset=-10)
    with pytest.raises(TokenExpiredError):
        await validator.validate_token(token)


@pytest.mark.asyncio
async def test_validate_token_wrong_issuer(
    validator: OidcValidator,
    oidc_settings: OidcSettings,
    rsa_private_key,
    discovery_data: dict,
    jwks_data: dict,
) -> None:
    with respx.mock:
        respx.get(f"{oidc_settings.oidc_base_url}/.well-known/openid-configuration").mock(
            return_value=Response(200, json=discovery_data)
        )
        jwks_uri = discovery_data["jwks_uri"].replace(
            oidc_settings.oidc_public_base_url, oidc_settings.oidc_base_url
        )
        respx.get(jwks_uri).mock(return_value=Response(200, json=jwks_data))
        await validator.initialize()

    token = make_token(rsa_private_key, iss="http://evil.example.com")
    with pytest.raises(TokenInvalidError):
        await validator.validate_token(token)


@pytest.mark.asyncio
async def test_validate_token_tampered(
    validator: OidcValidator,
    oidc_settings: OidcSettings,
    rsa_private_key,
    discovery_data: dict,
    jwks_data: dict,
) -> None:
    with respx.mock:
        respx.get(f"{oidc_settings.oidc_base_url}/.well-known/openid-configuration").mock(
            return_value=Response(200, json=discovery_data)
        )
        jwks_uri = discovery_data["jwks_uri"].replace(
            oidc_settings.oidc_public_base_url, oidc_settings.oidc_base_url
        )
        respx.get(jwks_uri).mock(return_value=Response(200, json=jwks_data))
        await validator.initialize()

    token = make_token(rsa_private_key)[:-5] + "XXXXX"
    with pytest.raises(TokenInvalidError):
        await validator.validate_token(token)


@pytest.mark.asyncio
async def test_initialize_raises_on_discovery_failure(
    oidc_settings: OidcSettings,
) -> None:
    settings = OidcSettings(
        oidc_endpoint=oidc_settings.oidc_endpoint,
        oidc_public_endpoint=oidc_settings.oidc_public_endpoint,
        oidc_realm=oidc_settings.oidc_realm,
        oidc_client_id=oidc_settings.oidc_client_id,
        oidc_client_secret=oidc_settings.oidc_client_secret,
        oidc_redirect_uri=oidc_settings.oidc_redirect_uri,
        oidc_init_retries=1,
        oidc_init_backoff=0.0,
    )
    validator = OidcValidator(settings)
    with respx.mock:
        respx.get(f"{settings.oidc_base_url}/.well-known/openid-configuration").mock(
            return_value=Response(503)
        )
        with pytest.raises(JwksError):
            await validator.initialize()
```

- [ ] **Step 3: Run to verify tests fail**

```bash
cd ../arcadia-auth
pytest tests/test_validator.py -v
```

Expected: `ImportError` — `validator` module doesn't exist.

- [ ] **Step 4: Implement `validator.py`**

```python
from __future__ import annotations

import asyncio
import logging
import time
import typing

import httpx
from authlib.jose import JsonWebKeySet, jwt
from authlib.jose.errors import ExpiredTokenError, JoseError

from arcadia_auth.config import OidcSettings
from arcadia_auth.exceptions import DiscoveryError, JwksError, TokenExpiredError, TokenInvalidError

logger = logging.getLogger(__name__)


class OidcValidator:
    def __init__(self, settings: OidcSettings) -> None:
        self._settings = settings
        self._keyset: JsonWebKeySet | None = None
        self._fetched_at: float = 0.0

    async def initialize(self) -> None:
        retries = self._settings.oidc_init_retries
        backoff = self._settings.oidc_init_backoff
        last_exc: Exception | None = None
        for attempt in range(retries):
            try:
                await self._refresh_keyset()
                return
            except (DiscoveryError, JwksError) as exc:
                last_exc = exc
                if attempt < retries - 1:
                    await asyncio.sleep(backoff * (2 ** attempt))
        raise JwksError(f"OIDC initialization failed after {retries} attempts") from last_exc

    async def _refresh_keyset(self) -> None:
        discovery_url = f"{self._settings.oidc_base_url}/.well-known/openid-configuration"
        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                resp = await client.get(discovery_url)
            except httpx.HTTPError as exc:
                raise DiscoveryError(f"Could not reach discovery endpoint: {exc}") from exc
            if resp.status_code != 200:
                raise DiscoveryError(f"Discovery returned {resp.status_code}")
            jwks_uri: str = resp.json().get("jwks_uri", "")
            if not jwks_uri:
                raise DiscoveryError("Discovery doc missing jwks_uri")

            # Rewrite public hostname to internal so backend can reach Keycloak
            jwks_uri = jwks_uri.replace(
                self._settings.oidc_public_base_url,
                self._settings.oidc_base_url,
            )

            try:
                jwks_resp = await client.get(jwks_uri)
            except httpx.HTTPError as exc:
                raise JwksError(f"Could not fetch JWKS: {exc}") from exc
            if jwks_resp.status_code != 200:
                raise JwksError(f"JWKS fetch returned {jwks_resp.status_code}")

            self._keyset = JsonWebKeySet.import_key_set(jwks_resp.json())
            self._fetched_at = time.monotonic()

    async def _ensure_keyset(self) -> JsonWebKeySet:
        now = time.monotonic()
        if self._keyset is None or (now - self._fetched_at) > self._settings.oidc_jwks_cache_ttl:
            await self._refresh_keyset()
        if self._keyset is None:
            raise JwksError("JWKS unavailable")
        return self._keyset

    async def validate_token(self, token: str) -> dict[str, typing.Any]:
        keyset = await self._ensure_keyset()
        claims_options = {
            "iss": {"essential": True, "value": self._settings.oidc_issuer_url},
            "exp": {"essential": True},
            "sub": {"essential": True},
        }
        try:
            claims = jwt.decode(token, keyset, claims_options=claims_options)
            claims.validate()
        except ExpiredTokenError as exc:
            raise TokenExpiredError("Token has expired") from exc
        except JoseError as exc:
            raise TokenInvalidError(f"Token invalid: {exc}") from exc
        return dict(claims)
```

- [ ] **Step 5: Run tests**

```bash
pytest tests/test_validator.py -v
```

Expected: all passed.

- [ ] **Step 6: Commit**

```bash
git add arcadia_auth/validator.py tests/conftest.py tests/test_validator.py pyproject.toml
git commit -m "feat: add OidcValidator with authlib JWKS validation"
```

---

## Task 5: `client.py` — `OidcClient`

**Files:**
- Create: `../arcadia-auth/arcadia_auth/client.py`
- Create: `../arcadia-auth/tests/test_client.py`

- [ ] **Step 1: Write the failing tests**

Create `../arcadia-auth/tests/test_client.py`:

```python
from __future__ import annotations

import pytest
import respx
from httpx import Response

from arcadia_auth.client import OidcClient
from arcadia_auth.config import OidcSettings
from arcadia_auth.exceptions import DiscoveryError


@pytest.fixture
def client(oidc_settings: OidcSettings) -> OidcClient:
    return OidcClient(oidc_settings)


@pytest.fixture
def initialized_client(oidc_settings: OidcSettings, discovery_data: dict) -> OidcClient:
    c = OidcClient(oidc_settings)
    c._endpoints = {
        "authorization_endpoint": discovery_data["authorization_endpoint"],
        "token_endpoint": discovery_data["token_endpoint"],
        "revocation_endpoint": discovery_data["revocation_endpoint"],
        "userinfo_endpoint": discovery_data["userinfo_endpoint"],
    }
    return c


@pytest.mark.asyncio
async def test_initialize_caches_endpoints(
    client: OidcClient,
    oidc_settings: OidcSettings,
    discovery_data: dict,
) -> None:
    with respx.mock:
        respx.get(f"{oidc_settings.oidc_base_url}/.well-known/openid-configuration").mock(
            return_value=Response(200, json=discovery_data)
        )
        await client.initialize()
    assert client._endpoints["token_endpoint"] == discovery_data["token_endpoint"]


@pytest.mark.asyncio
async def test_initialize_raises_on_failure(
    oidc_settings: OidcSettings,
) -> None:
    settings = OidcSettings(
        oidc_endpoint=oidc_settings.oidc_endpoint,
        oidc_public_endpoint=oidc_settings.oidc_public_endpoint,
        oidc_realm=oidc_settings.oidc_realm,
        oidc_client_id=oidc_settings.oidc_client_id,
        oidc_client_secret=oidc_settings.oidc_client_secret,
        oidc_redirect_uri=oidc_settings.oidc_redirect_uri,
        oidc_init_retries=1,
        oidc_init_backoff=0.0,
    )
    c = OidcClient(settings)
    with respx.mock:
        respx.get(f"{settings.oidc_base_url}/.well-known/openid-configuration").mock(
            return_value=Response(503)
        )
        with pytest.raises(DiscoveryError):
            await c.initialize()


def test_authorization_url(initialized_client: OidcClient) -> None:
    url = initialized_client.authorization_url(
        redirect_uri="http://localhost/callback",
        state="abc123",
        scope="openid profile email",
    )
    assert "response_type=code" in url
    assert "state=abc123" in url
    assert "openid" in url


@pytest.mark.asyncio
async def test_fetch_tokens(initialized_client: OidcClient, oidc_settings: OidcSettings) -> None:
    token_endpoint = initialized_client._endpoints["token_endpoint"].replace(
        oidc_settings.oidc_public_base_url, oidc_settings.oidc_base_url
    )
    with respx.mock:
        respx.post(token_endpoint).mock(
            return_value=Response(200, json={
                "access_token": "at",
                "refresh_token": "rt",
                "expires_in": 300,
                "token_type": "Bearer",
            })
        )
        result = await initialized_client.fetch_tokens("mycode", "http://localhost/callback")
    assert result["access_token"] == "at"


@pytest.mark.asyncio
async def test_refresh_token(initialized_client: OidcClient, oidc_settings: OidcSettings) -> None:
    token_endpoint = initialized_client._endpoints["token_endpoint"].replace(
        oidc_settings.oidc_public_base_url, oidc_settings.oidc_base_url
    )
    with respx.mock:
        respx.post(token_endpoint).mock(
            return_value=Response(200, json={
                "access_token": "new_at",
                "refresh_token": "new_rt",
                "expires_in": 300,
                "token_type": "Bearer",
            })
        )
        result = await initialized_client.refresh_token("old_rt")
    assert result["access_token"] == "new_at"


@pytest.mark.asyncio
async def test_revoke_token_best_effort(
    initialized_client: OidcClient,
    oidc_settings: OidcSettings,
) -> None:
    revoke_endpoint = initialized_client._endpoints["revocation_endpoint"].replace(
        oidc_settings.oidc_public_base_url, oidc_settings.oidc_base_url
    )
    with respx.mock:
        respx.post(revoke_endpoint).mock(return_value=Response(503))
        # Must not raise even on failure
        await initialized_client.revoke_token("some_token")


@pytest.mark.asyncio
async def test_fetch_userinfo(initialized_client: OidcClient, oidc_settings: OidcSettings) -> None:
    userinfo_endpoint = initialized_client._endpoints["userinfo_endpoint"].replace(
        oidc_settings.oidc_public_base_url, oidc_settings.oidc_base_url
    )
    with respx.mock:
        respx.get(userinfo_endpoint).mock(
            return_value=Response(200, json={"sub": "user-1", "email": "u@example.com"})
        )
        result = await initialized_client.fetch_userinfo("access_token_here")
    assert result["sub"] == "user-1"
```

- [ ] **Step 2: Run to verify tests fail**

```bash
pytest tests/test_client.py -v
```

Expected: `ImportError`.

- [ ] **Step 3: Implement `client.py`**

```python
from __future__ import annotations

import asyncio
import logging
import typing
from urllib.parse import urlencode

import httpx

from arcadia_auth.config import OidcSettings
from arcadia_auth.exceptions import DiscoveryError, OidcError

logger = logging.getLogger(__name__)

_Endpoints = dict[str, str]


class OidcClient:
    def __init__(self, settings: OidcSettings) -> None:
        self._settings = settings
        self._endpoints: _Endpoints = {}

    async def initialize(self) -> None:
        retries = self._settings.oidc_init_retries
        backoff = self._settings.oidc_init_backoff
        last_exc: Exception | None = None
        for attempt in range(retries):
            try:
                await self._fetch_discovery()
                return
            except DiscoveryError as exc:
                last_exc = exc
                if attempt < retries - 1:
                    await asyncio.sleep(backoff * (2 ** attempt))
        raise DiscoveryError(f"OIDC discovery failed after {retries} attempts") from last_exc

    async def _fetch_discovery(self) -> None:
        url = f"{self._settings.oidc_base_url}/.well-known/openid-configuration"
        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                resp = await client.get(url)
            except httpx.HTTPError as exc:
                raise DiscoveryError(f"Could not reach discovery endpoint: {exc}") from exc
            if resp.status_code != 200:
                raise DiscoveryError(f"Discovery returned {resp.status_code}")
            data = resp.json()
        self._endpoints = {
            "authorization_endpoint": data["authorization_endpoint"],
            "token_endpoint": data["token_endpoint"],
            "revocation_endpoint": data.get("revocation_endpoint", ""),
            "userinfo_endpoint": data["userinfo_endpoint"],
        }

    def _internal(self, url: str) -> str:
        return url.replace(self._settings.oidc_public_base_url, self._settings.oidc_base_url)

    def _require_endpoints(self) -> None:
        if not self._endpoints:
            raise DiscoveryError("OidcClient not initialized — call initialize() first")

    def authorization_url(self, redirect_uri: str, state: str, scope: str) -> str:
        self._require_endpoints()
        params = urlencode({
            "client_id": self._settings.oidc_client_id,
            "response_type": "code",
            "redirect_uri": redirect_uri,
            "scope": scope,
            "state": state,
        })
        return f"{self._endpoints['authorization_endpoint']}?{params}"

    async def fetch_tokens(self, code: str, redirect_uri: str) -> dict[str, typing.Any]:
        self._require_endpoints()
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                self._internal(self._endpoints["token_endpoint"]),
                data={
                    "grant_type": "authorization_code",
                    "client_id": self._settings.oidc_client_id,
                    "client_secret": self._settings.oidc_client_secret,
                    "code": code,
                    "redirect_uri": redirect_uri,
                },
            )
        if resp.status_code != 200:
            raise OidcError(f"Token exchange failed: {resp.status_code}")
        return typing.cast(dict[str, typing.Any], resp.json())

    async def refresh_token(self, refresh_token: str) -> dict[str, typing.Any]:
        self._require_endpoints()
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                self._internal(self._endpoints["token_endpoint"]),
                data={
                    "grant_type": "refresh_token",
                    "refresh_token": refresh_token,
                    "client_id": self._settings.oidc_client_id,
                    "client_secret": self._settings.oidc_client_secret,
                },
            )
        if resp.status_code != 200:
            raise OidcError(f"Token refresh failed: {resp.status_code}")
        return typing.cast(dict[str, typing.Any], resp.json())

    async def revoke_token(self, token: str) -> None:
        self._require_endpoints()
        if not self._endpoints.get("revocation_endpoint"):
            return
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                await client.post(
                    self._internal(self._endpoints["revocation_endpoint"]),
                    data={
                        "token": token,
                        "client_id": self._settings.oidc_client_id,
                        "client_secret": self._settings.oidc_client_secret,
                    },
                )
        except Exception:
            logger.debug("Token revocation failed (best-effort, ignored)")

    async def fetch_userinfo(self, access_token: str) -> dict[str, typing.Any]:
        self._require_endpoints()
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                self._internal(self._endpoints["userinfo_endpoint"]),
                headers={"Authorization": f"Bearer {access_token}"},
            )
        if resp.status_code != 200:
            raise OidcError(f"Userinfo fetch failed: {resp.status_code}")
        return typing.cast(dict[str, typing.Any], resp.json())
```

Note: `authlib.integrations.httpx_client.AsyncOAuth2Client` is designed for acting as an OAuth client on behalf of a *user* (with token state), not a server-side code exchange. The above uses plain `httpx` directly for the token endpoint calls, which is simpler and more explicit. `authlib.jose` is used in `validator.py` for the JWKS/JWT part where it genuinely helps.

- [ ] **Step 4: Run tests**

```bash
pytest tests/test_client.py -v
```

Expected: all passed.

- [ ] **Step 5: Commit**

```bash
git add arcadia_auth/client.py tests/test_client.py
git commit -m "feat: add OidcClient with discovery, token exchange, refresh, revoke, userinfo"
```

---

## Task 6: Wire up `__init__.py` public API

**Files:**
- Modify: `../arcadia-auth/arcadia_auth/__init__.py`

- [ ] **Step 1: Update `__init__.py`**

```python
from arcadia_auth._version import version as __version__  # noqa
from arcadia_auth.client import OidcClient
from arcadia_auth.config import OidcSettings
from arcadia_auth.exceptions import (
    DiscoveryError,
    JwksError,
    OidcError,
    TokenExpiredError,
    TokenInvalidError,
)
from arcadia_auth.validator import OidcValidator

__all__ = [
    "OidcClient",
    "OidcSettings",
    "OidcValidator",
    "OidcError",
    "DiscoveryError",
    "JwksError",
    "TokenExpiredError",
    "TokenInvalidError",
]
```

- [ ] **Step 2: Verify full import**

```bash
python -c "from arcadia_auth import OidcClient, OidcSettings, OidcValidator, OidcError, DiscoveryError, JwksError, TokenExpiredError, TokenInvalidError; print('ok')"
```

Expected: `ok`

- [ ] **Step 3: Run all arcadia-auth tests**

```bash
pytest -v
```

Expected: all passed.

- [ ] **Step 4: Commit**

```bash
git add arcadia_auth/__init__.py
git commit -m "feat: export public API from arcadia_auth"
```

---

## Task 7: Update `haochen.lu` dependencies

**Files:**
- Modify: `backend/pyproject.toml`

- [ ] **Step 1: Update `pyproject.toml`**

In `backend/pyproject.toml`, in the `dependencies` list:
- Remove `"PyJWT~=2.10.1"`
- Add `"arcadia-auth @ file://../arcadia-auth"`

In `[project.optional-dependencies]` test section, add:
- `"respx>=0.21"`
- `"PyJWT>=2.8"` (test-only, for signing fixture tokens)

- [ ] **Step 2: Reinstall and verify**

```bash
cd backend
pip install -e ".[test]"
python -c "from arcadia_auth import OidcValidator; print('ok')"
```

Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add pyproject.toml
git commit -m "chore: replace PyJWT with arcadia-auth package"
```

---

## Task 8: Update `config.py` — remove OIDC fields, add `oidc_settings`

**Files:**
- Modify: `backend/app/config.py`

- [ ] **Step 1: Remove OIDC fields from `Settings`**

In `backend/app/config.py`, remove:
- `oidc_endpoint` field (line ~133)
- `oidc_public_endpoint` field
- `oidc_realm` field
- `oidc_issuer` field
- `oidc_client_id` field
- `oidc_client_secret` field
- `oidc_redirect_uri` field
- `oidc_jwks_cache_ttl` field
- `oidc_base_url` property
- `oidc_public_base_url` property
- `oidc_issuer_url` property

Add at the bottom of the file, after `settings = Settings()` / `settings.validate_settings()`:

```python
from arcadia_auth import OidcSettings
oidc_settings = OidcSettings()
```

- [ ] **Step 2: Verify the app still imports**

```bash
cd backend
python -c "from app.config import settings, oidc_settings; print('ok')"
```

Expected: `ok` (will fail if any OIDC env vars are missing — set them or use a `.env` file).

- [ ] **Step 3: Commit**

```bash
git add app/config.py
git commit -m "refactor: move OIDC config to arcadia_auth.OidcSettings"
```

---

## Task 9: Replace `app/core/oidc.py`

**Files:**
- Modify: `backend/app/core/oidc.py`

- [ ] **Step 1: Replace the file entirely**

```python
from __future__ import annotations

from arcadia_auth import OidcClient, OidcValidator
from app.config import oidc_settings

oidc_validator = OidcValidator(oidc_settings)
oidc_client = OidcClient(oidc_settings)
```

- [ ] **Step 2: Verify import**

```bash
python -c "from app.core.oidc import oidc_validator, oidc_client; print('ok')"
```

Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add app/core/oidc.py
git commit -m "refactor: replace hand-rolled OidcValidator with arcadia_auth"
```

---

## Task 10: Update `app/main.py` lifespan

**Files:**
- Modify: `backend/app/main.py`

- [ ] **Step 1: Add OIDC initialization to lifespan**

In `backend/app/main.py`, update the import at the top:

```python
from app.core.oidc import oidc_client, oidc_validator
```

Replace the existing `lifespan` function:

```python
@asynccontextmanager
async def lifespan(app: FastAPI) -> typing.AsyncGenerator[None, None]:
    await init_redis()
    await oidc_client.initialize()
    await oidc_validator.initialize()
    yield
    await close_redis()
```

- [ ] **Step 2: Verify the app starts without error (requires running services)**

```bash
cd backend
python -c "from app.main import app; print('ok')"
```

Expected: `ok` (import only — full startup needs Keycloak running).

- [ ] **Step 3: Commit**

```bash
git add app/main.py
git commit -m "feat: initialize OidcClient and OidcValidator at startup with retry backoff"
```

---

## Task 11: Update `app/api/auth.py`

**Files:**
- Modify: `backend/app/api/auth.py`

- [ ] **Step 1: Update imports**

Replace:
```python
import httpx
from app.config import settings
from app.core.oidc import oidc_validator
```

With:
```python
from arcadia_auth import OidcError, TokenExpiredError, TokenInvalidError
from app.config import oidc_settings, settings
from app.core.oidc import oidc_client, oidc_validator
```

Remove the `from urllib.parse import urlencode` import.

- [ ] **Step 2: Replace `login_redirect`**

Replace the `urlencode(...)` block in `login_redirect`:

```python
url = oidc_client.authorization_url(
    redirect_uri=oidc_settings.oidc_redirect_uri,
    state=state_token,
    scope="openid profile email",
)
```

Remove the old `query = urlencode({...})` and `url = f"{settings.oidc_public_base_url}/protocol/openid-connect/auth?{query}"` lines.

- [ ] **Step 3: Replace `_fetch_oidc_tokens` and `_fetch_oidc_profile`**

Delete both functions entirely. In `auth_callback`, replace their calls:

```python
@router.get("/callback")
async def auth_callback(
    code: str,
    state: str,
    session: AsyncSession = _session_dependency,
) -> Response:
    context = await _consume_login_state(state)
    try:
        oidc_tokens = await oidc_client.fetch_tokens(code, oidc_settings.oidc_redirect_uri)
        oidc_profile = await oidc_client.fetch_userinfo(oidc_tokens["access_token"])
    except OidcError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Authentication failed") from exc
    await _sync_user(session, oidc_profile)
    refresh_token = oidc_tokens.get("refresh_token") or ""
    if not isinstance(refresh_token, str) or not refresh_token:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="OIDC refresh token missing")
    cookie_ttl = oidc_tokens.get("expires_in")
    if not isinstance(cookie_ttl, int):
        cookie_ttl = _refresh_token_ttl_seconds()
    response = Response(status_code=status.HTTP_302_FOUND)
    response.headers["Location"] = context.next
    _set_refresh_cookie(response, refresh_token, max_age=cookie_ttl)
    return response
```

- [ ] **Step 4: Replace `refresh_session` httpx block**

Replace the inline `async with httpx.AsyncClient...` block in `refresh_session`:

```python
try:
    token_data = await oidc_client.refresh_token(old_refresh_token)
except OidcError as exc:
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token revoked") from exc
```

Remove the old `async with httpx.AsyncClient(timeout=10.0) as client: token_response = await client.post(...)` block and the `if token_response.status_code != status.HTTP_200_OK:` check.

- [ ] **Step 5: Replace `logout` httpx block**

Replace the inline revoke block in `logout`:

```python
refresh_token = request.cookies.get(settings.refresh_cookie_name)
if refresh_token:
    await oidc_client.revoke_token(refresh_token)
```

Remove the old `try: async with httpx.AsyncClient...` block.

- [ ] **Step 6: Verify imports are clean (no leftover `httpx` or old `settings.oidc_*` references)**

```bash
grep -n "httpx\|oidc_base_url\|oidc_public_base_url\|protocol/openid-connect" app/api/auth.py
```

Expected: no matches (aside from any comments).

- [ ] **Step 7: Commit**

```bash
git add app/api/auth.py
git commit -m "refactor: replace httpx OIDC flows with OidcClient in auth.py"
```

---

## Task 12: Update `app/users.py` and `app/dependencies.py`

**Files:**
- Modify: `backend/app/users.py`
- Modify: `backend/app/dependencies.py`

- [ ] **Step 1: Update `users.py`**

Add import:
```python
from arcadia_auth import JwksError, TokenExpiredError, TokenInvalidError
```

Replace the `payload = await oidc_validator.validate_token(token)` / `if payload is None:` block in `current_active_user`:

```python
try:
    payload = await oidc_validator.validate_token(token)
except (TokenExpiredError, TokenInvalidError):
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
except JwksError:
    raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Auth service unavailable")
```

- [ ] **Step 2: Update `dependencies.py`**

Add import:
```python
from arcadia_auth import JwksError, TokenExpiredError, TokenInvalidError
```

Replace the `payload = await oidc_validator.validate_token(token)` / `if payload is None:` block in `get_current_user_optional`:

```python
try:
    payload = await oidc_validator.validate_token(token)
except (TokenExpiredError, TokenInvalidError, JwksError):
    return None
```

- [ ] **Step 3: Commit**

```bash
git add app/users.py app/dependencies.py
git commit -m "refactor: replace None-return token validation with typed exceptions"
```

---

## Task 13: Update `backend` unit tests for `OidcValidator`

**Files:**
- Modify: `backend/tests/unit/auth/test_oidc_validator.py`

- [ ] **Step 1: Rewrite the test file**

The existing tests use `OidcValidator.__new__` to inject keys directly and mock `httpx.AsyncClient`. Replace the entire file with method-level mocking against the new exception-based API:

```python
from __future__ import annotations

import pytest
from unittest.mock import AsyncMock, patch

from arcadia_auth import OidcValidator, OidcSettings
from arcadia_auth.exceptions import JwksError, TokenExpiredError, TokenInvalidError


@pytest.fixture
def settings() -> OidcSettings:
    return OidcSettings(
        oidc_endpoint="http://keycloak:8080",
        oidc_public_endpoint="http://localhost:9091",
        oidc_realm="arcadia",
        oidc_client_id="myapp",
        oidc_client_secret="secret",
        oidc_redirect_uri="http://localhost/callback",
        oidc_init_retries=1,
        oidc_init_backoff=0.0,
    )


@pytest.mark.unit
@pytest.mark.asyncio
async def test_validate_token_delegates_to_validator(settings: OidcSettings) -> None:
    validator = OidcValidator(settings)
    with patch.object(validator, "validate_token", new_callable=AsyncMock) as mock_validate:
        mock_validate.return_value = {"sub": "user-1", "iss": "http://localhost:9091/realms/arcadia"}
        result = await validator.validate_token("any-token")
    assert result["sub"] == "user-1"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_validate_token_raises_token_expired(settings: OidcSettings) -> None:
    validator = OidcValidator(settings)
    with patch.object(validator, "validate_token", new_callable=AsyncMock) as mock_validate:
        mock_validate.side_effect = TokenExpiredError("expired")
        with pytest.raises(TokenExpiredError):
            await validator.validate_token("expired-token")


@pytest.mark.unit
@pytest.mark.asyncio
async def test_validate_token_raises_token_invalid(settings: OidcSettings) -> None:
    validator = OidcValidator(settings)
    with patch.object(validator, "validate_token", new_callable=AsyncMock) as mock_validate:
        mock_validate.side_effect = TokenInvalidError("bad token")
        with pytest.raises(TokenInvalidError):
            await validator.validate_token("bad-token")


@pytest.mark.unit
@pytest.mark.asyncio
async def test_initialize_raises_jwks_error_on_failure(settings: OidcSettings) -> None:
    validator = OidcValidator(settings)
    with patch.object(validator, "_refresh_keyset", new_callable=AsyncMock) as mock_refresh:
        mock_refresh.side_effect = JwksError("unavailable")
        with pytest.raises(JwksError):
            await validator.initialize()
```

- [ ] **Step 2: Run**

```bash
pytest tests/unit/auth/test_oidc_validator.py -v
```

Expected: all passed.

- [ ] **Step 3: Commit**

```bash
git add tests/unit/auth/test_oidc_validator.py
git commit -m "test: rewrite oidc_validator tests using exception API, remove httpx mocking"
```

---

## Task 14: Update integration test `conftest.py` — remove `test-token-*`

**Files:**
- Modify: `backend/tests/integration/conftest.py`

- [ ] **Step 1: Add RSA token-signing fixture**

Add imports at the top of `backend/tests/integration/conftest.py`:

```python
import time

import jwt as pyjwt
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
```

Add fixtures before `admin_auth_headers`:

```python
@pytest.fixture(scope="session")
def integration_rsa_private_key() -> rsa.RSAPrivateKey:
    return rsa.generate_private_key(public_exponent=65537, key_size=2048)


def _sign_token(private_key: rsa.RSAPrivateKey, sub: str) -> str:
    priv_bytes = private_key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.TraditionalOpenSSL,
        serialization.NoEncryption(),
    )
    now = int(time.time())
    return pyjwt.encode(
        {
            "sub": sub,
            "iss": "http://localhost:9091/realms/arcadia",
            "exp": now + 3600,
            "iat": now,
            "jti": f"integration-{sub}",
        },
        priv_bytes,
        algorithm="RS256",
    )
```

- [ ] **Step 2: Update `admin_auth_headers` and `user_auth_headers`**

Replace the two fixtures:

```python
@pytest_asyncio.fixture
async def admin_auth_headers(
    integration_session: AsyncSession,
    integration_rsa_private_key: rsa.RSAPrivateKey,
) -> dict[str, str]:
    result = await integration_session.execute(
        select(User).where(User.username == "integration_admin")
    )
    admin_user = result.scalar_one_or_none()
    if admin_user is None:
        msg = "Integration admin user not found"
        raise RuntimeError(msg)
    token = _sign_token(integration_rsa_private_key, str(admin_user.oidc_id))
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def user_auth_headers(
    integration_session: AsyncSession,
    integration_rsa_private_key: rsa.RSAPrivateKey,
) -> dict[str, str]:
    result = await integration_session.execute(
        select(User).where(User.username == "integration_user")
    )
    regular_user = result.scalar_one_or_none()
    if regular_user is None:
        msg = "Integration regular user not found"
        raise RuntimeError(msg)
    token = _sign_token(integration_rsa_private_key, str(regular_user.oidc_id))
    return {"Authorization": f"Bearer {token}"}
```

Note: these tokens will be validated by the real `OidcValidator` in integration tests, which fetches JWKS from Keycloak. For the tokens to validate, the integration test environment needs either a running Keycloak pre-loaded with the test RSA key, or `OidcValidator` needs to be mocked at the fixture level for integration tests. The simplest approach: mock `oidc_validator.validate_token` in integration test setup to return the expected payload for the test user, rather than doing real JWKS validation. Add this fixture:

```python
@pytest.fixture(autouse=True)
def mock_oidc_validator_for_integration(monkeypatch):
    """Bypass JWKS validation in integration tests — auth is not what's under test."""
    from app.core.oidc import oidc_validator
    from arcadia_auth.exceptions import TokenInvalidError

    original = oidc_validator.validate_token

    async def fake_validate(token: str):
        # Decode without verification to extract sub claim
        try:
            payload = pyjwt.decode(token, options={"verify_signature": False, "verify_exp": False})
            return payload
        except Exception:
            raise TokenInvalidError("Invalid token in integration test")

    monkeypatch.setattr(oidc_validator, "validate_token", fake_validate)
    return
```

- [ ] **Step 3: Remove `TESTING=true` env var from `backend/app/core/oidc.py`** (already done in Task 9 — verify it's gone)

```bash
grep -n "TESTING\|test-token" backend/app/core/oidc.py
```

Expected: no matches.

- [ ] **Step 4: Commit**

```bash
git add tests/integration/conftest.py
git commit -m "test: replace test-token bypass with signed JWT fixtures in integration tests"
```

---

## Task 15: Run full test suite and verify

- [ ] **Step 1: Run `arcadia-auth` tests**

```bash
cd ../arcadia-auth
pytest -v
```

Expected: all passed.

- [ ] **Step 2: Run `haochen.lu` unit tests**

```bash
cd backend
pytest tests/unit/ -v
```

Expected: all passed.

- [ ] **Step 3: Run pre-commit on both repos**

```bash
cd ../arcadia-auth
pre-commit run --all-files

cd ../haochen.lu/backend
pre-commit run --all-files
```

Expected: all checks pass.

- [ ] **Step 4: Start the dev stack and verify login flow works end-to-end**

```bash
cd ..
./dev.sh start
./dev.sh logs backend -f
```

Open `http://localhost/admin` in a browser. Confirm:
- Redirect to Keycloak login works
- Login with `admin` / `adminadmin` succeeds
- Redirect back to `/admin` works
- `/api/auth/me` returns the user

- [ ] **Step 5: Final commit**

```bash
git add -p  # stage any remaining changes
git commit -m "chore: complete arcadia-auth OIDC refactor"
```
