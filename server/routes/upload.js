const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const exifr = require('exifr');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 1
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/tiff'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, WebP, and TIFF files are allowed.'), false);
    }
  }
});

// Helper function to convert GPS coordinates
function convertGPSCoordinates(gpsData) {
  if (!gpsData) return null;
  
  const convertDMSToDD = (degrees, minutes, seconds, direction) => {
    let dd = degrees + (minutes / 60) + (seconds / 3600);
    if (direction === 'S' || direction === 'W') {
      dd = dd * -1;
    }
    return dd;
  };

  try {
    const lat = gpsData.latitude || (gpsData.GPSLatitude && gpsData.GPSLatitudeRef ? 
      convertDMSToDD(...gpsData.GPSLatitude, gpsData.GPSLatitudeRef) : null);
    
    const lng = gpsData.longitude || (gpsData.GPSLongitude && gpsData.GPSLongitudeRef ? 
      convertDMSToDD(...gpsData.GPSLongitude, gpsData.GPSLongitudeRef) : null);

    if (lat !== null && lng !== null) {
      return [parseFloat(lat.toFixed(6)), parseFloat(lng.toFixed(6))];
    }
  } catch (error) {
    console.error('Error converting GPS coordinates:', error);
  }
  
  return null;
}

// Helper function to format camera settings
function formatCameraSettings(exifData) {
  const settings = {};
  
  if (exifData.FNumber || exifData.ApertureValue) {
    const aperture = exifData.FNumber || Math.pow(2, exifData.ApertureValue / 2);
    settings.aperture = `f/${aperture.toFixed(1)}`;
  }
  
  if (exifData.ExposureTime) {
    if (exifData.ExposureTime >= 1) {
      settings.shutter = `${exifData.ExposureTime}s`;
    } else {
      settings.shutter = `1/${Math.round(1/exifData.ExposureTime)}s`;
    }
  }
  
  if (exifData.ISO || exifData.PhotographicSensitivity) {
    settings.iso = exifData.ISO || exifData.PhotographicSensitivity;
  }
  
  if (exifData.FocalLength) {
    settings.focal_length = `${Math.round(exifData.FocalLength)}mm`;
  }
  
  return settings;
}

// Helper function to get location name from coordinates
async function getLocationName(coordinates) {
  // This is a placeholder - you might want to integrate with a geocoding service
  // For now, return a generic location
  return {
    name: "Unknown Location",
    country: "Unknown"
  };
}

