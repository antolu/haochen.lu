# haochen.lu

Personal portfolio and photography platform. Built with FastAPI and React.

## Features

**Photography**
- Photo gallery with filtering by location, date, and camera
- Interactive map with cluster-based geographic browsing (MapLibre)
- Multi-variant image processing (400px–2400px) with responsive loading
- Automatic content negotiation for best format (AVIF, WebP, JPEG)
- EXIF extraction on upload: GPS coordinates, camera/lens info, timestamps
- Automatic reverse geocoding via OpenStreetMap Nominatim

**Portfolio & blog**
- Project showcase with automatic README fetching from GitHub/GitLab repositories
- Blog with Markdown rendering and syntax highlighting
- Editable homepage content sections and hero images

**Admin interface** (`/admin`)
- Photo management: upload, metadata editing, map-based location picking, custom fields
- Camera and lens alias normalization for consistent EXIF display
- Project and blog post CRUD
- Sub-application registry for embedding external apps
- First-party SSO broker for sibling apps with admin jump links
- Profile picture and hero image management
- Runtime settings

## Stack

- **Backend**: FastAPI, SQLAlchemy 2.0, PostgreSQL 15, Redis 7
- **Frontend**: React 19, TypeScript, Vite, TanStack Query, Zustand, MapLibre, Tailwind CSS v4, Framer Motion
- **Infrastructure**: Docker Compose, nginx

## Project structure

```
backend/app/
├── api/          route handlers (photos, projects, blog, locations, auth, subapps, ...)
├── core/         image processing, geocoding, rate limiting, repository integration
├── models/       SQLAlchemy models
├── schemas/      Pydantic schemas
└── crud/         database operations
backend/alembic/      migrations

frontend/src/
├── pages/        route-level components (photography, projects, blog, admin/*)
├── components/   UI components (map, photo grid, lightbox, upload, admin forms, ...)
├── api/          typed API client
├── stores/       Zustand stores
└── hooks/        custom React hooks

subapps/          sub-application registry and scripts
docs/             deployment guides
```

## Running locally

Create a `.env` file with required secrets:

```bash
python -c "import secrets; print(f'SECRET_KEY={secrets.token_urlsafe(32)}')" >> .env
python -c "import secrets; print(f'SESSION_SECRET_KEY={secrets.token_urlsafe(32)}')" >> .env
echo "ADMIN_PASSWORD=your_password" >> .env
```

Optional variables (defaults shown):

```bash
ENVIRONMENT=development
POSTGRES_DB=portfolio
POSTGRES_PASSWORD=portfolio_password
CORS_ORIGINS=http://localhost
```

Start everything:

```bash
./dev.sh start
./dev.sh logs          # view logs
./dev.sh logs backend  # specific service
./dev.sh stop
```

The dev environment runs with live reload on both backend (uvicorn) and frontend (Vite).

| URL | Description |
|-----|-------------|
| http://localhost | Site |
| http://localhost/admin | Admin interface |
| http://localhost/api/docs | Interactive API docs (Swagger) |
| http://localhost/api/redoc | API docs (ReDoc) |
| http://localhost:8000 | Backend direct access (debugging) |

Default admin credentials: `admin` / the `ADMIN_PASSWORD` you set.

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/auth/login` | Start portfolio or sub-app login |
| `GET` | `/api/auth/authorize` | Approve a first-party app and issue an auth code |
| `POST` | `/api/auth/oauth/token` | Exchange a sub-app auth code for an access token |
| `GET` | `/api/auth/jump/{slug}` | Jump into a first-party app or its admin URL |
| `GET` | `/api/photos` | Paginated photo listing with filters |
| `GET` | `/api/photos/locations` | Location data optimized for map clustering |
| `POST` | `/api/photos` | Upload photo (admin) |
| `GET` | `/api/projects` | Projects with repository integration |
| `GET` | `/api/blog` | Blog posts |
| `GET` | `/api/locations/search` | Location autocomplete |
| `GET` | `/api/locations/geocode` | Address to coordinates |
| `GET` | `/api/locations/reverse` | Coordinates to address |
| `GET` | `/api/subapps` | Sub-application registry |

Full interactive documentation available at `/api/docs` when running.

## First-party auth

`haochen.lu` is the central login broker for first-party apps such as
`moviedb-manager`.

- The browser is redirected to `/login` on `haochen.lu` with `client_id`,
  `redirect_uri`, `response_type=code`, and `state`.
- After Casdoor login, `haochen.lu` returns the browser to the sub-app callback
  with a short-lived auth code.
- The sub-app backend exchanges that code at `/api/auth/oauth/token` using its
  own `client_secret`.
- The sub-app stores the returned access token on its own domain and can verify
  it by calling `/api/auth/me`.

The sub-app registry also supports an `admin_url` so the `haochen.lu` admin can
jump directly into a sibling app’s admin UI without embedding it.

See [docs/AUTH.md](./docs/AUTH.md).

### Local first-party app wiring

To connect a sibling app like `moviedb-manager` locally:

1. Start `haochen.lu` with `docker compose -f docker-compose.dev.yml up -d`.
2. Start the sibling app with its own dev compose.
3. Both stacks join the shared Docker network `first-party-auth-network`.
4. Inside sibling app containers, the auth broker is available at
   `http://auth-broker:8000`.
5. In the browser, the login entrypoint stays `http://localhost/login`.

## Deployment

Production uses pre-built images from Docker Hub (`antonlu/arcadia-backend`, `antonlu/arcadia-frontend`). Pushing a version tag triggers a GitHub Actions build:

```bash
git tag v1.0.0 && git push origin v1.0.0
```

This builds multi-arch images (`linux/amd64` + `linux/arm64`) and pushes them with both the version tag and `latest`.

To run production locally:

```bash
# Add to .env
ENVIRONMENT=production
COOKIE_SECURE=true
CORS_ORIGINS=https://yourdomain.com

docker compose up -d
```

For TrueNAS Scale deployment, see [docs/TRUENAS_DEPLOYMENT.md](./docs/TRUENAS_DEPLOYMENT.md).

## License

This project is licensed under the PolyForm Noncommercial License 1.0.0. See
`LICENSE.md` for the full text and terms.
