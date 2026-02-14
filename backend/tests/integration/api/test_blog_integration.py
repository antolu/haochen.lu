"""
Comprehensive Blog API Integration Tests

Tests the complete blog API against a running backend service.
"""

from __future__ import annotations

from datetime import datetime

import pytest
from httpx import AsyncClient


@pytest.mark.integration
async def test_list_published_blog_posts(
    integration_client: AsyncClient,
):
    """Test listing published blog posts."""
    response = await integration_client.get("/api/blog")

    assert response.status_code == 200
    data = response.json()

    assert "posts" in data
    # Should have at least 2 published posts from seeded data
    assert len(data["posts"]) >= 2

    # Verify all posts are published
    for post in data["posts"]:
        assert post["published"] is True

    # Verify post structure
    post = data["posts"][0]
    assert "id" in post
    assert "title" in post
    assert "content" in post
    assert "slug" in post
    assert "published" in post
    assert "created_at" in post


@pytest.mark.integration
async def test_get_blog_post_by_slug(
    integration_client: AsyncClient,
):
    """Test getting a blog post by its slug."""
    # Get a post slug from the list
    list_response = await integration_client.get("/api/blog")
    posts = list_response.json()["posts"]
    assert len(posts) > 0

    slug = posts[0]["slug"]

    # Get post by slug
    response = await integration_client.get(f"/api/blog/{slug}")

    assert response.status_code == 200
    post = response.json()

    assert post["slug"] == slug
    assert "title" in post
    assert "content" in post


@pytest.mark.integration
async def test_get_nonexistent_blog_post_returns_404(
    integration_client: AsyncClient,
):
    """Test getting a non-existent blog post returns 404."""
    response = await integration_client.get("/api/blog/nonexistent-slug")

    assert response.status_code == 404


@pytest.mark.integration
async def test_create_blog_post_requires_auth(
    integration_client: AsyncClient,
):
    """Test creating a blog post requires authentication."""
    post_data = {
        "title": "New Blog Post",
        "content": "Test content",
        "slug": "new-blog-post",
    }

    response = await integration_client.post("/api/blog", json=post_data)

    assert response.status_code == 401


@pytest.mark.integration
async def test_create_blog_post_with_auth_succeeds(
    integration_client: AsyncClient,
    admin_auth_headers: dict[str, str],
):
    """Test creating a blog post with authentication succeeds."""
    post_data = {
        "title": "Integration Test Blog Post",
        "content": "This post was created during integration testing.",
        "slug": "integration-test-post",
        "published": True,
        "tags": "test, integration",
    }

    response = await integration_client.post(
        "/api/blog",
        json=post_data,
        headers=admin_auth_headers,
    )

    assert response.status_code in [200, 201]
    post = response.json()

    assert post["title"] == "Integration Test Blog Post"
    assert post["slug"] == "integration-test-post"
    assert post["published"] is True


@pytest.mark.integration
async def test_update_blog_post_requires_auth(
    integration_client: AsyncClient,
):
    """Test updating a blog post requires authentication."""
    # Get a post
    list_response = await integration_client.get("/api/blog")
    post_id = list_response.json()["posts"][0]["id"]

    update_data = {"title": "Updated Title"}

    response = await integration_client.put(
        f"/api/blog/{post_id}",
        json=update_data,
    )

    assert response.status_code == 401


@pytest.mark.integration
async def test_update_blog_post_with_auth_succeeds(
    integration_client: AsyncClient,
    admin_auth_headers: dict[str, str],
):
    """Test updating a blog post with authentication succeeds."""
    # Get a post
    list_response = await integration_client.get("/api/blog")
    post_id = list_response.json()["posts"][0]["id"]

    update_data = {
        "title": "Updated Blog Post Title",
        "content": "Updated content",
    }

    response = await integration_client.put(
        f"/api/blog/{post_id}",
        json=update_data,
        headers=admin_auth_headers,
    )

    assert response.status_code == 200
    post = response.json()

    assert post["title"] == "Updated Blog Post Title"
    assert post["content"] == "Updated content"


@pytest.mark.integration
async def test_delete_blog_post_requires_auth(
    integration_client: AsyncClient,
):
    """Test deleting a blog post requires authentication."""
    list_response = await integration_client.get("/api/blog")
    post_id = list_response.json()["posts"][0]["id"]

    response = await integration_client.delete(f"/api/blog/{post_id}")

    assert response.status_code == 401


@pytest.mark.integration
async def test_draft_posts_not_visible_to_public(
    integration_client: AsyncClient,
):
    """Test draft blog posts are not visible to public."""
    response = await integration_client.get("/api/blog")

    assert response.status_code == 200
    posts = response.json()["posts"]

    # All returned posts should be published
    for post in posts:
        assert post["published"] is True


@pytest.mark.integration
async def test_draft_posts_visible_to_admin(
    integration_client: AsyncClient,
    admin_auth_headers: dict[str, str],
):
    """Test draft blog posts are visible to admin."""
    response = await integration_client.get(
        "/api/blog/admin",
        headers=admin_auth_headers,
    )

    assert response.status_code == 200
    posts = response.json()["posts"]

    # Should include draft posts
    has_draft = any(not post["published"] for post in posts)
    # We seeded one draft post
    assert has_draft


@pytest.mark.integration
async def test_search_blog_posts_by_title(
    integration_client: AsyncClient,
):
    """Test searching blog posts by title."""
    response = await integration_client.get("/api/blog?search=FastAPI")

    assert response.status_code == 200
    data = response.json()

    # "Getting Started with FastAPI" exists in seeded data
    assert len(data["posts"]) >= 1

    assert any("fastapi" in post["title"].lower() for post in data["posts"])


@pytest.mark.integration
async def test_filter_blog_posts_by_tag(
    integration_client: AsyncClient,
):
    """Test filtering blog posts by tag."""
    response = await integration_client.get("/api/blog?tag=tutorial")

    assert response.status_code == 200
    data = response.json()

    # Should have posts tagged with "tutorial"
    assert len(data["posts"]) >= 1


@pytest.mark.integration
async def test_blog_posts_sorted_by_date(
    integration_client: AsyncClient,
):
    """Test blog posts are sorted by publish/create date (newest first)."""
    response = await integration_client.get("/api/blog")

    assert response.status_code == 200
    posts = response.json()["posts"]

    assert len(posts) >= 2

    # Verify descending order (newest first)
    sort_dates = []
    for post in posts:
        ts = post.get("published_at") or post["created_at"]
        sort_dates.append(datetime.fromisoformat(ts.replace("Z", "+00:00")))
    assert sort_dates == sorted(sort_dates, reverse=True)


@pytest.mark.integration
async def test_blog_post_slug_must_be_unique(
    integration_client: AsyncClient,
    admin_auth_headers: dict[str, str],
):
    """Test that blog post slugs must be unique."""
    # Use an existing slug from seeded data
    existing_slug = "getting-started-fastapi"

    post_data = {
        "title": "Another FastAPI Post",
        "content": "Different content",
        "slug": existing_slug,
        "published": True,
    }

    response = await integration_client.post(
        "/api/blog",
        json=post_data,
        headers=admin_auth_headers,
    )

    # Current API auto-adjusts duplicate slugs for uniqueness
    assert response.status_code in [200, 201]
    created = response.json()
    assert created["slug"].startswith(existing_slug)
    assert created["slug"] != existing_slug
