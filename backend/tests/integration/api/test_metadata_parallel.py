from __future__ import annotations

import asyncio
import io
import uuid

import pytest
from PIL import Image
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.api.photos import _create_aliases_for_photo
from app.models.camera_alias import CameraAlias
from app.models.lens_alias import LensAlias


@pytest.mark.integration
async def test_parallel_upload_alias_deduplication(
    integration_engine, integration_session: AsyncSession
):
    """Test that multiple parallel uploads with same metadata only create one alias."""

    # Use a unique camera/lens for this test
    camera_make = "ParallelMake"
    camera_model = "ParallelModel"
    lens_name = "ParallelLens 50mm"

    # Prepare dummy image content
    img = Image.new("RGB", (100, 100), color="red")
    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format="JPEG")
    img_byte_arr.getvalue()

    # Let's test the internal function directly for race condition verification
    session_maker = async_sessionmaker(
        integration_engine, class_=AsyncSession, expire_on_commit=False
    )

    class MockPhoto:
        def __init__(self, photo_id, make, model, lens):
            self.id = photo_id
            self.camera_make = make
            self.camera_model = model
            self.lens = lens

    # Simulation of parallel calls to _create_aliases_for_photo using separate sessions and valid UUIDs
    photo1 = MockPhoto(
        photo_id=uuid.uuid4(), make=camera_make, model=camera_model, lens=lens_name
    )
    photo2 = MockPhoto(
        photo_id=uuid.uuid4(), make=camera_make, model=camera_model, lens=lens_name
    )

    async def run_in_new_session(photo):
        async with session_maker() as session:
            await _create_aliases_for_photo(session, photo)

    # Run them in parallel using gather
    await asyncio.gather(run_in_new_session(photo1), run_in_new_session(photo2))

    # Check results using integration_session (which is a separate session)
    stmt_cam = select(CameraAlias).where(
        CameraAlias.original_name == f"{camera_make} {camera_model}"
    )
    result_cam = await integration_session.execute(stmt_cam)
    cam_aliases = result_cam.scalars().all()

    stmt_lens = select(LensAlias).where(LensAlias.original_name == lens_name)
    result_lens = await integration_session.execute(stmt_lens)
    lens_aliases = result_lens.scalars().all()

    assert len(cam_aliases) == 1
    assert len(lens_aliases) == 1
