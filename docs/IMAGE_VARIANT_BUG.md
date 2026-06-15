# Image variant generation bug

## Symptom

Photo grid (`PhotoGrid`) and map thumbnails (`MapLibrePhotoMap`) take several seconds
to load even with only 2-3 photos, in both dev and staging. Suspected cause: frontend
falling back to serving original multi-MB JPEGs instead of WebP variants.

## Root cause #1 (the urgent one): sequential-access pyvips pipeline reused across variants

File: `backend/app/core/vips_processor.py`

`_generate_responsive_variants` / `_build_vips_variants` loads the source image once
with `pyvips.Image.new_from_file(path, access="sequential")`, then calls `.resize()`
on that **same** image object once per target size (micro, thumbnail, small, medium,
large, xlarge), generating avif/webp/jpeg for each.

A `sequential`-access vips pipeline can only be read once, scanline by scanline. The
first resize+save (micro) consumes the read. Every subsequent `.resize()` derived from
the same source object then fails silently (caught by broad `except Exception` in
`_save_*_variant`, logged, returns `None`).

**Result for every real upload**: only `micro` gets a working `webp` variant.
`thumbnail`, `small`, `medium`, `large`, `xlarge` all end up as empty `{}` dicts in the
`variants` JSON column. Even micro's avif/jpeg fail too, since they're attempted after
webp has already partially drained the pipeline.

Confirmed live via direct repro inside `portfolio-app-dev`:

```python
img = pyvips.Image.new_from_file(src, access="sequential").autorot().colourspace("srgb")
r1 = img.resize(64/4000, kernel="lanczos3")
r1.webpsave("/tmp/micro.webp", Q=50, effort=6)   # OK
r2 = img.resize(150/4000, kernel="lanczos3")
r2.webpsave("/tmp/thumb.webp", Q=60, effort=6)   # FAIL: unable to call webpsave (empty libvips error)
```

This matches the live DB state for all 3 existing photo rows: `variants.thumbnail/small/
medium/large/xlarge == {}`, `variants.micro.webp` present and valid.

### Downstream effect on frontend

- `PhotoGrid.tsx` -> `selectOptimalImage` (`frontend/src/utils/imageUtils.ts:307-346`)
  picks the smallest-fitting variant by width, falling back to `photo.original_url`
  if `variants[selectedVariant]?.url` is missing.
- `MapLibrePhotoMap.tsx:107-109` requests `variants["thumbnail"]?.url ?? variants["small"]?.url`,
  also falling back to `original_url`.
- Since thumbnail/small/medium/large/xlarge are all empty, both components fall back to
  the full-size original JPEG (multi-MB) — the actual cause of the slow grid/map loads.

### Fix direction (not yet implemented)

Load the source image with `access="random"` (full in-memory random access) instead of
`"sequential"` in `_generate_responsive_variants`. We deliberately need to re-derive
pixels 6 times (once per target size: micro/thumbnail/small/medium/large/xlarge) from
the same source — `sequential` access is a streaming optimization for single-pass
consumption and breaks once a second `.resize()` is derived from the same source
object. `random` decodes once into memory and allows repeated independent reads;
reloading from disk per-size with `sequential` would also work but costs 6x JPEG
decode. Keep the existing per-format try/except-and-continue behavior in
`_save_avif_variant`/`_save_webp_variant`/`_save_jpeg_variant` as-is — that resilience
is correct and orthogonal to this bug.

After the code fix, existing photos in the DB still have empty variant dicts and need a
backfill: re-run `_generate_responsive_variants` against their original files and update
the `variants` column.

### Open follow-up: surface processing errors to the frontend

Right now, when a variant format fails to generate, the failure is only logged
server-side (`logger.exception(...)` in `_save_*_variant`) and silently produces an
empty `{}` for that size/format in the `variants` JSON. `populate_photo_urls`
(`backend/app/api/photos.py` ~268-288) does detect entirely-empty size dicts and
attaches a `processing_errors` list to the API response, but:

- It's not clear the frontend (admin UI in particular) surfaces `processing_errors`
  anywhere visibly — an admin uploading a photo with broken variant generation
  currently has no indication anything went wrong.
