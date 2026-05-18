from __future__ import annotations

from uuid import UUID

from sqlalchemy import asc, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.file import FileRecord


async def get_file_by_name(db: AsyncSession, original_name: str) -> FileRecord | None:
    result = await db.execute(
        select(FileRecord).where(FileRecord.original_name == original_name)
    )
    return result.scalar_one_or_none()


async def get_file_by_id(db: AsyncSession, file_id: UUID) -> FileRecord | None:
    result = await db.execute(select(FileRecord).where(FileRecord.id == file_id))
    return result.scalar_one_or_none()


async def list_files(
    db: AsyncSession,
    *,
    skip: int = 0,
    limit: int = 50,
    search: str | None = None,
    sort_by: str = "created_at",
    order: str = "desc",
) -> tuple[list[FileRecord], int]:
    query = select(FileRecord)

    if search:
        query = query.where(FileRecord.original_name.ilike(f"%{search}%"))

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar_one()

    sort_col = {
        "name": FileRecord.original_name,
        "created_at": FileRecord.created_at,
        "file_size": FileRecord.file_size,
    }.get(sort_by, FileRecord.created_at)

    order_fn = desc if order == "desc" else asc
    query = query.order_by(order_fn(sort_col)).offset(skip).limit(limit)

    result = await db.execute(query)
    return list(result.scalars().all()), total


async def create_file_record(db: AsyncSession, **kwargs: object) -> FileRecord:
    record = FileRecord(**kwargs)
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return record


async def rename_file_record(
    db: AsyncSession, record: FileRecord, new_name: str
) -> FileRecord:
    record.original_name = new_name
    await db.commit()
    await db.refresh(record)
    return record


async def delete_file_record(db: AsyncSession, record: FileRecord) -> None:
    await db.delete(record)
    await db.commit()
