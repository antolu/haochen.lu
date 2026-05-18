# File Uploads

Arbitrary files (PDFs, docs, ZIPs, etc.) can be uploaded by admins and served publicly via clean URLs.

## Storage

Files are stored on disk as `{uuid}.{ext}` under the `file_uploads/` directory (configured via `FILE_UPLOAD_DIR` env var). The human-readable filename (URL slug) is stored in the `files` DB table as `original_name`.

```
file_uploads/
  ├── 3f4a1b2c-...pdf   # stored as UUID
  └── 9e8d7c6b-...zip
```

## Public URL

```
GET /files/{original_name}
```

Example: `GET /files/my-cv.pdf`

- Proxied through nginx → FastAPI (not served statically)
- Rate limited: 5 requests per 5 minutes per client IP (same as photo downloads)
- Returns 404 if not found

## Collision Handling

If a file with the same `original_name` already exists on upload:

- Backend returns HTTP 409 with `{"conflict": true, "existing_id": "..."}`
- Frontend shows a modal: **Rename**, **Replace existing**, or **Cancel**
- `POST /api/files?replace=true` overwrites the existing record and disk file

## Renaming

`PATCH /api/files/{id}` updates `original_name` only. The disk file is not moved — only the DB slug changes. The public URL changes immediately.

## Nginx

`/files/` must proxy to the backend (not served as static files). This enables rate limiting and future access control:

```nginx
location /files/ {
    proxy_pass http://127.0.0.1:8000;
    ...
}
```

This block must appear **before** the SPA catch-all `location /` in both `nginx.conf` and `nginx.conf.dev`.

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/files` | Admin | Upload a file. Returns 409 on name collision unless `?replace=true` |
| `GET` | `/api/files` | Admin | List files (sort, filter, paginate) |
| `PATCH` | `/api/files/{id}` | Admin | Rename a file (updates URL slug) |
| `DELETE` | `/api/files/{id}` | Admin | Delete file record and disk file |
| `GET` | `/files/{filename}` | Public | Serve file by original name |

## Future: Access Control

The `files` table has an `access_level` column (`public`/`authenticated`/`private`, default `public`). Not yet exposed in the UI. When implemented, the `serve_public_file` handler in `backend/app/api/files.py` will enforce it.
