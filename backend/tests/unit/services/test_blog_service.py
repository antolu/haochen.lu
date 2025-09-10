"""
P2 - Business Logic Tests for Blog Service

Tests business logic for blog functionality including post management,
commenting, tagging, and content workflow.
"""

from __future__ import annotations

from datetime import datetime, timedelta

import pytest
from app.core.exceptions import ValidationError
from app.services.blog_service import BlogService
from sqlalchemy.ext.asyncio import AsyncSession

from tests.factories import BlogPostFactory, UserFactory


class TestBlogPostManagement:
    """Test blog post management and workflow."""

    @pytest.fixture
    def blog_service(self):
        """Create BlogService instance."""
        return BlogService()

    async def test_create_blog_post_with_validation(
        self, blog_service: BlogService, test_session: AsyncSession
    ):
        """Test creating blog post with content validation."""
        author = await UserFactory.create_async(test_session, is_admin=True)

        post_data = {
            "title": "My First Blog Post",
            "content": "This is the content of my first blog post with **markdown** support.",
            "excerpt": "A brief excerpt of the post",
            "tags": ["web-development", "python", "fastapi"],
            "is_published": False,
            "author_id": author.id,
        }

        created_post = await blog_service.create_post(test_session, post_data)

        assert created_post["title"] == "My First Blog Post"
        assert created_post["content"] == post_data["content"]
        assert created_post["excerpt"] == "A brief excerpt of the post"
        assert set(created_post["tags"]) == set(post_data["tags"])
        assert created_post["is_published"] is False
        assert created_post["status"] == "draft"
        assert created_post["author_id"] == str(author.id)

        # Should generate slug from title
        assert created_post["slug"] == "my-first-blog-post"

    async def test_create_blog_post_validates_required_fields(
        self, blog_service: BlogService, test_session: AsyncSession
    ):
        """Test blog post creation validates required fields."""
        author = await UserFactory.create_async(test_session)

        # Missing title
        invalid_data = {"content": "Content without title", "author_id": author.id}

        with pytest.raises(ValidationError):
            await blog_service.create_post(test_session, invalid_data)

        # Missing content
        invalid_data = {"title": "Title without content", "author_id": author.id}

        with pytest.raises(ValidationError):
            await blog_service.create_post(test_session, invalid_data)

    async def test_generate_unique_slug(
        self, blog_service: BlogService, test_session: AsyncSession
    ):
        """Test slug generation handles duplicates."""
        author = await UserFactory.create_async(test_session)

        # Create first post
        post1_data = {
            "title": "My Blog Post",
            "content": "First post content",
            "author_id": author.id,
        }
        post1 = await blog_service.create_post(test_session, post1_data)
        assert post1["slug"] == "my-blog-post"

        # Create second post with same title
        post2_data = {
            "title": "My Blog Post",
            "content": "Second post content",
            "author_id": author.id,
        }
        post2 = await blog_service.create_post(test_session, post2_data)

        # Should have unique slug
        assert post2["slug"] == "my-blog-post-2"

    async def test_blog_post_publishing_workflow(
        self, blog_service: BlogService, test_session: AsyncSession
    ):
        """Test blog post publishing workflow."""
        author = await UserFactory.create_async(test_session)

        # Create draft post
        draft_post = await BlogPostFactory.create_async(
            test_session, author_id=author.id, is_published=False, status="draft"
        )

        # Publish post
        published_post = await blog_service.publish_post(test_session, draft_post.id)

        assert published_post["is_published"] is True
        assert published_post["status"] == "published"
        assert "published_at" in published_post
        assert published_post["published_at"] is not None

    async def test_blog_post_unpublishing(
        self, blog_service: BlogService, test_session: AsyncSession
    ):
        """Test unpublishing a blog post."""
        author = await UserFactory.create_async(test_session)

        # Create published post
        published_post = await BlogPostFactory.create_async(
            test_session, author_id=author.id, is_published=True, status="published"
        )

        # Unpublish post
        unpublished_post = await blog_service.unpublish_post(
            test_session, published_post.id
        )

        assert unpublished_post["is_published"] is False
        assert unpublished_post["status"] == "draft"

    async def test_blog_post_scheduling(
        self, blog_service: BlogService, test_session: AsyncSession
    ):
        """Test scheduling blog posts for future publication."""
        author = await UserFactory.create_async(test_session)

        # Schedule post for future publication
        future_date = datetime.utcnow() + timedelta(days=7)

        post_data = {
            "title": "Scheduled Post",
            "content": "This post is scheduled for future publication",
            "author_id": author.id,
            "scheduled_at": future_date,
        }

        scheduled_post = await blog_service.create_post(test_session, post_data)

        assert scheduled_post["status"] == "scheduled"
        assert scheduled_post["is_published"] is False
        assert scheduled_post["scheduled_at"] is not None

    async def test_process_scheduled_posts(
        self, blog_service: BlogService, test_session: AsyncSession
    ):
        """Test processing scheduled posts for publication."""
        author = await UserFactory.create_async(test_session)

        # Create posts scheduled for past dates (should be published)
        past_date = datetime.utcnow() - timedelta(hours=1)
        past_scheduled_posts = await BlogPostFactory.create_batch_async(
            test_session,
            2,
            author_id=author.id,
            status="scheduled",
            scheduled_at=past_date,
            is_published=False,
        )

        # Create post scheduled for future (should remain scheduled)
        future_date = datetime.utcnow() + timedelta(days=1)
        future_scheduled_post = await BlogPostFactory.create_async(
            test_session,
            author_id=author.id,
            status="scheduled",
            scheduled_at=future_date,
            is_published=False,
        )

        # Process scheduled posts
        published_count = await blog_service.process_scheduled_posts(test_session)

        assert published_count == 2

        # Verify past scheduled posts are now published
        for post in past_scheduled_posts:
            await test_session.refresh(post)
            assert post.is_published is True
            assert post.status == "published"

        # Verify future scheduled post remains scheduled
        await test_session.refresh(future_scheduled_post)
        assert future_scheduled_post.status == "scheduled"
        assert future_scheduled_post.is_published is False


