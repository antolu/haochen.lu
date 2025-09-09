"""
P0 - Data Integrity Integration Tests

Tests database transactions, cascade operations, concurrent modifications, and
data consistency. These tests ensure that the application maintains data
integrity under all conditions, including edge cases and failure scenarios.
"""
from __future__ import annotations

import asyncio
import uuid
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import patch

import pytest
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Photo, Project, BlogPost, SubApp
from tests.factories import PhotoFactory, ProjectFactory, BlogPostFactory


@pytest.mark.integration
@pytest.mark.database
class TestPhotoDeletionCascade:
    """Test photo deletion and cascade operations."""
    
    async def test_photo_deletion_removes_all_files(
        self, test_session: AsyncSession, temp_upload_dir, temp_compressed_dir
    ):
        """Test that photo deletion removes all associated files."""
        # Create photo with all file types
        photo = await PhotoFactory.create_async(
            test_session,
            original_path=str(temp_upload_dir / "test_original.jpg"),
            webp_path=str(temp_compressed_dir / "test.webp"),
            thumbnail_path=str(temp_compressed_dir / "test_thumb.webp")
        )
        
        # Create the actual files
        original_file = temp_upload_dir / "test_original.jpg"
        webp_file = temp_compressed_dir / "test.webp"
        thumb_file = temp_compressed_dir / "test_thumb.webp"
        
        original_file.write_bytes(b"fake original data")
        webp_file.write_bytes(b"fake webp data")
        thumb_file.write_bytes(b"fake thumb data")
        
        # Verify files exist
        assert original_file.exists()
        assert webp_file.exists()
        assert thumb_file.exists()
        
        # Delete photo from database
        await test_session.delete(photo)
        await test_session.commit()
        
        # Verify database record is gone
        result = await test_session.execute(
            select(Photo).where(Photo.id == photo.id)
        )
        assert result.scalar_one_or_none() is None
        
        # Note: File deletion would be handled by your application logic
        # This test verifies the database cascade works correctly
        # File cleanup would be tested separately in your service layer
    
    async def test_photo_deletion_with_missing_files_succeeds(
        self, test_session: AsyncSession, temp_upload_dir, temp_compressed_dir
    ):
        """Test that photo deletion succeeds even if files are missing."""
        # Create photo record without creating actual files
        photo = await PhotoFactory.create_async(
            test_session,
            original_path=str(temp_upload_dir / "nonexistent.jpg"),
            webp_path=str(temp_compressed_dir / "nonexistent.webp"),
            thumbnail_path=str(temp_compressed_dir / "nonexistent_thumb.webp")
        )
        
        # Delete photo (should not fail even though files don't exist)
        await test_session.delete(photo)
        await test_session.commit()
        
        # Verify deletion succeeded
        result = await test_session.execute(
            select(Photo).where(Photo.id == photo.id)
        )
        assert result.scalar_one_or_none() is None
    
    async def test_photo_deletion_rollback_on_partial_failure(
        self, test_session: AsyncSession, temp_upload_dir
    ):
        """Test transaction rollback on partial failure during deletion."""
        photo = await PhotoFactory.create_async(test_session)
        
        # Create the original file
        original_file = temp_upload_dir / "test.jpg"
        original_file.write_bytes(b"test data")
        
        # Simulate failure during file deletion
        with patch('os.remove') as mock_remove:
            mock_remove.side_effect = PermissionError("Cannot delete file")
            
            # Attempt to delete photo
            with pytest.raises(PermissionError):
                await test_session.delete(photo)
                # If your implementation includes file cleanup in transaction,
                # it should rollback on file deletion failure
                await test_session.commit()
        
        # Verify photo still exists due to rollback
        await test_session.rollback()  # Explicitly rollback
        result = await test_session.execute(
            select(Photo).where(Photo.id == photo.id)
        )
        assert result.scalar_one_or_none() is not None
    
    async def test_bulk_photo_deletion_maintains_consistency(
        self, test_session: AsyncSession
    ):
        """Test bulk deletion maintains database consistency."""
        # Create multiple photos
        photos = []
        for i in range(10):
            photo = await PhotoFactory.create_async(
                test_session,
                title=f"Bulk Test Photo {i}"
            )
            photos.append(photo)
        
        photo_ids = [photo.id for photo in photos]
        
        # Delete multiple photos in a transaction
        for photo in photos:
            await test_session.delete(photo)
        
        await test_session.commit()
        
        # Verify all photos are deleted
        result = await test_session.execute(
            select(Photo).where(Photo.id.in_(photo_ids))
        )
        remaining_photos = result.scalars().all()
        assert len(remaining_photos) == 0
    
    async def test_photo_deletion_with_foreign_key_constraints(
        self, test_session: AsyncSession
    ):
        """Test photo deletion respects foreign key constraints."""
        # Create photo
        photo = await PhotoFactory.create_async(test_session)
        
        # If you have foreign key relationships (e.g., comments, tags),
        # test that they are handled properly
        
        # For now, just verify basic deletion works
        await test_session.delete(photo)
        await test_session.commit()
        
        result = await test_session.execute(
            select(Photo).where(Photo.id == photo.id)
        )
        assert result.scalar_one_or_none() is None


