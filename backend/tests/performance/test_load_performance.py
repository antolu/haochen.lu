"""
P1 - Performance Load Tests

Tests application performance under load, including response times,
throughput, memory usage, and concurrent request handling.
"""

from __future__ import annotations

import asyncio
import gc
import os
import tempfile
import time
from typing import Any

import psutil
import pytest
from httpx import AsyncClient
from PIL import Image
from sqlalchemy.ext.asyncio import AsyncSession
from tests.factories import PhotoFactory, ProjectFactory


def get_memory_usage() -> float:
    """Get current memory usage in MB."""
    process = psutil.Process(os.getpid())
    return process.memory_info().rss / 1024 / 1024


@pytest.mark.performance
@pytest.mark.slow
async def test_photos_list_performance_under_load(
    async_client: AsyncClient, test_session: AsyncSession
):
    """Test photos list endpoint performance with many records."""
    # Create large dataset
    await PhotoFactory.create_batch_async(test_session, 1000)

    # Measure response times for different page sizes
    performance_metrics = {}

    for limit in [10, 50, 100]:
        times = []

        for _ in range(10):  # 10 requests per page size
            start_time = time.time()
            response = await async_client.get(f"/api/photos?limit={limit}")
            end_time = time.time()

            assert response.status_code == 200
            times.append(end_time - start_time)

        avg_time = sum(times) / len(times)
        max_time = max(times)
        min_time = min(times)

        performance_metrics[f"limit_{limit}"] = {
            "avg": avg_time,
            "max": max_time,
            "min": min_time,
        }

        # Performance expectations
        assert avg_time < 1.0, (
            f"Average response time {avg_time:.3f}s too slow for limit {limit}"
        )
        assert max_time < 2.0, (
            f"Max response time {max_time:.3f}s too slow for limit {limit}"
        )

    # Larger page sizes should not be exponentially slower
    ratio = (
        performance_metrics["limit_100"]["avg"] / performance_metrics["limit_10"]["avg"]
    )
    assert ratio < 5.0, f"Performance degradation ratio {ratio:.2f} too high"


@pytest.mark.performance
@pytest.mark.slow
async def test_concurrent_api_requests_performance(
    async_client: AsyncClient, test_session: AsyncSession
):
    """Test performance with concurrent API requests."""
    # Create test data
    await PhotoFactory.create_batch_async(test_session, 100)
    await ProjectFactory.create_batch_async(test_session, 50)

    async def make_request(endpoint: str) -> dict[str, Any]:
        start_time = time.time()
        response = await async_client.get(endpoint)
        end_time = time.time()

        return {
            "endpoint": endpoint,
            "status_code": response.status_code,
            "response_time": end_time - start_time,
        }

    # Define concurrent requests
    requests = [
        "/api/photos?limit=20",
        "/api/projects",
        "/api/photos?category=landscape",
        "/api/projects?featured=true",
        "/api/photos?page=2&limit=15",
        "/api/projects?technology=Python",
    ] * 5  # 30 total concurrent requests

    # Execute concurrent requests
    start_time = time.time()
    results = await asyncio.gather(*[make_request(endpoint) for endpoint in requests])
    total_time = time.time() - start_time

    # Analyze results
    successful_requests = [r for r in results if r["status_code"] == 200]
    failed_requests = [r for r in results if r["status_code"] != 200]

    assert len(successful_requests) >= 25, (
        f"Too many failed requests: {len(failed_requests)}"
    )

    avg_response_time = sum(r["response_time"] for r in successful_requests) / len(
        successful_requests
    )
    max_response_time = max(r["response_time"] for r in successful_requests)

    # Performance expectations
    assert avg_response_time < 2.0, (
        f"Average response time {avg_response_time:.3f}s too slow"
    )
    assert max_response_time < 5.0, (
        f"Max response time {max_response_time:.3f}s too slow"
    )
    assert total_time < 10.0, f"Total execution time {total_time:.3f}s too slow"