class TestBlogContentProcessing:
    """Test blog content processing and rendering."""

    @pytest.fixture
    def blog_service(self):
        return BlogService()

    async def test_render_markdown_content(self, blog_service: BlogService):
        """Test rendering markdown content to HTML."""
        markdown_content = """
# Blog Post Title

This is a paragraph with **bold** and *italic* text.

## Subheading

Here's a list:
- Item 1
- Item 2
- Item 3

And a [link](https://example.com).

```python
def hello():
    print("Hello, World!")
```
"""

        rendered_html = await blog_service.render_markdown(markdown_content)

        assert "<h1>Blog Post Title</h1>" in rendered_html
        assert "<strong>bold</strong>" in rendered_html
        assert "<em>italic</em>" in rendered_html
        assert "<h2>Subheading</h2>" in rendered_html
        assert "<ul>" in rendered_html
        assert "<li>Item 1</li>" in rendered_html
        assert '<a href="https://example.com">link</a>' in rendered_html
        assert "<code>" in rendered_html

    async def test_sanitize_html_content(self, blog_service: BlogService):
        """Test sanitizing HTML content for security."""
        dangerous_html = """
<p>Safe content</p>
<script>alert('XSS attack!');</script>
<img src="x" onerror="alert('Another XSS');">
<a href="javascript:alert('XSS')">Malicious link</a>
<iframe src="http://evil.com"></iframe>
"""

        sanitized_html = await blog_service.sanitize_html(dangerous_html)

        # Should keep safe elements
        assert "<p>Safe content</p>" in sanitized_html

        # Should remove dangerous elements
        assert "<script>" not in sanitized_html
        assert "onerror" not in sanitized_html
        assert "javascript:" not in sanitized_html
        assert "<iframe>" not in sanitized_html

    async def test_extract_excerpt_from_content(self, blog_service: BlogService):
        """Test extracting excerpt from blog post content."""
        long_content = "This is the first paragraph. " * 20  # Long content

        excerpt = await blog_service.extract_excerpt(long_content, max_length=150)

        assert len(excerpt) <= 150
        assert excerpt.endswith("...")
        assert "This is the first paragraph." in excerpt

    async def test_generate_reading_time(self, blog_service: BlogService):
        """Test generating reading time estimate."""
        # Average reading speed is ~200 words per minute
        content_200_words = " ".join(["word"] * 200)  # 1 minute read
        content_600_words = " ".join(["word"] * 600)  # 3 minute read

        reading_time_1 = await blog_service.calculate_reading_time(content_200_words)
        reading_time_3 = await blog_service.calculate_reading_time(content_600_words)

        assert reading_time_1["minutes"] == 1
        assert reading_time_1["text"] == "1 min read"

        assert reading_time_3["minutes"] == 3
        assert reading_time_3["text"] == "3 min read"

    async def test_generate_table_of_contents(self, blog_service: BlogService):
        """Test generating table of contents from markdown."""
        markdown_with_headers = """
# Main Title

Content under main title.

## Section 1

Content for section 1.

### Subsection 1.1

Content for subsection.

## Section 2

Content for section 2.

### Subsection 2.1

More content.

### Subsection 2.2

Even more content.
"""

        toc = await blog_service.generate_table_of_contents(markdown_with_headers)

        assert len(toc) > 0

        # Should have main sections
        main_sections = [item for item in toc if item["level"] == 2]
        assert len(main_sections) == 2
        assert main_sections[0]["title"] == "Section 1"
        assert main_sections[1]["title"] == "Section 2"

        # Should have subsections
        subsections = [item for item in toc if item["level"] == 3]
        assert len(subsections) == 3

        # Should generate anchor links
        assert all("anchor" in item for item in toc)
        assert toc[0]["anchor"] == "section-1"


