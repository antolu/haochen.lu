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
| `POST` | `/api/auth/login` | Admin login |
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