@pytest.mark.performance
@pytest.mark.slow
async def test_database_query_performance(
    async_client: AsyncClient, test_session: AsyncSession
):
    """Test database query performance with complex filters."""
    # Create diverse dataset
    for i in range(200):
        await PhotoFactory.create_async(
            test_session,
            category="landscape" if i % 3 == 0 else "portrait",
            tags="nature, outdoor" if i % 2 == 0 else "urban, city",
            access_level="public" if i % 4 != 0 else "private",
        )

    # Test complex query performance
    complex_queries = [
        "/api/photos?category=landscape&tags=nature&access_level=public",
        "/api/photos?sort=created_at&order=desc&limit=50",
        "/api/photos?tags=urban,city&page=2&limit=25",
    ]

    for query in complex_queries:
        times = []

        for _ in range(5):  # 5 repetitions per query
            start_time = time.time()
            response = await async_client.get(query)
            end_time = time.time()

            assert response.status_code == 200
            times.append(end_time - start_time)

        avg_time = sum(times) / len(times)
        assert avg_time < 0.8, f"Complex query too slow: {avg_time:.3f}s for {query}"


@pytest.mark.performance
@pytest.mark.slow
async def test_memory_usage_during_batch_operations(
    async_client: AsyncClient, admin_token: str, test_session: AsyncSession
):
    """Test memory usage during batch operations."""
    headers = {"Authorization": f"Bearer {admin_token}"}
    initial_memory = get_memory_usage()

    # Create multiple test images
    temp_files = []
    try:
        for i in range(10):
            img = Image.new("RGB", (1000, 800), color=(i * 25, i * 25, i * 25))
            with tempfile.NamedTemporaryFile(
                suffix=f"_mem_test_{i}.jpg", delete=False
            ) as temp_file:
                img.save(temp_file, format="JPEG", quality=80)
                temp_files.append(temp_file.name)

        # Upload images sequentially and monitor memory
        memory_readings = [initial_memory]

        for i, temp_file_path in enumerate(temp_files):
            with open(temp_file_path, "rb") as img_file:
                files = {"file": (f"mem_test_{i}.jpg", img_file, "image/jpeg")}
                data = {"title": f"Memory Test {i}"}

                response = await async_client.post(
                    "/api/photos", headers=headers, files=files, data=data
                )

                assert response.status_code == 201

                # Force garbage collection and measure memory
                gc.collect()
                current_memory = get_memory_usage()
                memory_readings.append(current_memory)

        final_memory = get_memory_usage()
        memory_increase = final_memory - initial_memory
        max_memory_increase = max(memory_readings) - initial_memory

        # Memory usage should be reasonable
        assert memory_increase < 200, (
            f"Memory increase {memory_increase:.2f}MB too high"
        )
        assert max_memory_increase < 300, (
            f"Peak memory increase {max_memory_increase:.2f}MB too high"
        )

    finally:
        # Cleanup
        for temp_file in temp_files:
            if os.path.exists(temp_file):
                os.unlink(temp_file)


@pytest.mark.performance
@pytest.mark.slow
async def test_memory_leak_detection_during_requests(
    async_client: AsyncClient, test_session: AsyncSession
):
    """Test for memory leaks during repeated requests."""
    # Create test data
    await PhotoFactory.create_batch_async(test_session, 50)

    initial_memory = get_memory_usage()
    memory_readings = []

    # Make many requests and monitor memory
    for i in range(100):
        response = await async_client.get("/api/photos?limit=10")
        assert response.status_code == 200

        # Check memory every 20 requests
        if i % 20 == 0:
            gc.collect()
            current_memory = get_memory_usage()
            memory_readings.append(current_memory)

    final_memory = get_memory_usage()

    # Memory should not continuously increase (indicating leak)
    memory_trend = final_memory - initial_memory
    max_memory = max(memory_readings)

    # Allow some increase but not excessive
    assert memory_trend < 50, f"Potential memory leak: {memory_trend:.2f}MB increase"
    assert max_memory - initial_memory < 100, (
        f"Peak memory usage too high: {max_memory - initial_memory:.2f}MB"
    )


