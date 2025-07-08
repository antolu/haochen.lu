const express = require('express');
const path = require('path');
const fs = require('fs').promises;

const router = express.Router();

const DATA_PATH = path.join(__dirname, '..', '..', 'data', 'photography.json');

// Helper function to read photography data
async function readPhotographyData() {
  try {
    const data = await fs.readFile(DATA_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { photos: [] };
    }
    throw error;
  }
}

// Helper function to write photography data
async function writePhotographyData(data) {
  await fs.writeFile(DATA_PATH, JSON.stringify(data, null, 2));
}

// GET /api/photos - Get all photos with optional filtering
router.get('/', async (req, res) => {
  try {
    const { category, limit, offset } = req.query;
    const data = await readPhotographyData();
    let photos = data.photos || [];

    // Apply category filter
    if (category && category !== 'all') {
      photos = photos.filter(photo => photo.category === category);
    }

    // Apply pagination
    const limitNum = parseInt(limit) || photos.length;
    const offsetNum = parseInt(offset) || 0;
    const paginatedPhotos = photos.slice(offsetNum, offsetNum + limitNum);

    res.json({
      photos: paginatedPhotos,
      total: photos.length,
      hasMore: offsetNum + limitNum < photos.length
    });
  } catch (error) {
    console.error('Error fetching photos:', error);
    res.status(500).json({ error: 'Failed to fetch photos' });
  }
});

// GET /api/photos/:id - Get single photo
router.get('/:id', async (req, res) => {
  try {
    const data = await readPhotographyData();
    const photo = data.photos.find(p => p.id === req.params.id);
    
    if (!photo) {
      return res.status(404).json({ error: 'Photo not found' });
    }
    
    res.json(photo);
  } catch (error) {
    console.error('Error fetching photo:', error);
    res.status(500).json({ error: 'Failed to fetch photo' });
  }
});

// PUT /api/photos/:id - Update photo
router.put('/:id', async (req, res) => {
  try {
    const { title, category, comment, tags, location } = req.body;
    const data = await readPhotographyData();
    const photoIndex = data.photos.findIndex(p => p.id === req.params.id);
    
    if (photoIndex === -1) {
      return res.status(404).json({ error: 'Photo not found' });
    }
    
    // Update photo data
    const photo = data.photos[photoIndex];
    if (title) photo.title = title.trim();
    if (category) photo.category = category;
    if (comment !== undefined) photo.comment = comment.trim();
    if (tags !== undefined) {
      photo.tags = Array.isArray(tags) ? tags : 
        tags.split(',').map(tag => tag.trim()).filter(tag => tag);
    }
    if (location) {
      photo.location = { ...photo.location, ...location };
    }
    
    photo.lastModified = new Date().toISOString();
    
    await writePhotographyData(data);
    
    res.json({
      success: true,
      message: 'Photo updated successfully',
      photo: photo
    });
  } catch (error) {
    console.error('Error updating photo:', error);
    res.status(500).json({ error: 'Failed to update photo' });
  }
});

// DELETE /api/photos/:id - Delete photo
router.delete('/:id', async (req, res) => {
  try {
    const data = await readPhotographyData();
    const photoIndex = data.photos.findIndex(p => p.id === req.params.id);
    
    if (photoIndex === -1) {
      return res.status(404).json({ error: 'Photo not found' });
    }
    
    const photo = data.photos[photoIndex];
    
    // Delete the image file
    const imagePath = path.join(__dirname, '..', '..', 'assets', 'images', 'portfolio', photo.filename);
    try {
      await fs.unlink(imagePath);
    } catch (unlinkError) {
      console.warn('Could not delete image file:', unlinkError.message);
    }
    
    // Remove from data
    data.photos.splice(photoIndex, 1);
    await writePhotographyData(data);
    
    res.json({
      success: true,
      message: 'Photo deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting photo:', error);
    res.status(500).json({ error: 'Failed to delete photo' });
  }
});

// GET /api/photos/categories/list - Get available categories
router.get('/categories/list', async (req, res) => {
  try {
    const data = await readPhotographyData();
    const categories = [...new Set(data.photos.map(photo => photo.category))];
    
    res.json({
      categories: categories.sort()
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// GET /api/photos/stats - Get photo statistics
router.get('/stats/overview', async (req, res) => {
  try {
    const data = await readPhotographyData();
    const photos = data.photos || [];
    
    const stats = {
      total: photos.length,
      byCategory: {},
      totalSize: 0,
      cameras: {},
      uploadDates: []
    };
    
    photos.forEach(photo => {
      // Category stats
      stats.byCategory[photo.category] = (stats.byCategory[photo.category] || 0) + 1;
      
      // Camera stats
      const camera = `${photo.camera?.make || 'Unknown'} ${photo.camera?.model || ''}`.trim();
      stats.cameras[camera] = (stats.cameras[camera] || 0) + 1;
      
      // Upload dates
      if (photo.uploadDate) {
        stats.uploadDates.push(photo.uploadDate);
      }
      
      // Size estimation (if available)
      if (photo.metadata?.filesize) {
        const sizeMatch = photo.metadata.filesize.match(/([0-9.]+)MB/);
        if (sizeMatch) {
          stats.totalSize += parseFloat(sizeMatch[1]);
        }
      }
    });
    
    stats.totalSize = `${stats.totalSize.toFixed(1)}MB`;
    
    res.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

module.exports = router;