// Photo upload endpoint
router.post('/photo', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { title, category = 'landscape', comment = '', tags = '' } = req.body;
    
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    // Generate unique filename
    const photoId = uuidv4();
    const fileExtension = path.extname(req.file.originalname).toLowerCase() || '.jpg';
    const filename = `${photoId}${fileExtension}`;
    const outputPath = path.join(__dirname, '..', '..', 'assets', 'images', 'portfolio', filename);

    // Extract EXIF data
    console.log('Extracting EXIF data...');
    const exifData = await exifr.parse(req.file.buffer, {
      gps: true,
      exif: true,
      ifd0: true,
      ifd1: true,
      interop: true
    });

    // Process GPS coordinates
    const coordinates = convertGPSCoordinates(exifData);
    let location = { name: "Unknown Location", country: "Unknown" };
    
    if (coordinates) {
      // In a real implementation, you'd use a geocoding service here
      location.coordinates = coordinates;
    }

    // Format camera settings
    const cameraSettings = formatCameraSettings(exifData);

    // Process and optimize image with Sharp (WebP + JPEG)
    console.log('Processing image with Sharp...');
    
    // Get image dimensions using Sharp for metadata
    const metadata = await sharp(req.file.buffer).metadata();
    
    // Define image sizes
    const sizes = {
      thumbnail: { width: 300, height: 200 },
      medium: { width: 1200, height: 800 },
      large: { width: 1920, height: 1280 }
    };
    
    const processedImages = {};
    
    // Process each size
    for (const [sizeName, dimensions] of Object.entries(sizes)) {
      console.log(`Processing ${sizeName} size...`);
      
      // Create base Sharp instance with resizing
      const sharpInstance = sharp(req.file.buffer)
        .rotate() // Auto-rotate based on EXIF orientation
        .resize(dimensions.width, dimensions.height, { 
          fit: 'inside',
          withoutEnlargement: true
        });
      
      // Generate WebP version
      const webpPath = path.join(path.dirname(outputPath), `${photoId}_${sizeName}.webp`);
      const webpInfo = await sharpInstance.clone()
        .webp({ 
          quality: sizeName === 'thumbnail' ? 75 : 80,
          effort: 6
        })
        .toFile(webpPath);
      
      // Generate JPEG version
      const jpegPath = path.join(path.dirname(outputPath), `${photoId}_${sizeName}.jpg`);
      const jpegInfo = await sharpInstance.clone()
        .jpeg({ 
          quality: sizeName === 'thumbnail' ? 80 : 85,
          mozjpeg: true,
          progressive: true
        })
        .toFile(jpegPath);
      
      // Store results
      processedImages[sizeName] = {
        webp: {
          filename: `${photoId}_${sizeName}.webp`,
          size: webpInfo.size
        },
        jpeg: {
          filename: `${photoId}_${sizeName}.jpg`,
          size: jpegInfo.size
        }
      };
    }
    
    // Create imageInfo for compatibility
    const imageInfo = {
      width: metadata.width,
      height: metadata.height,
      size: processedImages.large.jpeg.size
    };

    // Create photo object
    const photoData = {
      id: photoId,
      filename: filename, // Keep for compatibility
      images: processedImages,
      title: title.trim(),
      category: category,
      location: location,
      camera: {
        make: exifData.Make || 'Unknown',
        model: exifData.Model || 'Unknown',
        lens: exifData.LensModel || exifData.LensSpecification || 'Unknown',
        settings: cameraSettings
      },
      metadata: {
        date: exifData.DateTimeOriginal || exifData.DateTime || new Date().toISOString(),
        filesize: `${(imageInfo.size / (1024 * 1024)).toFixed(1)}MB`,
        dimensions: `${imageInfo.width}x${imageInfo.height}`,
        originalName: req.file.originalname,
        sizes: {
          thumbnail: `${(processedImages.thumbnail.webp.size / 1024).toFixed(1)}KB WebP / ${(processedImages.thumbnail.jpeg.size / 1024).toFixed(1)}KB JPEG`,
          medium: `${(processedImages.medium.webp.size / (1024 * 1024)).toFixed(1)}MB WebP / ${(processedImages.medium.jpeg.size / (1024 * 1024)).toFixed(1)}MB JPEG`,
          large: `${(processedImages.large.webp.size / (1024 * 1024)).toFixed(1)}MB WebP / ${(processedImages.large.jpeg.size / (1024 * 1024)).toFixed(1)}MB JPEG`
        }
      },
      comment: comment.trim(),
      tags: tags ? tags.split(',').map(tag => tag.trim()).filter(tag => tag) : [],
      uploadDate: new Date().toISOString()
    };

    // Load existing photography data
    const dataPath = path.join(__dirname, '..', '..', 'data', 'photography.json');
    let photographyData;
    
    try {
      const data = await fs.readFile(dataPath, 'utf8');
      photographyData = JSON.parse(data);
    } catch (error) {
      photographyData = { photos: [] };
    }

    // Add new photo and save
    photographyData.photos.unshift(photoData); // Add to beginning
    await fs.writeFile(dataPath, JSON.stringify(photographyData, null, 2));

    console.log(`Photo uploaded successfully: ${filename}`);
    
    res.json({
      success: true,
      message: 'Photo uploaded successfully',
      photo: photoData
    });

  } catch (error) {
    console.error('Upload error:', error);
    
    // Clean up file if it was created
    if (req.file) {
      const filename = req.file.filename;
      if (filename) {
        const filepath = path.join(__dirname, '..', '..', 'assets', 'images', 'portfolio', filename);
        try {
          await fs.unlink(filepath);
        } catch (unlinkError) {
          console.error('Error cleaning up file:', unlinkError);
        }
      }
    }
    
    res.status(500).json({
      error: 'Upload failed',
      message: error.message
    });
  }
});

// Get upload progress (for future implementation of progress tracking)
router.get('/progress/:uploadId', (req, res) => {
  // Placeholder for upload progress tracking
  res.json({ progress: 100, status: 'completed' });
});

module.exports = router;