@pytest.mark.performance
@pytest.mark.slow
async def test_image_upload_processing_performance(
    async_client: AsyncClient, admin_token: str
):
    """Test image processing performance for uploads."""
    headers = {"Authorization": f"Bearer {admin_token}"}

    # Test different image sizes
    image_sizes = [
        (800, 600, "small"),
        (1920, 1080, "medium"),
        (4000, 3000, "large"),
    ]

    performance_metrics = {}

    for width, height, size_name in image_sizes:
        img = Image.new("RGB", (width, height), color="red")

        with tempfile.NamedTemporaryFile(
            suffix=f"_{size_name}.jpg", delete=False
        ) as temp_file:
            img.save(temp_file, format="JPEG", quality=90)
            temp_file_path = temp_file.name

        try:
            times = []

            for i in range(3):  # 3 uploads per size
                start_time = time.time()

                with open(temp_file_path, "rb") as img_file:
                    files = {"file": (f"{size_name}_{i}.jpg", img_file, "image/jpeg")}
                    data = {"title": f"{size_name.title()} Image {i}"}

                    response = await async_client.post(
                        "/api/photos",
                        headers=headers,
                        files=files,
                        data=data,
                    )

                end_time = time.time()

                assert response.status_code == 201
                times.append(end_time - start_time)

            avg_time = sum(times) / len(times)
            performance_metrics[size_name] = avg_time

            # Performance expectations based on image size
            if size_name == "small":
                assert avg_time < 3.0, (
                    f"Small image processing too slow: {avg_time:.3f}s"
                )
            elif size_name == "medium":
                assert avg_time < 8.0, (
                    f"Medium image processing too slow: {avg_time:.3f}s"
                )
            elif size_name == "large":
                assert avg_time < 20.0, (
                    f"Large image processing too slow: {avg_time:.3f}s"
                )

        finally:
            if os.path.exists(temp_file_path):
                os.unlink(temp_file_path)

    # Processing time should scale reasonably with image size
    small_time = performance_metrics["small"]
    large_time = performance_metrics["large"]
    scaling_ratio = large_time / small_time

    # Large images shouldn't take more than 10x longer than small ones
    assert scaling_ratio < 10.0, (
        f"Image processing scaling ratio {scaling_ratio:.2f} too high"
    )


@pytest.mark.performance
@pytest.mark.slow
async def test_concurrent_image_processing_performance(
    async_client: AsyncClient, admin_token: str
):
    """Test performance of concurrent image processing."""
    headers = {"Authorization": f"Bearer {admin_token}"}

    # Create test images
    temp_files = []
    try:
        for i in range(5):
            img = Image.new("RGB", (1200, 800), color=(i * 50, i * 50, i * 50))
            with tempfile.NamedTemporaryFile(
                suffix=f"_concurrent_{i}.jpg", delete=False
            ) as temp_file:
                img.save(temp_file, format="JPEG", quality=85)
                temp_files.append(temp_file.name)

        async def upload_image(file_path: str, index: int):
            start_time = time.time()

            with open(file_path, "rb") as img_file:
                files = {"file": (f"concurrent_{index}.jpg", img_file, "image/jpeg")}
                data = {"title": f"Concurrent Upload {index}"}

                response = await async_client.post(
                    "/api/photos", headers=headers, files=files, data=data
                )

            end_time = time.time()
            return {
                "index": index,
                "status_code": response.status_code,
                "processing_time": end_time - start_time,
            }

        # Execute concurrent uploads
        start_time = time.time()
        results = await asyncio.gather(*[
            upload_image(temp_file, i) for i, temp_file in enumerate(temp_files)
        ])
        total_time = time.time() - start_time

        # Analyze results - allow some failures during concurrent processing
        successful_uploads = [r for r in results if r["status_code"] == 201]
        assert len(successful_uploads) >= 3, (
            f"At least 3 of 5 concurrent uploads should succeed, got {len(successful_uploads)}"
        )

        avg_processing_time = sum(r["processing_time"] for r in results) / len(results)
        max_processing_time = max(r["processing_time"] for r in results)

        # Concurrent processing should be efficient
        assert total_time < 25.0, (
            f"Total concurrent processing time {total_time:.3f}s too slow"
        )
        assert avg_processing_time < 15.0, (
            f"Average processing time {avg_processing_time:.3f}s too slow"
        )
        assert max_processing_time < 20.0, (
            f"Max processing time {max_processing_time:.3f}s too slow"
        )

    finally:
        # Cleanup
        for temp_file in temp_files:
            if os.path.exists(temp_file):
                os.unlink(temp_file)


