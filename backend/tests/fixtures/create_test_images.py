#!/usr/bin/env python3
"""
Create test images with various properties for testing.
"""
from __future__ import annotations

import io
from pathlib import Path
from PIL import Image, ImageDraw
import piexif


def create_test_images():
    """Create various test images for testing scenarios."""
    fixtures_dir = Path(__file__).parent / "images"
    fixtures_dir.mkdir(exist_ok=True)
    
    # 1. Valid JPEG with EXIF
    create_valid_jpeg_with_exif(fixtures_dir)
    
    # 2. Valid PNG without EXIF
    create_valid_png_no_exif(fixtures_dir)
    
    # 3. Large image (10MB+)
    create_large_image(fixtures_dir)
    
    # 4. Small thumbnail-sized image
    create_small_image(fixtures_dir)
    
    # 5. Corrupted image
    create_corrupted_image(fixtures_dir)
    
    # 6. Malicious SVG (for security testing)
    create_malicious_svg(fixtures_dir)
    
    # 7. Image with GPS EXIF data
    create_image_with_gps(fixtures_dir)
    
    # 8. Various format images
    create_various_formats(fixtures_dir)
    
    print("Test images created successfully!")


def create_valid_jpeg_with_exif(fixtures_dir: Path):
    """Create a JPEG with basic EXIF data."""
    img = Image.new('RGB', (1920, 1080), color='blue')
    
    # Draw something on the image
    draw = ImageDraw.Draw(img)
    draw.rectangle([100, 100, 300, 300], fill='red')
    draw.text((50, 50), "Test Image with EXIF", fill='white')
    
    # Create EXIF data
    exif_dict = {
        "0th": {
            piexif.ImageIFD.Make: "Canon",
            piexif.ImageIFD.Model: "EOS R5",
            piexif.ImageIFD.DateTime: "2023:12:01 12:00:00",
            piexif.ImageIFD.Software: "Test Suite",
            piexif.ImageIFD.ImageWidth: 1920,
            piexif.ImageIFD.ImageLength: 1080,
        },
        "Exif": {
            piexif.ExifIFD.ISOSpeedRatings: 100,
            piexif.ExifIFD.FNumber: (28, 10),  # f/2.8
            piexif.ExifIFD.ExposureTime: (1, 125),  # 1/125s
            piexif.ExifIFD.FocalLength: (85, 1),  # 85mm
            piexif.ExifIFD.LensModel: "RF 85mm F1.2L USM",
        }
    }
    
    exif_bytes = piexif.dump(exif_dict)
    img.save(fixtures_dir / "valid_jpeg_with_exif.jpg", "JPEG", exif=exif_bytes)


def create_valid_png_no_exif(fixtures_dir: Path):
    """Create a PNG without EXIF (PNGs don't support EXIF)."""
    img = Image.new('RGBA', (800, 600), color=(255, 0, 0, 128))
    
    draw = ImageDraw.Draw(img)
    draw.ellipse([100, 100, 400, 400], fill=(0, 255, 0, 255))
    draw.text((50, 50), "Test PNG Image", fill='black')
    
    img.save(fixtures_dir / "valid_png_no_exif.png", "PNG")


def create_large_image(fixtures_dir: Path):
    """Create a large image (over 10MB)."""
    # Create a high-resolution image
    img = Image.new('RGB', (4000, 3000), color='green')
    
    draw = ImageDraw.Draw(img)
    # Fill with gradients and patterns to make it uncompressible
    for i in range(0, 4000, 50):
        for j in range(0, 3000, 50):
            color = (i % 255, j % 255, (i + j) % 255)
            draw.rectangle([i, j, i+50, j+50], fill=color)
    
    img.save(fixtures_dir / "large_image_10mb.jpg", "JPEG", quality=95)


def create_small_image(fixtures_dir: Path):
    """Create a small thumbnail-sized image."""
    img = Image.new('RGB', (150, 150), color='yellow')
    
    draw = ImageDraw.Draw(img)
    draw.text((30, 70), "Tiny", fill='black')
    
    img.save(fixtures_dir / "small_thumbnail.jpg", "JPEG")


def create_corrupted_image(fixtures_dir: Path):
    """Create a corrupted image file."""
    # Write invalid JPEG data
    with open(fixtures_dir / "corrupted.jpg", "wb") as f:
        f.write(b"\xFF\xD8\xFF\xE0\x00\x10JFIF")  # Incomplete JPEG header
        f.write(b"corrupted data that is not valid image data" * 100)


def create_malicious_svg(fixtures_dir: Path):
    """Create an SVG with potentially malicious content."""
    svg_content = '''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" onload="alert('XSS')">
    <script>alert('XSS in SVG')</script>
    <foreignObject>
        <iframe src="javascript:alert('XSS')"></iframe>
    </foreignObject>
    <use xlink:href="javascript:alert('XSS')"/>
    <circle cx="50" cy="50" r="40" fill="red"/>
</svg>'''
    
    with open(fixtures_dir / "malicious_script.svg", "w") as f:
        f.write(svg_content)


def create_image_with_gps(fixtures_dir: Path):
    """Create an image with GPS EXIF data."""
    img = Image.new('RGB', (1200, 800), color='purple')
    
    draw = ImageDraw.Draw(img)
    draw.text((50, 50), "Image with GPS Data", fill='white')
    draw.text((50, 100), "Location: San Francisco, CA", fill='white')
    
    # GPS coordinates for San Francisco
    lat_deg, lat_min, lat_sec = 37, 46, 29.9988  # 37.7749997
    lon_deg, lon_min, lon_sec = 122, 25, 9.9984   # -122.4194

    gps_dict = {
        piexif.GPSIFD.GPSVersionID: (2, 0, 0, 0),
        piexif.GPSIFD.GPSLatitudeRef: 'N',
        piexif.GPSIFD.GPSLatitude: ((lat_deg, 1), (lat_min, 1), (int(lat_sec * 10000), 10000)),
        piexif.GPSIFD.GPSLongitudeRef: 'W',
        piexif.GPSIFD.GPSLongitude: ((lon_deg, 1), (lon_min, 1), (int(lon_sec * 10000), 10000)),
    }
    
    exif_dict = {
        "0th": {
            piexif.ImageIFD.Make: "Apple",
            piexif.ImageIFD.Model: "iPhone 14 Pro",
            piexif.ImageIFD.DateTime: "2023:12:01 15:30:45",
        },
        "GPS": gps_dict
    }
    
    exif_bytes = piexif.dump(exif_dict)
    img.save(fixtures_dir / "image_with_gps.jpg", "JPEG", exif=exif_bytes)


def create_various_formats(fixtures_dir: Path):
    """Create images in various formats."""
    base_img = Image.new('RGB', (400, 300), color='orange')
    draw = ImageDraw.Draw(base_img)
    draw.text((50, 150), "Format Test", fill='black')
    
    # WEBP
    base_img.save(fixtures_dir / "test_image.webp", "WEBP")
    
    # BMP
    base_img.save(fixtures_dir / "test_image.bmp", "BMP")
    
    # TIFF
    base_img.save(fixtures_dir / "test_image.tiff", "TIFF")


if __name__ == "__main__":
    create_test_images()