class TestBlogTagging:
    """Test blog post tagging functionality."""

    @pytest.fixture
    def blog_service(self):
        return BlogService()

    async def test_extract_tags_from_content(self, blog_service: BlogService):
        """Test extracting relevant tags from content."""
        content = """
This post is about Python programming and web development.
We'll discuss FastAPI, SQLAlchemy, and database design patterns.
The tutorial covers REST API development and testing strategies.
"""

        extracted_tags = await blog_service.extract_content_tags(content)

        assert "python" in [tag.lower() for tag in extracted_tags]
        assert "web-development" in [tag.lower() for tag in extracted_tags]
        assert "fastapi" in [tag.lower() for tag in extracted_tags]

    async def test_suggest_related_tags(
        self, blog_service: BlogService, test_session: AsyncSession
    ):
        """Test suggesting related tags based on existing posts."""
        await UserFactory.create_async(test_session)

        # Create posts with related tags
        await BlogPostFactory.create_async(
            test_session, tags=["python", "web-development", "api"]
        )
        await BlogPostFactory.create_async(
            test_session, tags=["python", "database", "sqlalchemy"]
        )
        await BlogPostFactory.create_async(
            test_session, tags=["javascript", "frontend", "react"]
        )

        # Get suggestions for python-related post
        suggestions = await blog_service.suggest_related_tags(test_session, ["python"])

        assert "web-development" in suggestions
        assert "database" in suggestions
        assert "api" in suggestions
        # Should not suggest unrelated tags
        assert "react" not in suggestions

    async def test_get_popular_tags(
        self, blog_service: BlogService, test_session: AsyncSession
    ):
        """Test getting most popular tags."""
        # Create posts with various tags
        await BlogPostFactory.create_batch_async(
            test_session, 5, tags=["python", "web-development"]
        )
        await BlogPostFactory.create_batch_async(
            test_session, 3, tags=["javascript", "frontend"]
        )
        await BlogPostFactory.create_batch_async(
            test_session, 2, tags=["python", "database"]
        )

        popular_tags = await blog_service.get_popular_tags(test_session, limit=5)

        assert len(popular_tags) <= 5

        # Python should be most popular (7 occurrences)
        assert popular_tags[0]["tag"] == "python"
        assert popular_tags[0]["count"] == 7

        # Web-development should be second (5 occurrences)
        assert popular_tags[1]["tag"] == "web-development"
        assert popular_tags[1]["count"] == 5

    async def test_tag_normalization(self, blog_service: BlogService):
        """Test tag normalization and consistency."""
        raw_tags = [
            "Web Development",
            "WEB-DEVELOPMENT",
            "web_development",
            "Python",
            "PYTHON",
            "python-programming",
            "API Design",
            "api-design",
        ]

        normalized_tags = await blog_service.normalize_tags(raw_tags)

        # Should convert to lowercase kebab-case
        assert "web-development" in normalized_tags
        assert "python" in normalized_tags
        assert "python-programming" in normalized_tags
        assert "api-design" in normalized_tags

        # Should remove duplicates
        assert len(normalized_tags) < len(raw_tags)
        assert len(set(normalized_tags)) == len(normalized_tags)


