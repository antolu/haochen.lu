"""
P2 - Business Logic Tests for Portfolio Service

Tests business logic for portfolio management including photo organization,
gallery management, and portfolio-specific features.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta
from typing import List, Dict, Any
from unittest.mock import AsyncMock, Mock, patch

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Photo, Project, User
from app.services.portfolio_service import PortfolioService
from app.core.exceptions import BusinessLogicError, ValidationError
from tests.factories import PhotoFactory, ProjectFactory, UserFactory


class TestPortfolioOrganization:
    """Test portfolio organization and categorization logic."""
    
    @pytest.fixture
    def portfolio_service(self):
        """Create PortfolioService instance."""
        return PortfolioService()
    
    async def test_organize_photos_by_category(
        self, portfolio_service: PortfolioService, test_session: AsyncSession
    ):
        """Test organizing photos by category."""
        # Create photos with different categories
        landscape_photos = await PhotoFactory.create_batch_async(
            test_session, 5, category="landscape"
        )
        portrait_photos = await PhotoFactory.create_batch_async(
            test_session, 3, category="portrait"
        )
        street_photos = await PhotoFactory.create_batch_async(
            test_session, 2, category="street"
        )
        
        organized = await portfolio_service.organize_photos_by_category(test_session)
        
        assert len(organized) == 3
        assert len(organized["landscape"]) == 5
        assert len(organized["portrait"]) == 3
        assert len(organized["street"]) == 2
        
        # Verify photos are correctly categorized
        for photo in organized["landscape"]:
            assert photo.category == "landscape"
    
    async def test_create_portfolio_gallery(
        self, portfolio_service: PortfolioService, test_session: AsyncSession
    ):
        """Test creating a curated portfolio gallery."""
        # Create photos with different attributes
        photos = await PhotoFactory.create_batch_async(test_session, 10)
        
        # Select best photos for gallery (mock selection logic)
        selected_photo_ids = [photos[i].id for i in [0, 2, 4, 7, 9]]
        
        gallery = await portfolio_service.create_gallery(
            test_session,
            name="Best of 2023",
            description="Curated selection of best photos from 2023",
            photo_ids=selected_photo_ids
        )
        
        assert gallery["name"] == "Best of 2023"
        assert gallery["description"] == "Curated selection of best photos from 2023"
        assert len(gallery["photos"]) == 5
        
        # Verify correct photos are included
        gallery_photo_ids = {photo["id"] for photo in gallery["photos"]}
        expected_ids = {str(photo_id) for photo_id in selected_photo_ids}
        assert gallery_photo_ids == expected_ids
    
    async def test_generate_photo_recommendations(
        self, portfolio_service: PortfolioService, test_session: AsyncSession
    ):
        """Test generating photo recommendations based on portfolio."""
        # Create photos with tags and categories
        nature_photos = await PhotoFactory.create_batch_async(
            test_session, 4, category="landscape", tags=["nature", "outdoor"]
        )
        city_photos = await PhotoFactory.create_batch_async(
            test_session, 3, category="street", tags=["urban", "city"]
        )
        
        # Test recommendations based on popular tags
        recommendations = await portfolio_service.get_photo_recommendations(
            test_session, limit=6
        )
        
        assert len(recommendations) <= 6
        assert all("id" in photo for photo in recommendations)
        assert all("title" in photo for photo in recommendations)
        assert all("score" in photo for photo in recommendations)  # Recommendation score
        
        # Recommendations should be sorted by score (highest first)
        scores = [photo["score"] for photo in recommendations]
        assert scores == sorted(scores, reverse=True)
    
    async def test_calculate_portfolio_statistics(
        self, portfolio_service: PortfolioService, test_session: AsyncSession
    ):
        """Test calculating portfolio statistics."""
        # Create diverse portfolio data
        await PhotoFactory.create_batch_async(
            test_session, 8, category="landscape", is_public=True
        )
        await PhotoFactory.create_batch_async(
            test_session, 5, category="portrait", is_public=True
        )
        await PhotoFactory.create_batch_async(
            test_session, 2, category="street", is_public=False
        )
        
        await ProjectFactory.create_batch_async(
            test_session, 3, status="completed"
        )
        await ProjectFactory.create_batch_async(
            test_session, 2, status="in_progress"
        )
        
        stats = await portfolio_service.calculate_portfolio_statistics(test_session)
        
        # Basic counts
        assert stats["total_photos"] == 15
        assert stats["public_photos"] == 13
        assert stats["private_photos"] == 2
        assert stats["total_projects"] == 5
        
        # Category breakdown
        assert stats["photos_by_category"]["landscape"] == 8
        assert stats["photos_by_category"]["portrait"] == 5
        assert stats["photos_by_category"]["street"] == 2
        
        # Project status breakdown
        assert stats["projects_by_status"]["completed"] == 3
        assert stats["projects_by_status"]["in_progress"] == 2
    
    async def test_validate_portfolio_completeness(
        self, portfolio_service: PortfolioService, test_session: AsyncSession
    ):
        """Test portfolio completeness validation."""
        # Create minimal portfolio
        await PhotoFactory.create_async(test_session, category="landscape")
        await ProjectFactory.create_async(test_session, status="completed")
        
        validation = await portfolio_service.validate_portfolio_completeness(test_session)
        
        assert "is_complete" in validation
        assert "missing_elements" in validation
        assert "recommendations" in validation
        
        # With minimal content, portfolio should not be complete
        assert not validation["is_complete"]
        assert len(validation["missing_elements"]) > 0
        assert len(validation["recommendations"]) > 0


class TestPhotoWorkflow:
    """Test photo workflow and lifecycle management."""
    
    @pytest.fixture
    def portfolio_service(self):
        return PortfolioService()
    
    async def test_photo_approval_workflow(
        self, portfolio_service: PortfolioService, test_session: AsyncSession
    ):
        """Test photo approval workflow."""
        # Create photo in draft status
        photo = await PhotoFactory.create_async(
            test_session, is_public=False, status="draft"
        )
        
        # Approve photo
        approved_photo = await portfolio_service.approve_photo(
            test_session, photo.id, approved_by="admin"
        )
        
        assert approved_photo["status"] == "approved"
        assert approved_photo["is_public"] is True
        assert approved_photo["approved_by"] == "admin"
        assert "approved_at" in approved_photo
    
    async def test_photo_rejection_workflow(
        self, portfolio_service: PortfolioService, test_session: AsyncSession
    ):
        """Test photo rejection workflow."""
        photo = await PhotoFactory.create_async(test_session, status="pending")
        
        rejected_photo = await portfolio_service.reject_photo(
            test_session, 
            photo.id, 
            reason="Quality does not meet standards",
            rejected_by="admin"
        )
        
        assert rejected_photo["status"] == "rejected"
        assert rejected_photo["is_public"] is False
        assert rejected_photo["rejection_reason"] == "Quality does not meet standards"
        assert rejected_photo["rejected_by"] == "admin"
    
    async def test_photo_archival_workflow(
        self, portfolio_service: PortfolioService, test_session: AsyncSession
    ):
        """Test photo archival for old or outdated photos."""
        # Create old photos
        old_date = datetime.utcnow() - timedelta(days=365 * 2)  # 2 years old
        old_photos = await PhotoFactory.create_batch_async(
            test_session, 5, created_at=old_date, is_public=True
        )
        
        # Archive old photos
        archived_count = await portfolio_service.archive_old_photos(
            test_session, older_than_days=365
        )
        
        assert archived_count == 5
        
        # Verify photos are archived
        for photo in old_photos:
            await test_session.refresh(photo)
            assert photo.status == "archived"
            assert photo.is_public is False
    
    async def test_photo_batch_operations(
        self, portfolio_service: PortfolioService, test_session: AsyncSession
    ):
        """Test batch operations on photos."""
        photos = await PhotoFactory.create_batch_async(test_session, 8)
        photo_ids = [photo.id for photo in photos[:5]]  # First 5 photos
        
        # Batch update category
        updated_photos = await portfolio_service.batch_update_photos(
            test_session,
            photo_ids=photo_ids,
            updates={"category": "portfolio", "is_featured": True}
        )
        
        assert len(updated_photos) == 5
        for photo in updated_photos:
            assert photo["category"] == "portfolio"
            assert photo["is_featured"] is True
    
    async def test_duplicate_photo_detection(
        self, portfolio_service: PortfolioService, test_session: AsyncSession
    ):
        """Test detection of duplicate photos."""
        # Create photos with same title and similar metadata
        await PhotoFactory.create_async(
            test_session, 
            title="Sunset at Beach",
            file_hash="abc123def456",
            width=1920,
            height=1080
        )
        
        duplicate_photo = await PhotoFactory.create_async(
            test_session,
            title="Sunset at Beach",
            file_hash="abc123def456",  # Same hash
            width=1920,
            height=1080
        )
        
        duplicates = await portfolio_service.find_duplicate_photos(test_session)
        
        assert len(duplicates) >= 1
        assert any(
            dup["hash"] == "abc123def456" and len(dup["photos"]) == 2
            for dup in duplicates
        )


class TestProjectManagement:
    """Test project management business logic."""
    
    @pytest.fixture  
    def portfolio_service(self):
        return PortfolioService()
    
    async def test_project_status_transitions(
        self, portfolio_service: PortfolioService, test_session: AsyncSession
    ):
        """Test valid project status transitions."""
        project = await ProjectFactory.create_async(
            test_session, status="planning"
        )
        
        # Valid transitions
        valid_transitions = [
            ("planning", "in_progress"),
            ("in_progress", "completed"),
            ("in_progress", "on_hold"),
            ("on_hold", "in_progress"),
            ("completed", "archived")
        ]
        
        for from_status, to_status in valid_transitions:
            # Reset project status
            await portfolio_service.update_project_status(
                test_session, project.id, from_status
            )
            
            # Test transition
            updated_project = await portfolio_service.update_project_status(
                test_session, project.id, to_status
            )
            
            assert updated_project["status"] == to_status
            assert "status_changed_at" in updated_project
    
    async def test_invalid_project_status_transitions(
        self, portfolio_service: PortfolioService, test_session: AsyncSession
    ):
        """Test invalid project status transitions are rejected."""
        project = await ProjectFactory.create_async(
            test_session, status="completed"
        )
        
        # Invalid transitions
        with pytest.raises(BusinessLogicError):
            await portfolio_service.update_project_status(
                test_session, project.id, "planning"  # Can't go back to planning
            )
    
    async def test_project_completion_requirements(
        self, portfolio_service: PortfolioService, test_session: AsyncSession
    ):
        """Test project completion requirements validation."""
        # Create project missing required fields
        incomplete_project = await ProjectFactory.create_async(
            test_session,
            status="in_progress",
            demo_url=None,  # Missing demo URL
            github_url=None  # Missing GitHub URL
        )
        
        # Attempt to mark as completed
        with pytest.raises(ValidationError):
            await portfolio_service.complete_project(
                test_session, incomplete_project.id
            )
        
        # Add required fields and try again
        await portfolio_service.update_project(
            test_session,
            incomplete_project.id,
            {
                "demo_url": "https://demo.example.com",
                "github_url": "https://github.com/user/project"
            }
        )
        
        completed_project = await portfolio_service.complete_project(
            test_session, incomplete_project.id
        )
        
        assert completed_project["status"] == "completed"
        assert "completed_at" in completed_project
    
    async def test_featured_projects_selection(
        self, portfolio_service: PortfolioService, test_session: AsyncSession
    ):
        """Test featured projects selection logic."""
        # Create projects with different qualities
        high_quality_projects = await ProjectFactory.create_batch_async(
            test_session, 3,
            status="completed",
            technologies=["Python", "React", "PostgreSQL"],
            demo_url="https://demo.com",
            github_url="https://github.com/user/project"
        )
        
        low_quality_projects = await ProjectFactory.create_batch_async(
            test_session, 2,
            status="in_progress",
            technologies=["HTML"],
            demo_url=None
        )
        
        # Select featured projects
        featured_projects = await portfolio_service.select_featured_projects(
            test_session, max_featured=2
        )
        
        assert len(featured_projects) <= 2
        
        # Featured projects should be high quality (completed with demo URLs)
        for project in featured_projects:
            assert project["status"] == "completed"
            assert project["demo_url"] is not None
            assert len(project["technologies"]) > 1
    
    async def test_project_technology_recommendations(
        self, portfolio_service: PortfolioService, test_session: AsyncSession
    ):
        """Test technology recommendations for projects."""
        # Create projects with various technology stacks
        await ProjectFactory.create_batch_async(
            test_session, 3, technologies=["Python", "FastAPI", "PostgreSQL"]
        )
        await ProjectFactory.create_batch_async(
            test_session, 2, technologies=["JavaScript", "React", "Node.js"]
        )
        await ProjectFactory.create_batch_async(
            test_session, 1, technologies=["Python", "Django", "MySQL"]
        )
        
        recommendations = await portfolio_service.get_technology_recommendations(
            test_session
        )
        
        assert len(recommendations) > 0
        
        # Python should be highly recommended (used in 4/6 projects)
        python_rec = next(
            (rec for rec in recommendations if rec["technology"] == "Python"), 
            None
        )
        assert python_rec is not None
        assert python_rec["usage_count"] == 4
        assert python_rec["recommendation_score"] > 0.5


class TestPortfolioSEO:
    """Test SEO-related business logic."""
    
    @pytest.fixture
    def portfolio_service(self):
        return PortfolioService()
    
    async def test_generate_photo_seo_metadata(
        self, portfolio_service: PortfolioService, test_session: AsyncSession
    ):
        """Test generation of SEO metadata for photos."""
        photo = await PhotoFactory.create_async(
            test_session,
            title="Beautiful Mountain Landscape at Sunset",
            description="A stunning view of snow-capped mountains during golden hour",
            category="landscape",
            tags=["mountain", "sunset", "landscape", "nature"]
        )
        
        seo_metadata = await portfolio_service.generate_photo_seo_metadata(photo)
        
        assert "title" in seo_metadata
        assert "description" in seo_metadata  
        assert "keywords" in seo_metadata
        assert "alt_text" in seo_metadata
        assert "og_title" in seo_metadata
        assert "og_description" in seo_metadata
        
        # SEO title should be optimized
        assert len(seo_metadata["title"]) <= 60  # SEO best practice
        assert "Mountain Landscape" in seo_metadata["title"]
        
        # Description should be optimized
        assert 150 <= len(seo_metadata["description"]) <= 160  # SEO best practice
        
        # Keywords should include tags
        keywords = seo_metadata["keywords"].lower()
        assert "mountain" in keywords
        assert "sunset" in keywords
        assert "landscape" in keywords
    
    async def test_generate_portfolio_sitemap_data(
        self, portfolio_service: PortfolioService, test_session: AsyncSession
    ):
        """Test generation of sitemap data for portfolio."""
        # Create public photos and projects
        public_photos = await PhotoFactory.create_batch_async(
            test_session, 5, is_public=True
        )
        projects = await ProjectFactory.create_batch_async(
            test_session, 3, status="completed"
        )
        
        sitemap_data = await portfolio_service.generate_sitemap_data(test_session)
        
        assert "photos" in sitemap_data
        assert "projects" in sitemap_data
        assert "galleries" in sitemap_data
        
        # Should include all public photos
        assert len(sitemap_data["photos"]) == 5
        
        # Should include all completed projects
        assert len(sitemap_data["projects"]) == 3
        
        # Each entry should have required sitemap fields
        for photo in sitemap_data["photos"]:
            assert "url" in photo
            assert "last_modified" in photo
            assert "priority" in photo
    
    async def test_generate_portfolio_structured_data(
        self, portfolio_service: PortfolioService, test_session: AsyncSession
    ):
        """Test generation of structured data for portfolio."""
        # Create portfolio owner
        owner = await UserFactory.create_async(
            test_session,
            username="john_doe",
            email="john@example.com",
            full_name="John Doe"
        )
        
        # Create portfolio content
        await PhotoFactory.create_batch_async(test_session, 10, is_public=True)
        await ProjectFactory.create_batch_async(test_session, 5, status="completed")
        
        structured_data = await portfolio_service.generate_structured_data(
            test_session, owner_id=owner.id
        )
        
        assert structured_data["@context"] == "https://schema.org"
        assert structured_data["@type"] == "Person"
        assert structured_data["name"] == "John Doe"
        assert structured_data["email"] == "john@example.com"
        
        # Should include portfolio work
        assert "hasCreativeWork" in structured_data
        creative_works = structured_data["hasCreativeWork"]
        
        # Should have entries for photos and projects
        assert len(creative_works) > 0
        
        # Each work should have required schema.org fields
        for work in creative_works[:3]:  # Check first 3
            assert "@type" in work
            assert "name" in work
            assert "dateCreated" in work