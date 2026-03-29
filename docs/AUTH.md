# Auth

`haochen.lu` is the first-party auth broker for sibling apps.

## Main pieces

- Authelia handles user login.
- `haochen.lu` syncs the OIDC user into its local `users` table.
- `haochen.lu` issues short-lived auth codes and access tokens for registered
  first-party apps.
- Apps exchange codes through their own backend using `client_secret`.
- Apps validate access tokens by calling `haochen.lu /api/auth/me`.

## The "Hub and Spoke" Model

Two distinct credential relationships:

1. **Broker → Authelia (the hub)**
   - One set of `OIDC_CLIENT_ID/SECRET` for the entire platform.
   - All apps inherit this connection — you do not register each app in Authelia.

2. **App → Broker (the spokes)**
   - Each app gets its own `client_id` and `client_secret` from `haochen.lu`.
   - Managed via the admin interface at `/admin/applications`.

## Registering an app

Each app in the registry defines:

| Field | Required | Description |
|---|---|---|
| `url` | yes | Main app URL |
| `admin_url` | no | Optional admin destination |
| `requires_auth` | yes | Enables OIDC flow and auto-generates credentials |
| `client_id` | auto | Generated on creation if `requires_auth` is true |
| `client_secret` | auto | Generated on creation if `requires_auth` is true |
| `redirect_uris` | auto | Defaults to `{url}/auth/callback` |

Override `redirect_uris` if the callback lives somewhere else. The field accepts
a comma- or newline-separated list, or a JSON array of strings.

## Browser flow

### 1. App initiates login

Redirect the browser to:

```
GET /api/auth/login?client_id=...&redirect_uri=...&response_type=code&state=...
```

| Parameter | Required | Description |
|---|---|---|
| `client_id` | yes | Your app's `client_id` from the registry |
| `redirect_uri` | yes | Must exactly match one of the registered `redirect_uris` |
| `response_type` | yes | Must be `code` |
| `state` | yes | Opaque string you generate; returned unchanged in the callback |

`haochen.lu` validates the parameters and forwards the user to Authelia.

### 2. Authelia authenticates the user

The user logs in with their Authelia credentials. On success, Authelia redirects
back to `haochen.lu /api/auth/callback`.

### 3. Broker redirects to your app

`haochen.lu` creates a local session, then redirects to your `redirect_uri`:

```
{redirect_uri}?code=...&state=...
```

The `code` is a short-lived single-use authorization code (~60 seconds).
The `state` is the value you passed in step 1 — verify it matches to prevent CSRF.

### 4. Exchange the code for a token

Your **backend** (never the browser) calls:

```
POST /api/auth/oauth/token
Content-Type: application/json

{
  "grant_type": "authorization_code",
  "code": "<code from callback>",
  "client_id": "<your client_id>",
  "client_secret": "<your client_secret>",
  "redirect_uri": "<same redirect_uri used in step 1>"
}
```

Response `200 OK`:

```json
{
  "access_token": "<JWT>",
  "token_type": "bearer",
  "expires_in": 900,
  "user": {
    "id": "<uuid>",
    "email": "user@example.com",
    "username": "anton",
    "is_admin": true,
    "oidc_id": "<authelia subject>",
    "created_at": "...",
    "updated_at": "..."
  }
}
```

`expires_in` is in seconds (default: 900 = 15 minutes). Store the token on your
own domain (e.g. an httpOnly cookie or server-side session).

Error responses follow standard OAuth error codes:
- `400 unsupported_grant_type` — `grant_type` is not `authorization_code`
- `401 invalid_client` — `client_id`/`client_secret` mismatch
- `400 invalid_grant` — code expired, already used, or parameters don't match

### 5. Validate the token on subsequent requests

Your backend passes the token to `haochen.lu` to verify it and get the current
user:

```
GET /api/auth/me
Authorization: Bearer <access_token>
```

Response `200 OK`: same `UserRead` object as in the token exchange response.

- `401 Unauthorized` — token missing, expired, or invalid.

Call this on every protected request, or cache the result for the token's
remaining lifetime.

## Required env vars

### `haochen.lu` broker

- `OIDC_ENDPOINT` — Authelia base URL
- `OIDC_CLIENT_ID` — broker's Authelia client ID
- `OIDC_CLIENT_SECRET` — broker's Authelia client secret
- `OIDC_REDIRECT_URI` — broker's Authelia callback URL
- `SECRET_KEY` — JWT signing key
- `SESSION_SECRET_KEY` — session encryption key

### Each app

- `AUTH_BASE_URL` — broker base URL (e.g. `https://haochen.lu` or `http://auth-broker:8000` in Docker)
- `CLIENT_ID` — your app's `client_id` from the registry
- `CLIENT_SECRET` — your app's `client_secret` from the registry
- `REDIRECT_URI` — your callback URL (must match registry)

## Local Docker setup

Dev compose files use a shared Docker network named `first-party-auth-network`.

- `haochen.lu` backend joins this network as `auth-broker`
- App backends join the same network
- App backends call the broker at `http://auth-broker:8000`
- Browser redirects use `http://localhost`

Example for `moviedb-manager`:

```
MOVIEDB_SECURITY__AUTH_BASE_URL=http://auth-broker:8000
MOVIEDB_SECURITY__REDIRECT_URI=http://localhost:6001/auth/callback
VITE_AUTH_BASE_URL=http://localhost
VITE_AUTH_REDIRECT_URI=http://localhost:6001/auth/callback
```

## Dev credentials

Authelia users are defined in `authelia/config/users_database.yml`.

| username | password |
|---|---|
| admin | adminadmin |
| root | adminadmin |

Both are in the `admins` group.

## Deploying behind a reverse proxy

Authelia requires `https://`. Your outer nginx terminates TLS; forward these
headers to Authelia:

```nginx
proxy_set_header X-Forwarded-Proto https;
proxy_set_header X-Forwarded-Host $host;
proxy_set_header X-Forwarded-Port 443;
```

Without `X-Forwarded-Proto: https`, Authelia may reject requests even if the
user connected over TLS.

In development, a self-signed cert is used for `localhost.localdomain` to
preserve the same TLS pattern locally. `./dev.sh start` generates this cert in
`authelia/certs/` automatically.

Authelia requires a dotted domain for session cookies. Add this to `/etc/hosts`
once:

```
127.0.0.1 localhost.localdomain
```

`./dev.sh start` will warn if this entry is missing.

## Notes

- First-party trust model only — not a public multi-tenant OAuth platform.
- Apps must not share the broker JWT signing secret.
- Token verification is always done by calling back to `/api/auth/me`.