@pytest.mark.performance
@pytest.mark.slow
async def test_large_dataset_query_performance(
    async_client: AsyncClient, test_session: AsyncSession
):
    """Test query performance with large datasets."""
    # Create large dataset with varied data for realistic queries
    batch_size = 100
    total_records = 500

    for batch_start in range(0, total_records, batch_size):
        [
            await PhotoFactory.create_async(
                test_session,
                category="landscape"
                if i % 4 == 0
                else "portrait"
                if i % 4 == 1
                else "street",
                tags="nature" if i % 3 == 0 else "urban" if i % 3 == 1 else "abstract",
                access_level="public" if i % 5 != 0 else "private",
            )
            for i in range(batch_start, min(batch_start + batch_size, total_records))
        ]

    # Test various query patterns
    query_tests = [
        ("/api/photos?limit=50", 0.5),  # Basic pagination
        ("/api/photos?category=landscape&limit=25", 0.6),  # Category filter
        ("/api/photos?tags=nature&limit=30", 0.7),  # Tags filter
        (
            "/api/photos?access_level=public&sort=created_at&order=desc&limit=40",
            0.8,
        ),  # Complex query
        ("/api/photos?page=5&limit=20", 0.5),  # Deep pagination
    ]

    for query, max_time in query_tests:
        times = []

        for _ in range(5):  # 5 repetitions per query
            start_time = time.time()
            response = await async_client.get(query)
            end_time = time.time()

            assert response.status_code == 200
            times.append(end_time - start_time)

        avg_time = sum(times) / len(times)
        max_query_time = max(times)

        assert avg_time < max_time, (
            f"Query too slow: {avg_time:.3f}s > {max_time}s for {query}"
        )
        assert max_query_time < max_time * 2, (
            f"Worst case too slow: {max_query_time:.3f}s for {query}"
        )


@pytest.mark.performance
@pytest.mark.slow
async def test_concurrent_database_operations_performance(
    async_client: AsyncClient, admin_token: str, test_session: AsyncSession
):
    """Test database performance with concurrent operations."""
    headers = {"Authorization": f"Bearer {admin_token}"}

    # Create base dataset
    photos = await PhotoFactory.create_batch_async(test_session, 20)

    async def read_operation():
        """Simulate read operation."""
        response = await async_client.get("/api/photos?limit=10")
        return response.status_code == 200

    async def update_operation(photo_id: str, index: int):
        """Simulate update operation."""
        update_data = {"title": f"Updated Title {index}"}
        response = await async_client.put(
            f"/api/photos/{photo_id}", headers=headers, json=update_data
        )
        return response.status_code == 200

    # Mix of read and update operations
    operations = []

    # 15 read operations
    operations.extend([read_operation() for _ in range(15)])

    # 5 update operations
    for i, photo in enumerate(photos[:5]):
        operations.append(update_operation(str(photo.id), i))

    # Execute concurrent operations
    start_time = time.time()
    results = await asyncio.gather(*operations, return_exceptions=True)
    total_time = time.time() - start_time

    # Analyze results
    successful_ops = sum(1 for r in results if r is True)
    failed_ops = len(results) - successful_ops

    assert successful_ops >= 18, f"Too many failed operations: {failed_ops}"
    assert total_time < 5.0, f"Concurrent operations too slow: {total_time:.3f}s"


@pytest.mark.performance
@pytest.mark.slow
async def test_database_connection_pool_performance(
    async_client: AsyncClient, test_session: AsyncSession
):
    """Test database connection pooling under load."""
    # Create test data
    await PhotoFactory.create_batch_async(test_session, 50)

    async def make_db_intensive_request():
        """Make a request that uses database connections."""
        response = await async_client.get(
            "/api/photos?sort=created_at&order=desc&limit=20"
        )
        return response.status_code == 200

    # Simulate many concurrent requests that need database connections
    concurrent_requests = 25

    start_time = time.time()
    results = await asyncio.gather(
        *[make_db_intensive_request() for _ in range(concurrent_requests)],
        return_exceptions=True,
    )
    total_time = time.time() - start_time

    # Analyze results
    successful_requests = sum(1 for r in results if r is True)

    # All requests should succeed despite connection pool pressure
    assert successful_requests >= 20, (
        f"Connection pool issues: only {successful_requests}/{concurrent_requests} succeeded"
    )

    # Should handle concurrent connections efficiently
    assert total_time < 8.0, f"Connection pool performance poor: {total_time:.3f}s"


