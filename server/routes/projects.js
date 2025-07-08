const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

const DATA_PATH = path.join(__dirname, '..', '..', 'data', 'projects.json');

// Helper function to read projects data
async function readProjectsData() {
  try {
    const data = await fs.readFile(DATA_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { projects: [] };
    }
    throw error;
  }
}

// Helper function to write projects data
async function writeProjectsData(data) {
  await fs.writeFile(DATA_PATH, JSON.stringify(data, null, 2));
}

// GET /api/projects - Get all projects
router.get('/', async (req, res) => {
  try {
    const { category, status, limit, offset } = req.query;
    const data = await readProjectsData();
    let projects = data.projects || [];

    // Apply filters
    if (category && category !== 'all') {
      projects = projects.filter(project => project.category === category);
    }
    
    if (status && status !== 'all') {
      projects = projects.filter(project => project.status === status);
    }

    // Sort by year and creation date (newest first)
    projects.sort((a, b) => {
      const yearA = parseInt(a.year) || 0;
      const yearB = parseInt(b.year) || 0;
      if (yearA !== yearB) return yearB - yearA;
      
      const dateA = new Date(a.createdDate || 0);
      const dateB = new Date(b.createdDate || 0);
      return dateB - dateA;
    });

    // Apply pagination
    const limitNum = parseInt(limit) || projects.length;
    const offsetNum = parseInt(offset) || 0;
    const paginatedProjects = projects.slice(offsetNum, offsetNum + limitNum);

    res.json({
      projects: paginatedProjects,
      total: projects.length,
      hasMore: offsetNum + limitNum < projects.length
    });
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// GET /api/projects/:id - Get single project
router.get('/:id', async (req, res) => {
  try {
    const data = await readProjectsData();
    const project = data.projects.find(p => p.id === req.params.id);
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    res.json(project);
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// POST /api/projects - Create new project
router.post('/', async (req, res) => {
  try {
    const {
      title,
      description,
      technologies = [],
      github,
      demo,
      status = 'in-progress',
      year,
      category = 'web-development',
      image
    } = req.body;

    // Validation
    if (!title || !description) {
      return res.status(400).json({ 
        error: 'Title and description are required' 
      });
    }

    const projectData = {
      id: uuidv4(),
      title: title.trim(),
      description: description.trim(),
      technologies: Array.isArray(technologies) ? technologies : 
        technologies.split(',').map(tech => tech.trim()).filter(tech => tech),
      github: github ? github.trim() : null,
      demo: demo ? demo.trim() : null,
      status: status,
      year: year || new Date().getFullYear().toString(),
      category: category,
      image: image || null,
      createdDate: new Date().toISOString(),
      lastModified: new Date().toISOString()
    };

    // Validate URLs if provided
    if (projectData.github && !isValidUrl(projectData.github)) {
      return res.status(400).json({ error: 'Invalid GitHub URL' });
    }
    
    if (projectData.demo && !isValidUrl(projectData.demo)) {
      return res.status(400).json({ error: 'Invalid demo URL' });
    }

    const data = await readProjectsData();
    data.projects.unshift(projectData); // Add to beginning
    await writeProjectsData(data);

    res.status(201).json({
      success: true,
      message: 'Project created successfully',
      project: projectData
    });
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// PUT /api/projects/:id - Update project
router.put('/:id', async (req, res) => {
  try {
    const {
      title,
      description,
      technologies,
      github,
      demo,
      status,
      year,
      category,
      image
    } = req.body;

    const data = await readProjectsData();
    const projectIndex = data.projects.findIndex(p => p.id === req.params.id);
    
    if (projectIndex === -1) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const project = data.projects[projectIndex];
    
    // Update fields
    if (title) project.title = title.trim();
    if (description) project.description = description.trim();
    if (technologies !== undefined) {
      project.technologies = Array.isArray(technologies) ? technologies : 
        technologies.split(',').map(tech => tech.trim()).filter(tech => tech);
    }
    if (github !== undefined) {
      project.github = github ? github.trim() : null;
      if (project.github && !isValidUrl(project.github)) {
        return res.status(400).json({ error: 'Invalid GitHub URL' });
      }
    }
    if (demo !== undefined) {
      project.demo = demo ? demo.trim() : null;
      if (project.demo && !isValidUrl(project.demo)) {
        return res.status(400).json({ error: 'Invalid demo URL' });
      }
    }
    if (status) project.status = status;
    if (year) project.year = year;
    if (category) project.category = category;
    if (image !== undefined) project.image = image;
    
    project.lastModified = new Date().toISOString();
    
    await writeProjectsData(data);
    
    res.json({
      success: true,
      message: 'Project updated successfully',
      project: project
    });
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// DELETE /api/projects/:id - Delete project
router.delete('/:id', async (req, res) => {
  try {
    const data = await readProjectsData();
    const projectIndex = data.projects.findIndex(p => p.id === req.params.id);
    
    if (projectIndex === -1) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const project = data.projects[projectIndex];
    
    // Delete project image if it exists and is local
    if (project.image && !project.image.startsWith('http')) {
      const imagePath = path.join(__dirname, '..', '..', 'assets', 'images', 'projects', project.image);
      try {
        await fs.unlink(imagePath);
      } catch (unlinkError) {
        console.warn('Could not delete project image:', unlinkError.message);
      }
    }
    
    // Remove from data
    data.projects.splice(projectIndex, 1);
    await writeProjectsData(data);
    
    res.json({
      success: true,
      message: 'Project deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

// GET /api/projects/categories/list - Get available categories
router.get('/categories/list', async (req, res) => {
  try {
    const data = await readProjectsData();
    const categories = [...new Set(data.projects.map(project => project.category))];
    
    const defaultCategories = [
      'web-development',
      'machine-learning',
      'mobile-development',
      'data-science',
      'research',
      'other'
    ];
    
    const allCategories = [...new Set([...defaultCategories, ...categories])];
    
    res.json({
      categories: allCategories.sort()
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// GET /api/projects/technologies/list - Get all used technologies
router.get('/technologies/list', async (req, res) => {
  try {
    const data = await readProjectsData();
    const technologies = new Set();
    
    data.projects.forEach(project => {
      if (project.technologies) {
        project.technologies.forEach(tech => technologies.add(tech));
      }
    });
    
    res.json({
      technologies: Array.from(technologies).sort()
    });
  } catch (error) {
    console.error('Error fetching technologies:', error);
    res.status(500).json({ error: 'Failed to fetch technologies' });
  }
});

// GET /api/projects/stats - Get project statistics
router.get('/stats/overview', async (req, res) => {
  try {
    const data = await readProjectsData();
    const projects = data.projects || [];
    
    const stats = {
      total: projects.length,
      byCategory: {},
      byStatus: {},
      byYear: {},
      technologies: {}
    };
    
    projects.forEach(project => {
      // Category stats
      stats.byCategory[project.category] = (stats.byCategory[project.category] || 0) + 1;
      
      // Status stats
      stats.byStatus[project.status] = (stats.byStatus[project.status] || 0) + 1;
      
      // Year stats
      stats.byYear[project.year] = (stats.byYear[project.year] || 0) + 1;
      
      // Technology stats
      if (project.technologies) {
        project.technologies.forEach(tech => {
          stats.technologies[tech] = (stats.technologies[tech] || 0) + 1;
        });
      }
    });
    
    res.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Helper function to validate URLs
function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

module.exports = router;