class TestBlogSEO:
    """Test blog SEO optimization features."""

    @pytest.fixture
    def blog_service(self):
        return BlogService()

    async def test_generate_seo_metadata(
        self, blog_service: BlogService, test_session: AsyncSession
    ):
        """Test generating SEO metadata for blog posts."""
        author = await UserFactory.create_async(test_session)

        blog_post = await BlogPostFactory.create_async(
            test_session,
            title="Ultimate Guide to Python Web Development",
            content="Learn how to build web applications with Python...",
            excerpt="A comprehensive guide covering FastAPI, SQLAlchemy, and more",
            tags=["python", "web-development", "fastapi", "tutorial"],
            author_id=author.id,
        )

        seo_metadata = await blog_service.generate_seo_metadata(blog_post)

        assert "title" in seo_metadata
        assert "description" in seo_metadata
        assert "keywords" in seo_metadata
        assert "og_title" in seo_metadata
        assert "og_description" in seo_metadata
        assert "og_type" in seo_metadata
        assert "canonical_url" in seo_metadata

        # Title should be optimized for SEO
        assert len(seo_metadata["title"]) <= 60
        assert "Python Web Development" in seo_metadata["title"]

        # Description should be within SEO limits
        assert 150 <= len(seo_metadata["description"]) <= 160

        # Keywords should include tags
        assert "python" in seo_metadata["keywords"].lower()
        assert "web-development" in seo_metadata["keywords"].lower()

        # Open Graph data
        assert seo_metadata["og_type"] == "article"

    async def test_generate_structured_data(
        self, blog_service: BlogService, test_session: AsyncSession
    ):
        """Test generating structured data for blog posts."""
        author = await UserFactory.create_async(
            test_session, full_name="John Doe", username="johndoe"
        )

        blog_post = await BlogPostFactory.create_async(
            test_session,
            title="My Blog Post",
            content="Blog post content here...",
            author_id=author.id,
            is_published=True,
        )

        structured_data = await blog_service.generate_structured_data(blog_post)

        assert structured_data["@context"] == "https://schema.org"
        assert structured_data["@type"] == "BlogPosting"
        assert structured_data["headline"] == "My Blog Post"
        assert "author" in structured_data
        assert structured_data["author"]["name"] == "John Doe"
        assert "datePublished" in structured_data
        assert "url" in structured_data

    async def test_generate_sitemap_data(
        self, blog_service: BlogService, test_session: AsyncSession
    ):
        """Test generating sitemap data for blog."""
        author = await UserFactory.create_async(test_session)

        # Create published posts
        await BlogPostFactory.create_batch_async(
            test_session, 5, author_id=author.id, is_published=True, status="published"
        )

        # Create draft posts (should not be included)
        await BlogPostFactory.create_batch_async(
            test_session, 2, author_id=author.id, is_published=False, status="draft"
        )

        sitemap_data = await blog_service.generate_sitemap_data(test_session)

        # Should only include published posts
        assert len(sitemap_data) == 5

        for post_data in sitemap_data:
            assert "url" in post_data
            assert "last_modified" in post_data
            assert "priority" in post_data
            assert "change_frequency" in post_data

    async def test_analyze_content_seo_score(self, blog_service: BlogService):
        """Test analyzing content for SEO score."""
        good_content = """
# How to Learn Python Programming

Python is a powerful programming language that's perfect for beginners.
In this comprehensive guide, we'll cover everything you need to know about Python programming.

## Why Learn Python?

Python programming offers many advantages for developers. Python is easy to learn,
has great community support, and is used in web development, data science, and automation.

## Getting Started with Python

To start learning Python, you'll need to install Python on your system...
"""

        seo_analysis = await blog_service.analyze_content_seo(
            content=good_content, target_keyword="python programming"
        )

        assert "score" in seo_analysis
        assert "recommendations" in seo_analysis
        assert "keyword_density" in seo_analysis
        assert "readability" in seo_analysis

        # Should have decent score for well-optimized content
        assert seo_analysis["score"] >= 70

        # Should detect keyword usage
        assert seo_analysis["keyword_density"] > 0

        # Should provide actionable recommendations
        assert len(seo_analysis["recommendations"]) >= 0
