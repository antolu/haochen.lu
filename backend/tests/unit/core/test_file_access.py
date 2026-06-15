from __future__ import annotations

from pathlib import Path

import pytest
from fastapi import HTTPException

from app.api.photos import _negotiate_variant_file_type
from app.core.file_access import FileAccessController
from app.types.access_control import FileType

VARIANT_SIZES = ("micro", "thumbnail", "small", "medium", "large", "xlarge")


@pytest.mark.parametrize("size", VARIANT_SIZES)
def test_negotiate_variant_without_accept_header(size: str) -> None:
    assert _negotiate_variant_file_type(size, None) == FileType(size)


@pytest.mark.parametrize("size", VARIANT_SIZES)
@pytest.mark.parametrize(
    "accept",
    ["image/avif,image/webp", "image/webp,image/jpeg", "image/jpeg", "*/*", None],
)
def test_negotiate_plain_size_ignores_accept_header(
    size: str, accept: str | None
) -> None:
    # A bare size (e.g. "micro") is already a valid FileType, so it's returned
    # as-is regardless of the Accept header - format negotiation only kicks in
    # for variant requests that aren't already a FileType member.
    assert _negotiate_variant_file_type(size, accept) == FileType(size)


@pytest.mark.parametrize("size", VARIANT_SIZES)
def test_negotiate_explicit_format_suffix_passthrough(size: str) -> None:
    assert _negotiate_variant_file_type(f"{size}-webp", None) == FileType(
        f"{size}-webp"
    )


def test_negotiate_unrecognized_variant_raises_value_error() -> None:
    # serve_photo_variant relies on this raising so it can return a 400.
    with pytest.raises(ValueError, match="not-a-real-variant"):
        _negotiate_variant_file_type("not-a-real-variant", None)


@pytest.fixture
def file_access_controller(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> FileAccessController:
    upload_dir = tmp_path / "uploads"
    compressed_dir = tmp_path / "compressed"
    upload_dir.mkdir()
    compressed_dir.mkdir()

    monkeypatch.setattr("app.config.settings.upload_dir", str(upload_dir))
    monkeypatch.setattr("app.config.settings.compressed_dir", str(compressed_dir))

    return FileAccessController()


class _FakePhoto:
    def __init__(self, *, original_path: str, variants: dict) -> None:
        self.original_path = original_path
        self.variants = variants
        self.title = "Test Photo"
        self.filename = "test-photo.jpg"


@pytest.mark.parametrize("size", VARIANT_SIZES)
def test_get_file_path_resolves_nested_multi_format_variant(
    file_access_controller: FileAccessController, size: str
) -> None:
    webp_filename = f"test-photo-{size}.webp"
    (file_access_controller.compressed_dir / webp_filename).write_bytes(b"fake-webp")

    photo = _FakePhoto(
        original_path="test-photo.jpg",
        variants={size: {"webp": {"path": f"/compressed/{webp_filename}"}}},
    )

    resolved = file_access_controller.get_file_path(photo, FileType(size))

    assert resolved == file_access_controller.compressed_dir / webp_filename


def test_get_file_path_resolves_original(
    file_access_controller: FileAccessController,
) -> None:
    (file_access_controller.upload_dir / "test-photo.jpg").write_bytes(b"fake-jpeg")

    photo = _FakePhoto(original_path="test-photo.jpg", variants={})

    resolved = file_access_controller.get_file_path(photo, FileType.ORIGINAL)

    assert resolved == file_access_controller.upload_dir / "test-photo.jpg"


def test_get_file_path_missing_variant_raises_404(
    file_access_controller: FileAccessController,
) -> None:
    photo = _FakePhoto(original_path="test-photo.jpg", variants={})

    with pytest.raises(HTTPException) as exc_info:
        file_access_controller.get_file_path(photo, FileType.MICRO)

    assert exc_info.value.status_code == 404