@pytest.mark.performance
@pytest.mark.benchmark
async def test_api_response_time_benchmarks(
    async_client: AsyncClient, test_session: AsyncSession
):
    """Establish response time benchmarks for key endpoints."""
    # Create standardized test dataset
    await PhotoFactory.create_batch_async(test_session, 100)
    await ProjectFactory.create_batch_async(test_session, 25)

    # Define benchmark endpoints with expected response times
    benchmarks = {
        "/api/photos": 0.3,  # 300ms for photo list
        "/api/projects": 0.2,  # 200ms for project list
        "/api/photos?limit=50": 0.5,  # 500ms for larger photo list
        "/api/projects?featured=true": 0.25,  # 250ms for filtered projects
    }

    results = {}

    for endpoint, max_expected_time in benchmarks.items():
        times = []

        # Run each benchmark 10 times
        for _ in range(10):
            start_time = time.time()
            response = await async_client.get(endpoint)
            end_time = time.time()

            assert response.status_code == 200
            times.append(end_time - start_time)

        # Calculate statistics
        avg_time = sum(times) / len(times)
        p95_time = sorted(times)[int(0.95 * len(times))]  # 95th percentile
        min_time = min(times)
        max_time = max(times)

        results[endpoint] = {
            "average": avg_time,
            "p95": p95_time,
            "min": min_time,
            "max": max_time,
        }

        # Performance assertions
        assert avg_time < max_expected_time, (
            f"Benchmark failed for {endpoint}: avg {avg_time:.3f}s > {max_expected_time}s"
        )
        assert p95_time < max_expected_time * 1.5, (
            f"P95 benchmark failed for {endpoint}: {p95_time:.3f}s > {max_expected_time * 1.5}s"
        )

    # Print benchmark results for reference
    print("\n=== Performance Benchmark Results ===")
    for endpoint, metrics in results.items():
        print(f"{endpoint}:")
        print(f"  Average: {metrics['average']:.3f}s")
        print(f"  P95: {metrics['p95']:.3f}s")
        print(f"  Min: {metrics['min']:.3f}s")
        print(f"  Max: {metrics['max']:.3f}s")


@pytest.mark.performance
@pytest.mark.benchmark
async def test_throughput_benchmarks(
    async_client: AsyncClient, test_session: AsyncSession
):
    """Test throughput benchmarks (requests per second)."""
    # Create test data
    await PhotoFactory.create_batch_async(test_session, 200)

    # Test endpoint throughput
    endpoint = "/api/photos?limit=25"
    num_requests = 50
    concurrent_limit = 10

    async def make_request():
        response = await async_client.get(endpoint)
        return response.status_code == 200

    # Execute requests in batches to simulate realistic load
    successful_requests = 0
    start_time = time.time()

    for batch_start in range(0, num_requests, concurrent_limit):
        batch_size = min(concurrent_limit, num_requests - batch_start)
        batch_results = await asyncio.gather(*[
            make_request() for _ in range(batch_size)
        ])
        successful_requests += sum(batch_results)

    total_time = time.time() - start_time

    # Calculate throughput
    requests_per_second = successful_requests / total_time

    # Throughput expectations
    assert successful_requests >= num_requests * 0.95, "Too many failed requests"
    assert requests_per_second >= 10.0, (
        f"Throughput too low: {requests_per_second:.2f} req/s"
    )

    print("\n=== Throughput Benchmark ===")
    print(f"Endpoint: {endpoint}")
    print(f"Total requests: {successful_requests}/{num_requests}")
    print(f"Total time: {total_time:.3f}s")
    print(f"Throughput: {requests_per_second:.2f} requests/second")
