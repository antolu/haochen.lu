from __future__ import annotations

from typing import TYPE_CHECKING
from unittest.mock import patch

import pytest
import sqlalchemy

from app.config import settings as static_settings
from app.core.runtime_settings import SystemConfigService
from app.models.system_setting import SystemSetting

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker


def test_default_values() -> None:
    service = SystemConfigService()

    assert service.responsive_sizes == dict(static_settings.responsive_sizes)
    assert service.quality_settings == dict(static_settings.quality_settings)
    assert service.avif_quality_base_offset == static_settings.avif_quality_base_offset
    assert service.avif_quality_floor == static_settings.avif_quality_floor
    assert service.avif_effort_default == static_settings.avif_effort_default
    assert service.webp_quality == static_settings.webp_quality

    assert service.rate_limit_calls == 100
    assert service.rate_limit_period == 3600
    assert service.rate_limit_file_calls == 20
    assert service.rate_limit_file_period == 60
    assert service.rate_limit_auth_calls == 60
    assert service.rate_limit_auth_period == 60


def test_apply_updates_fields() -> None:
    service = SystemConfigService()
    original_quality_settings = dict(service.quality_settings)
    original_rate_limit_period = service.rate_limit_period

    service.apply({
        "webp_quality": 77,
        "rate_limit_calls": 250,
        "responsive_sizes": {"small": 400, "large": 1600},
    })

    assert service.webp_quality == 77
    assert service.rate_limit_calls == 250
    assert service.responsive_sizes == {"small": 400, "large": 1600}

    # untouched fields remain the same
    assert service.quality_settings == original_quality_settings
    assert service.rate_limit_period == original_rate_limit_period


def test_apply_empty_dict_noop() -> None:
    service = SystemConfigService()
    before = SystemConfigService()

    service.apply({})
    assert service.responsive_sizes == before.responsive_sizes
    assert service.webp_quality == before.webp_quality
    assert service.rate_limit_calls == before.rate_limit_calls

    service.apply(None)
    assert service.responsive_sizes == before.responsive_sizes
    assert service.webp_quality == before.webp_quality
    assert service.rate_limit_calls == before.rate_limit_calls


def test_rate_limit_enabled_env_lock() -> None:
    service = SystemConfigService()

    with (
        patch.object(
            static_settings.__class__,
            "is_rate_limit_env_set",
            property(lambda self: True),
        ),
        patch.object(static_settings, "rate_limit_enabled", new=True),
    ):
        service._rate_limit_enabled = False
        assert service.rate_limit_enabled is True

        service.rate_limit_enabled = False
        assert service.rate_limit_enabled is True

    with patch.object(
        static_settings.__class__,
        "is_rate_limit_env_set",
        property(lambda self: False),
    ):
        service.rate_limit_enabled = False
        assert service.rate_limit_enabled is False
        assert service._rate_limit_enabled is False

        service.rate_limit_enabled = True
        assert service.rate_limit_enabled is True
        assert service._rate_limit_enabled is True


@pytest.mark.asyncio
async def test_load_from_db_creates_row_when_missing(
    test_session_maker: async_sessionmaker[AsyncSession],
) -> None:
    service = SystemConfigService()

    await service.load_from_db(test_session_maker)

    async with test_session_maker() as session:
        result = await session.execute(
            sqlalchemy.select(SystemSetting).where(SystemSetting.id == 1)
        )
        db_settings = result.scalar_one_or_none()

    assert db_settings is not None
    assert db_settings.responsive_sizes == service.responsive_sizes
    assert db_settings.quality_settings == service.quality_settings
    assert db_settings.avif_quality_base_offset == service.avif_quality_base_offset
    assert db_settings.avif_quality_floor == service.avif_quality_floor
    assert db_settings.avif_effort_default == service.avif_effort_default
    assert db_settings.webp_quality == service.webp_quality
    assert db_settings.rate_limit_enabled == service.rate_limit_enabled
    assert db_settings.rate_limit_calls == service.rate_limit_calls
    assert db_settings.rate_limit_period == service.rate_limit_period
    assert db_settings.rate_limit_file_calls == service.rate_limit_file_calls
    assert db_settings.rate_limit_file_period == service.rate_limit_file_period
    assert db_settings.rate_limit_auth_calls == service.rate_limit_auth_calls
    assert db_settings.rate_limit_auth_period == service.rate_limit_auth_period


@pytest.mark.asyncio
async def test_load_from_db_loads_existing_row(
    test_session_maker: async_sessionmaker[AsyncSession],
) -> None:
    async with test_session_maker() as session:
        db_settings = SystemSetting(
            id=1,
            responsive_sizes={"small": 123, "large": 456},
            quality_settings={"webp": 70, "avif": 60},
            avif_quality_base_offset=-5,
            avif_quality_floor=40,
            avif_effort_default=8,
            webp_quality=99,
            rate_limit_enabled=False,
            rate_limit_calls=999,
            rate_limit_period=1800,
            rate_limit_file_calls=5,
            rate_limit_file_period=30,
            rate_limit_auth_calls=10,
            rate_limit_auth_period=20,
        )
        session.add(db_settings)
        await session.commit()

    service = SystemConfigService()
    await service.load_from_db(test_session_maker)

    assert service.responsive_sizes == {"small": 123, "large": 456}
    assert service.quality_settings == {"webp": 70, "avif": 60}
    assert service.avif_quality_base_offset == -5
    assert service.avif_quality_floor == 40
    assert service.avif_effort_default == 8
    assert service.webp_quality == 99
    assert service.rate_limit_enabled is False
    assert service.rate_limit_calls == 999
    assert service.rate_limit_period == 1800
    assert service.rate_limit_file_calls == 5
    assert service.rate_limit_file_period == 30
    assert service.rate_limit_auth_calls == 10
    assert service.rate_limit_auth_period == 20