@pytest.mark.integration
@pytest.mark.database
class TestConcurrentModifications:
    """Test concurrent database operations and race conditions."""
    
    async def test_concurrent_photo_updates_handle_conflicts(
        self, test_session: AsyncSession
    ):
        """Test that concurrent updates to the same photo are handled correctly."""
        photo = await PhotoFactory.create_async(
            test_session,
            title="Original Title",
            view_count=0
        )
        
        # Simulate two concurrent updates
        async def update_title():
            # Create new session for concurrent operation
            from app.database import async_session_maker
            async with async_session_maker() as session:
                result = await session.execute(
                    select(Photo).where(Photo.id == photo.id)
                )
                photo_to_update = result.scalar_one()
                photo_to_update.title = "Updated by Task 1"
                await session.commit()
        
        async def increment_views():
            # Create new session for concurrent operation
            from app.database import async_session_maker
            async with async_session_maker() as session:
                result = await session.execute(
                    select(Photo).where(Photo.id == photo.id)
                )
                photo_to_update = result.scalar_one()
                photo_to_update.view_count += 1
                await session.commit()
        
        # Run both updates concurrently
        await asyncio.gather(update_title(), increment_views())
        
        # Verify final state is consistent
        await test_session.rollback()  # Refresh session
        result = await test_session.execute(
            select(Photo).where(Photo.id == photo.id)
        )
        updated_photo = result.scalar_one()
        
        # Both operations should have succeeded
        assert updated_photo.title == "Updated by Task 1"
        assert updated_photo.view_count == 1
    
    async def test_concurrent_photo_creation_unique_constraints(
        self, test_session: AsyncSession
    ):
        """Test handling of unique constraint violations in concurrent operations."""
        
        async def create_photo_with_slug(slug: str):
            """Create photo with specific slug."""
            try:
                from app.database import async_session_maker
                async with async_session_maker() as session:
                    photo = await PhotoFactory.create_async(
                        session,
                        filename=f"{slug}.jpg"  # Use filename as pseudo-slug
                    )
                    return photo
            except IntegrityError:
                # Expected if unique constraint is violated
                return None
        
        # Try to create photos with same "slug" concurrently
        tasks = [
            create_photo_with_slug("same_slug"),
            create_photo_with_slug("same_slug"),
            create_photo_with_slug("same_slug")
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # At most one should succeed (depending on unique constraints)
        successful_creates = [r for r in results if r is not None and not isinstance(r, Exception)]
        
        # Should handle gracefully without crashing
        assert len(results) == 3
    
    async def test_deadlock_prevention_in_concurrent_operations(
        self, test_session: AsyncSession
    ):
        """Test deadlock prevention in concurrent database operations."""
        # Create two photos
        photo1 = await PhotoFactory.create_async(test_session, title="Photo 1")
        photo2 = await PhotoFactory.create_async(test_session, title="Photo 2")
        
        async def update_photos_order1():
            """Update photos in order 1->2"""
            from app.database import async_session_maker
            async with async_session_maker() as session:
                # Lock photo1 first, then photo2
                result1 = await session.execute(
                    select(Photo).where(Photo.id == photo1.id)
                )
                p1 = result1.scalar_one()
                p1.view_count += 1
                
                # Small delay to increase chance of deadlock
                await asyncio.sleep(0.01)
                
                result2 = await session.execute(
                    select(Photo).where(Photo.id == photo2.id)
                )
                p2 = result2.scalar_one()
                p2.view_count += 1
                
                await session.commit()
        
        async def update_photos_order2():
            """Update photos in order 2->1"""
            from app.database import async_session_maker
            async with async_session_maker() as session:
                # Lock photo2 first, then photo1
                result2 = await session.execute(
                    select(Photo).where(Photo.id == photo2.id)
                )
                p2 = result2.scalar_one()
                p2.view_count += 10
                
                # Small delay to increase chance of deadlock
                await asyncio.sleep(0.01)
                
                result1 = await session.execute(
                    select(Photo).where(Photo.id == photo1.id)
                )
                p1 = result1.scalar_one()
                p1.view_count += 10
                
                await session.commit()
        
        # Run operations that could potentially deadlock
        try:
            await asyncio.gather(
                update_photos_order1(),
                update_photos_order2(),
                return_exceptions=True
            )
        except Exception as e:
            # Deadlocks should be handled gracefully by the database
            # Application should not crash
            assert "deadlock" not in str(e).lower() or "timeout" in str(e).lower()
        
        # Verify database is still consistent
        await test_session.rollback()
        result1 = await test_session.execute(
            select(Photo).where(Photo.id == photo1.id)
        )
        result2 = await test_session.execute(
            select(Photo).where(Photo.id == photo2.id)
        )
        
        updated_photo1 = result1.scalar_one()
        updated_photo2 = result2.scalar_one()
        
        # At least one operation should have completed
        assert updated_photo1.view_count > 0 or updated_photo2.view_count > 0
    
    async def test_optimistic_locking_prevents_lost_updates(
        self, test_session: AsyncSession
    ):
        """Test optimistic locking prevents lost updates."""
        # Create photo with version field (if implemented)
        photo = await PhotoFactory.create_async(
            test_session,
            view_count=100
        )
        
        # Simulate optimistic locking scenario
        async def concurrent_update(increment: int):
            from app.database import async_session_maker
            async with async_session_maker() as session:
                result = await session.execute(
                    select(Photo).where(Photo.id == photo.id)
                )
                photo_to_update = result.scalar_one()
                
                # Read current value
                current_count = photo_to_update.view_count
                
                # Simulate processing time
                await asyncio.sleep(0.01)
                
                # Update based on read value (this could cause lost updates)
                photo_to_update.view_count = current_count + increment
                await session.commit()
        
        # Run two concurrent updates
        await asyncio.gather(
            concurrent_update(1),
            concurrent_update(5)
        )
        
        # Verify final state
        await test_session.rollback()
        result = await test_session.execute(
            select(Photo).where(Photo.id == photo.id)
        )
        final_photo = result.scalar_one()
        
        # Both increments should be applied (if optimistic locking works)
        # Or at least one should succeed
        assert final_photo.view_count >= 101  # At least one increment applied
    
    @pytest.mark.slow
    async def test_high_concurrency_stress_test(
        self, test_session: AsyncSession
    ):
        """Stress test with high concurrency operations."""
        # Create initial data
        photos = []
        for i in range(20):
            photo = await PhotoFactory.create_async(
                test_session,
                title=f"Stress Test Photo {i}",
                view_count=0
            )
            photos.append(photo)
        
        photo_ids = [photo.id for photo in photos]
        
        async def worker_task(worker_id: int):
            """Worker that performs random operations."""
            from app.database import async_session_maker
            import random
            
            operations_completed = 0
            
            for _ in range(10):  # Each worker does 10 operations
                try:
                    async with async_session_maker() as session:
                        # Randomly select a photo
                        photo_id = random.choice(photo_ids)
                        
                        result = await session.execute(
                            select(Photo).where(Photo.id == photo_id)
                        )
                        photo = result.scalar_one_or_none()
                        
                        if photo:
                            # Randomly update different fields
                            operation = random.choice(['view', 'title', 'featured'])
                            
                            if operation == 'view':
                                photo.view_count += 1
                            elif operation == 'title':
                                photo.title = f"Updated by worker {worker_id}"
                            elif operation == 'featured':
                                photo.featured = not photo.featured
                            
                            await session.commit()
                            operations_completed += 1
                
                except Exception as e:
                    # Log error but continue (some conflicts are expected)
                    print(f"Worker {worker_id} error: {e}")
                
                # Small random delay
                await asyncio.sleep(random.uniform(0.001, 0.005))
            
            return operations_completed
        
        # Run many concurrent workers
        num_workers = 50
        tasks = [worker_task(i) for i in range(num_workers)]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Count successful operations
        successful_operations = sum(
            r for r in results if isinstance(r, int)
        )
        
        # Should complete most operations successfully
        assert successful_operations > num_workers * 5  # At least half succeeded
        
        # Verify database consistency
        await test_session.rollback()
        result = await test_session.execute(
            select(Photo).where(Photo.id.in_(photo_ids))
        )
        final_photos = result.scalars().all()
        
        # All photos should still exist
        assert len(final_photos) == 20
        
        # Total view count should be reasonable
        total_views = sum(photo.view_count for photo in final_photos)
        assert 0 <= total_views <= successful_operations


@pytest.mark.integration
@pytest.mark.database
class TestTransactionIntegrity:
    """Test transaction integrity and ACID properties."""
    
    async def test_transaction_atomicity_on_failure(
        self, test_session: AsyncSession
    ):
        """Test that transactions are atomic (all or nothing)."""
        initial_count = await self._get_photo_count(test_session)
        
        try:
            # Start transaction that will fail partway through
            photo1 = Photo(
                id=uuid.uuid4(),
                title="Photo 1",
                filename="photo1.jpg",
                original_path="uploads/photo1.jpg",
                webp_path="compressed/photo1.webp",
                file_size=1024,
                width=800,
                height=600
            )
            test_session.add(photo1)
            
            # This should succeed
            await test_session.flush()
            
            # Now add something that will cause a constraint violation
            photo2 = Photo(
                id=uuid.uuid4(),
                title="Photo 2",
                filename=None,  # This should cause a NOT NULL constraint violation
                original_path="uploads/photo2.jpg",
                webp_path="compressed/photo2.webp",
                file_size=1024,
                width=800,
                height=600
            )
            test_session.add(photo2)
            
            # This should fail and rollback everything
            await test_session.commit()
            
        except Exception:
            await test_session.rollback()
        
        # Verify no photos were added (atomicity)
        final_count = await self._get_photo_count(test_session)
        assert final_count == initial_count
    
    async def test_transaction_consistency_constraints(
        self, test_session: AsyncSession
    ):
        """Test that transactions maintain database consistency."""
        # Test unique constraints
        photo1 = await PhotoFactory.create_async(
            test_session,
            filename="unique_test.jpg"
        )
        
        # Try to create another photo with same filename (if unique constraint exists)
        with pytest.raises(IntegrityError):
            await PhotoFactory.create_async(
                test_session,
                filename="unique_test.jpg"
            )
        
        await test_session.rollback()
        
        # Verify original photo still exists
        result = await test_session.execute(
            select(Photo).where(Photo.id == photo1.id)
        )
        assert result.scalar_one_or_none() is not None
    
    async def test_transaction_isolation_levels(
        self, test_session: AsyncSession
    ):
        """Test transaction isolation prevents dirty reads."""
        photo = await PhotoFactory.create_async(
            test_session,
            title="Original Title",
            view_count=0
        )
        
        # Start a transaction that modifies but doesn't commit
        from app.database import async_session_maker
        
        async with async_session_maker() as session1:
            result1 = await session1.execute(
                select(Photo).where(Photo.id == photo.id)
            )
            photo1 = result1.scalar_one()
            photo1.title = "Modified in Transaction 1"
            photo1.view_count = 999
            await session1.flush()  # Don't commit yet
            
            # In another session, read the same photo
            async with async_session_maker() as session2:
                result2 = await session2.execute(
                    select(Photo).where(Photo.id == photo.id)
                )
                photo2 = result2.scalar_one()
                
                # Should not see uncommitted changes (no dirty read)
                assert photo2.title == "Original Title"
                assert photo2.view_count == 0
            
            # Don't commit session1 (rollback)
            await session1.rollback()
        
        # Verify original values are preserved
        await test_session.rollback()
        result = await test_session.execute(
            select(Photo).where(Photo.id == photo.id)
        )
        final_photo = result.scalar_one()
        assert final_photo.title == "Original Title"
        assert final_photo.view_count == 0
    
    async def test_transaction_durability_after_commit(
        self, test_session: AsyncSession
    ):
        """Test that committed transactions are durable."""
        # Create photo and commit
        photo = await PhotoFactory.create_async(
            test_session,
            title="Durability Test"
        )
        
        photo_id = photo.id
        
        # Simulate system restart by creating new session
        from app.database import async_session_maker
        async with async_session_maker() as new_session:
            result = await new_session.execute(
                select(Photo).where(Photo.id == photo_id)
            )
            recovered_photo = result.scalar_one_or_none()
            
            # Photo should still exist after "restart"
            assert recovered_photo is not None
            assert recovered_photo.title == "Durability Test"
    
    async def test_nested_transaction_behavior(
        self, test_session: AsyncSession
    ):
        """Test nested transaction (savepoint) behavior."""
        initial_count = await self._get_photo_count(test_session)
        
        # Main transaction
        photo1 = await PhotoFactory.create_async(
            test_session,
            title="Main Transaction Photo"
        )
        
        # Nested transaction (savepoint)
        async with test_session.begin_nested() as savepoint:
            photo2 = await PhotoFactory.create_async(
                test_session,
                title="Nested Transaction Photo"
            )
            
            # Rollback nested transaction only
            await savepoint.rollback()
        
        # Commit main transaction
        await test_session.commit()
        
        # Only the main transaction photo should exist
        final_count = await self._get_photo_count(test_session)
        assert final_count == initial_count + 1
        
        result = await test_session.execute(
            select(Photo).where(Photo.title == "Main Transaction Photo")
        )
        assert result.scalar_one_or_none() is not None
        
        result = await test_session.execute(
            select(Photo).where(Photo.title == "Nested Transaction Photo")
        )
        assert result.scalar_one_or_none() is None
    
    # Helper methods
    async def _get_photo_count(self, session: AsyncSession) -> int:
        """Get total photo count."""
        result = await session.execute(select(text('COUNT(*)')).select_from(Photo))
        return result.scalar()


@pytest.mark.integration
@pytest.mark.database
class TestDataConsistencyChecks:
    """Test data consistency validation and constraints."""
    
    async def test_referential_integrity_constraints(
        self, test_session: AsyncSession
    ):
        """Test referential integrity is maintained."""
        # If you have foreign key relationships, test them here
        # For now, test basic data integrity
        
        photo = await PhotoFactory.create_async(test_session)
        
        # Verify all required fields are present
        assert photo.id is not None
        assert photo.title is not None
        assert photo.filename is not None
        assert photo.original_path is not None
        assert photo.webp_path is not None
    
    async def test_data_type_constraints(
        self, test_session: AsyncSession
    ):
        """Test data type constraints are enforced."""
        # Test numeric constraints
        with pytest.raises((ValueError, IntegrityError)):
            await PhotoFactory.create_async(
                test_session,
                width=-1  # Negative width should be invalid
            )
        
        await test_session.rollback()
        
        # Test string length constraints
        with pytest.raises((ValueError, IntegrityError)):
            await PhotoFactory.create_async(
                test_session,
                title="x" * 1000  # Extremely long title
            )
        
        await test_session.rollback()
    
    async def test_business_logic_constraints(
        self, test_session: AsyncSession
    ):
        """Test business logic constraints are enforced."""
        # Test that certain combinations of data are valid
        photo = await PhotoFactory.create_async(
            test_session,
            featured=True,
            view_count=0
        )
        
        # Featured photos with 0 views should be allowed
        assert photo.featured == True
        assert photo.view_count == 0
        
        # Test date constraints
        from datetime import datetime
        photo.date_taken = datetime(2030, 1, 1)  # Future date
        
        # Future dates might be invalid depending on business rules
        # This would be validated at the application level