- Once the sequential-access bug above is fixed, *legitimate* per-format failures
  (e.g. AVIF due to root cause #2) should still be visible to admins so they're aware
  a photo is serving degraded variants.

Needs a follow-up: surface `processing_errors` (or a similar signal) in the admin
photos UI (e.g. `AdminPhotos.tsx` / `PhotoForm.tsx`) so broken variant generation is
visible and actionable, rather than only discoverable by inspecting slow page loads or
backend logs.

### Open follow-up: frontend variant table + per-size regenerate

Add a "Variants" section to `PhotoForm.tsx` (the admin photo editor) showing a table
of all responsive sizes (micro/thumbnail/small/medium/large/xlarge) x formats
(webp/jpeg/avif), with a checkmark/status indicator per cell (present / missing /
errored).

- Each present cell should show the compressed file size (`size_bytes` from the
  `variants` JSON, e.g. "546 B" / "19.2 KB"), in addition to the checkmark. The
  original file size (`photo.file_size`) should also be shown somewhere in the
  table (e.g. a header row or alongside the size label) so admins can see the
  compression ratio at a glance.
- Missing or errored cells should be visually distinct (e.g. an empty/red state vs a
  green checkmark for present variants).
- On hover over a cell (or its checkmark), it should turn into a "Regenerate" action.
  Clicking it triggers a backend endpoint that re-runs `_generate_responsive_variants`
  (or a single-size/format variant of it) for that photo, writes the result back into
  the `variants` JSON column, and the table should refresh immediately to reflect the
  new state (success or renewed failure).
- This doubles as the backfill mechanism for the existing photos affected by root
  cause #1 (empty thumbnail/small/medium/large/xlarge) — instead of (or in addition
  to) a one-off bulk backfill script, admins can regenerate per-photo from the UI.
- Needs a new backend endpoint, e.g. `POST /api/photos/{id}/regenerate-variants`
  (optionally with a `size`/`format` filter for single-cell regeneration), reusing
  `VipsImageProcessor`/`_generate_responsive_variants` against the photo's stored
  original file.

## Root cause #2 (separate, lower priority): AVIF/HEIF encoding structurally broken

File: `backend/app/core/vips_processor.py`, `_save_avif_variant` (heifsave).

- The `vips-heif.so` loadable module **does** exist and loads successfully
  (`/usr/lib/aarch64-linux-gnu/vips-modules-8.16/vips-heif.so`, links against
  `libheif.so.1`). The earlier `ldd libvips.so` check showing no heif link was a red
  herring — vips loads format modules via dlopen at runtime, not static linking.
- However `heifsave` fails with **"Unsupported compression"** for every compression
  value (av1, hevc, jpeg) because **libheif has zero encoder plugins installed**.
- Debian only packages decoder-side libheif plugins:
  - `libheif-plugin-dav1d` (AV1 decode only)
  - `libheif-plugin-libde265` (HEVC decode only)
- There is **no Debian package** providing `libheif-plugin-aom` (AV1 encode via
  libaom) or `libheif-plugin-x265` (HEVC encode) for trixie/bookworm. Installing
  `libaom-dev`/`libaom3` (already done in `docker/Dockerfile.dev`) doesn't help — there's
  no packaged glue connecting libheif to libaom for encoding.
- `apt-get install libheif1-plugin-aom` / `libheif1-plugin-hevc` (encoder variants) do
  not exist as installable packages.

### Fix direction (not yet implemented, lower priority)

- (a) Build libheif's aom/x265 encoder plugins from source and drop the resulting
  `.so` into libheif's plugin directory (`/usr/lib/aarch64-linux-gnu/libheif/plugins/`
  or similar) — does not require rebuilding libvips itself, just the libheif plugin.
- (b) Switch to a different base image/distro that packages encoder plugins.
- (c) Build libheif from source with `--enable-encoder-aom` / `--enable-encoder-x265`.
- Or: drop AVIF from the variant pipeline entirely and rely on WebP + JPEG fallback.

## Separate issue noticed along the way (not yet fixed)

`frontend/src/hooks/usePhotos.ts`: `useUpdatePhoto`, `useTogglePhotoFeatured`, and
`useDeletePhoto` update/invalidate TanStack Query's `photoKeys` cache on success, but
never call `usePhotoCacheStore.getState().updatePhoto(...)` /
`.removePhoto(...)` (`frontend/src/stores/photoCache.ts`). `PhotographyPage.tsx` reads
from this separate persisted Zustand store via `useOptimizedPhotos`, so admin edits
(e.g. adding a location) don't show up there until the store's 5-minute
`CACHE_MAX_AGE` expires.
