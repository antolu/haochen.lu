# Auth

`haochen.lu` is the first-party auth broker for sibling apps.

## Main pieces

- Authelia handles the user login.
- `haochen.lu` syncs the OIDC user into its local `users` table.
- `haochen.lu` issues short-lived auth codes and access tokens for registered
  first-party apps.
- Sub-apps exchange codes through their own backend using `client_secret`.
- Sub-apps validate access tokens by calling `haochen.lu /api/auth/me`.

## 🔐 The "Hub and Spoke" Model

It's important to differentiate between the two types of credentials:

1.  **Broker -> Authelia (The "Hub")**:
    - This is the single connection between `haochen.lu` and Authelia.
    - You only need **one** set of `OIDC_CLIENT_ID/SECRET` for the entire platform.
    - All sub-apps inherit this connection. You **do not** need to register every individual sub-app in Authelia.

2.  **Sub-app -> Broker (The "Spokes")**:
    - Each sub-app (e.g., `moviedb-manager`) gets its own `client_id` and `client_secret` **from `haochen.lu`**.
    - These are used to authenticate the sub-app with the `haochen.lu` broker.
    - `haochen.lu` manages these internally in its sub-app registry.

## Sub-app registration

Each sub-app in the registry can define:

- `url`: main app URL
- `admin_url`: optional admin destination
- `client_id`
- `client_secret`
- `redirect_uris`

If `requires_auth` is enabled and credentials are missing, `haochen.lu` creates
them automatically. The default redirect URI is:

```text
{subapp.url}/auth/callback
```

Override `redirect_uris` if the callback lives somewhere else.

## Browser flow

1. A sub-app redirects the browser to:

```text
/login?client_id=...&redirect_uri=...&response_type=code&state=...
```

2. `haochen.lu` sends the user to Authelia.
3. Authelia sends the browser back to `haochen.lu /api/auth/callback`.
4. `haochen.lu` creates a local session and redirects to the sub-app callback:

```text
{redirect_uri}?code=...&state=...
```

5. The sub-app backend exchanges the code at:

```text
POST /api/auth/oauth/token
```

6. The sub-app stores the access token on its own domain.

## Admin jump

For authenticated admins, `haochen.lu` exposes:

```text
GET /api/auth/jump/{slug}?target=app
GET /api/auth/jump/{slug}?target=admin
```

The admin UI uses this to jump into either the main sub-app entrypoint or the
registered `admin_url`.

## Required env

`haochen.lu`:

- `OIDC_ENDPOINT`
- `OIDC_CLIENT_ID`
- `OIDC_CLIENT_SECRET`
- `OIDC_REDIRECT_URI`
- `SECRET_KEY`
- `SESSION_SECRET_KEY`

First-party sub-apps:

- broker base URL
- `client_id`
- `client_secret`
- broker callback `redirect_uri`

## Local Docker setup

The development compose files use a shared Docker network named
`first-party-auth-network`.

- `haochen.lu` backend joins this network with alias `auth-broker`
- first-party sub-app backends join the same network
- sub-app backends should call the broker at `http://auth-broker:8000`
- browser redirects still use `http://localhost/login`

For `moviedb-manager` in local Docker:

```text
MOVIEDB_SECURITY__AUTH_BASE_URL=http://auth-broker:8000
MOVIEDB_SECURITY__REDIRECT_URI=http://localhost:6001/auth/callback
VITE_AUTH_BASE_URL=http://localhost
VITE_AUTH_REDIRECT_URI=http://localhost:6001/auth/callback
```

## Deploying Authelia behind a reverse proxy

Authelia requires `authelia_url` to use `https://`. In production this is fine — your outer nginx terminates TLS and users hit Authelia over HTTPS.

For this to work correctly, the reverse proxy must forward these headers to Authelia:

```nginx
proxy_set_header X-Forwarded-Proto https;
proxy_set_header X-Forwarded-Host $host;
proxy_set_header X-Forwarded-Port 443;
```

Without `X-Forwarded-Proto: https`, Authelia may reject or misbehave even if the user connected over TLS.

In development, a self-signed cert is used for `localhost.localdomain` so the same nginx-terminates-TLS pattern is preserved locally.

## Notes

- This is a first-party trust model, not a public multi-tenant OAuth platform.
- Sub-apps should not share the broker JWT signing secret.
- Token verification is done by calling back to `haochen.lu /api/auth/me`.
