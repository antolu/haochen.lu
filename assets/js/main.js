// Main JavaScript file for the photography portfolio

// Global variables
let photographyData = [];
let projectsData = [];
let currentFilter = 'all';
let photosLoaded = 0;
let photosPerPage = 12;
let lightbox = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

async function initializeApp() {
    // Initialize navigation
    initializeNavigation();
    
    // Load data
    await loadPhotographyData();
    await loadProjectsData();
    
    // Initialize components
    initializePhotoGallery();
    initializeProjectsGrid();
    initializeLightbox();
    
    // Initialize filters
    initializeFilters();
    
    // Initialize smooth scrolling
    initializeSmoothScrolling();
    
    // Update last updated date
    updateLastUpdatedDate();
    
    console.log('Photography portfolio initialized successfully');
}

// Navigation functionality
function initializeNavigation() {
    const mobileMenuButton = document.getElementById('mobile-menu-button');
    const mobileMenu = document.getElementById('mobile-menu');
    const navLinks = document.querySelectorAll('.nav-link');
    
    // Mobile menu toggle
    if (mobileMenuButton) {
        mobileMenuButton.addEventListener('click', function() {
            mobileMenu.classList.toggle('hidden');
        });
    }
    
    // Active nav link highlighting
    window.addEventListener('scroll', function() {
        highlightActiveNavLink();
        updateNavbarBackground();
    });
    
    // Close mobile menu when clicking nav links
    navLinks.forEach(link => {
        link.addEventListener('click', function() {
            if (mobileMenu) {
                mobileMenu.classList.add('hidden');
            }
        });
    });
}

function highlightActiveNavLink() {
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-link');
    
    let currentSection = '';
    
    sections.forEach(section => {
        const sectionTop = section.offsetTop;
        const sectionHeight = section.clientHeight;
        
        if (window.pageYOffset >= sectionTop - 200) {
            currentSection = section.getAttribute('id');
        }
    });
    
    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${currentSection}`) {
            link.classList.add('active');
        }
    });
}

function updateNavbarBackground() {
    const navbar = document.getElementById('navbar');
    if (window.scrollY > 50) {
        navbar.style.backgroundColor = 'rgba(255, 255, 255, 0.95)';
        navbar.style.backdropFilter = 'blur(10px)';
    } else {
        navbar.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
        navbar.style.backdropFilter = 'blur(5px)';
    }
}

// Data loading functions
async function loadPhotographyData() {
    try {
        // Try API first, then fallback to static file
        let response = await fetch('/api/photos');
        if (response.ok) {
            const data = await response.json();
            photographyData = data.photos || [];
            return;
        }
        
        // Fallback to static JSON file
        response = await fetch('/data/photography.json');
        if (response.ok) {
            const data = await response.json();
            photographyData = data.photos || [];
        } else {
            // Final fallback to sample data
            photographyData = getSamplePhotographyData();
        }
    } catch (error) {
        console.log('Using sample photography data');
        photographyData = getSamplePhotographyData();
    }
}

async function loadProjectsData() {
    try {
        // Try API first, then fallback to static file
        let response = await fetch('/api/projects');
        if (response.ok) {
            const data = await response.json();
            projectsData = data.projects || [];
            return;
        }
        
        // Fallback to static JSON file
        response = await fetch('/data/projects.json');
        if (response.ok) {
            const data = await response.json();
            projectsData = data.projects || [];
        } else {
            // Final fallback to sample data
            projectsData = getSampleProjectsData();
        }
    } catch (error) {
        console.log('Using sample projects data');
        projectsData = getSampleProjectsData();
    }
}

// Photo gallery functionality
function initializePhotoGallery() {
    const photoGrid = document.getElementById('photo-grid');
    const loadMoreButton = document.getElementById('load-more');
    
    if (photoGrid) {
        loadPhotos();
    }
    
    if (loadMoreButton) {
        loadMoreButton.addEventListener('click', loadPhotos);
    }
}

function loadPhotos() {
    const photoGrid = document.getElementById('photo-grid');
    const loadMoreButton = document.getElementById('load-more');
    
    if (!photoGrid || !photographyData.length) return;
    
    const filteredPhotos = currentFilter === 'all' 
        ? photographyData 
        : photographyData.filter(photo => photo.category === currentFilter);
    
    const photosToShow = filteredPhotos.slice(photosLoaded, photosLoaded + photosPerPage);
    
    photosToShow.forEach(photo => {
        const photoElement = createPhotoElement(photo);
        photoGrid.appendChild(photoElement);
    });
    
    photosLoaded += photosToShow.length;
    
    // Hide load more button if all photos are loaded
    if (photosLoaded >= filteredPhotos.length) {
        loadMoreButton.style.display = 'none';
    } else {
        loadMoreButton.style.display = 'block';
    }
}

function createPhotoElement(photo) {
    const photoDiv = document.createElement('div');
    photoDiv.className = 'photo-item aspect-square md:aspect-[4/3] lg:aspect-square';
    photoDiv.setAttribute('data-category', photo.category);
    
    const photoPath = photo.filename.startsWith('http') 
        ? photo.filename 
        : `/assets/images/portfolio/${photo.filename}`;
    
    photoDiv.innerHTML = `
        <img src="${photoPath}" 
             alt="${photo.title}" 
             class="w-full h-full object-cover"
             loading="lazy">
        <div class="photo-overlay">
            <div class="photo-info">
                <div class="photo-title">${photo.title}</div>
                <div class="photo-meta">
                    <span class="photo-meta-badge">📍 ${photo.location?.name || 'Unknown'}</span>
                    <span class="photo-meta-badge">📷 ${photo.camera?.settings?.aperture || 'N/A'}</span>
                </div>
            </div>
        </div>
    `;
    
    // Add click event to show metadata
    photoDiv.addEventListener('click', function() {
        showPhotoMetadata(photo);
    });
    
    return photoDiv;
}

function showPhotoMetadata(photo) {
    const modal = document.getElementById('photo-metadata-modal');
    const metadataContent = document.getElementById('metadata-content');
    
    if (!modal || !metadataContent) return;
    
    const photoPath = photo.filename.startsWith('http') 
        ? photo.filename 
        : `/assets/images/portfolio/${photo.filename}`;
    
    metadataContent.innerHTML = `
        <div class="grid md:grid-cols-2 gap-6">
            <div>
                <img src="${photoPath}" 
                     alt="${photo.title}" 
                     class="w-full h-64 md:h-80 object-cover rounded-lg">
            </div>
            <div>
                <h3 class="text-2xl font-bold mb-4">${photo.title}</h3>
                <div class="metadata-grid">
                    <div class="metadata-card">
                        <h4>📷 Camera Settings</h4>
                        <div class="metadata-item">
                            <span class="metadata-label">Aperture</span>
                            <span class="metadata-value">${photo.camera?.settings?.aperture || 'N/A'}</span>
                        </div>
                        <div class="metadata-item">
                            <span class="metadata-label">Shutter Speed</span>
                            <span class="metadata-value">${photo.camera?.settings?.shutter || 'N/A'}</span>
                        </div>
                        <div class="metadata-item">
                            <span class="metadata-label">ISO</span>
                            <span class="metadata-value">${photo.camera?.settings?.iso || 'N/A'}</span>
                        </div>
                        <div class="metadata-item">
                            <span class="metadata-label">Focal Length</span>
                            <span class="metadata-value">${photo.camera?.settings?.focal_length || 'N/A'}</span>
                        </div>
                    </div>
                    
                    <div class="metadata-card">
                        <h4>📱 Equipment</h4>
                        <div class="metadata-item">
                            <span class="metadata-label">Camera</span>
                            <span class="metadata-value">${photo.camera?.make || 'N/A'} ${photo.camera?.model || ''}</span>
                        </div>
                        <div class="metadata-item">
                            <span class="metadata-label">Lens</span>
                            <span class="metadata-value">${photo.camera?.lens || 'N/A'}</span>
                        </div>
                        <div class="metadata-item">
                            <span class="metadata-label">File Size</span>
                            <span class="metadata-value">${photo.metadata?.filesize || 'N/A'}</span>
                        </div>
                        <div class="metadata-item">
                            <span class="metadata-label">Dimensions</span>
                            <span class="metadata-value">${photo.metadata?.dimensions || 'N/A'}</span>
                        </div>
                    </div>
                </div>
                
                <div class="metadata-card mt-4">
                    <h4>📍 Location</h4>
                    <div class="metadata-item">
                        <span class="metadata-label">Location</span>
                        <span class="metadata-value">${photo.location?.name || 'Unknown'}</span>
                    </div>
                    ${photo.location?.country ? `
                    <div class="metadata-item">
                        <span class="metadata-label">Country</span>
                        <span class="metadata-value">${photo.location.country}</span>
                    </div>
                    ` : ''}
                    <div class="metadata-item">
                        <span class="metadata-label">Date Taken</span>
                        <span class="metadata-value">${formatDate(photo.metadata?.date)}</span>
                    </div>
                </div>
            </div>
        </div>
        
        ${photo.comment ? `
        <div class="metadata-comment">
            <h4>💭 Photographer's Note</h4>
            <p>${photo.comment}</p>
        </div>
        ` : ''}
        
        ${photo.tags?.length ? `
        <div class="mt-4">
            <h4 class="text-lg font-semibold mb-2">🏷️ Tags</h4>
            <div class="flex flex-wrap gap-2">
                ${photo.tags.map(tag => `
                    <span class="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                        ${tag}
                    </span>
                `).join('')}
            </div>
        </div>
        ` : ''}
    `;
    
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeMetadataModal() {
    const modal = document.getElementById('photo-metadata-modal');
    if (modal) {
        modal.classList.add('hidden');
        document.body.style.overflow = 'auto';
    }
}

// Filter functionality
function initializeFilters() {
    const filterButtons = document.querySelectorAll('.filter-btn');
    
    filterButtons.forEach(button => {
        button.addEventListener('click', function() {
            const filter = this.getAttribute('data-filter');
            setActiveFilter(filter);
            filterPhotos(filter);
        });
    });
}

function setActiveFilter(filter) {
    const filterButtons = document.querySelectorAll('.filter-btn');
    
    filterButtons.forEach(button => {
        button.classList.remove('active');
        if (button.getAttribute('data-filter') === filter) {
            button.classList.add('active');
        }
    });
    
    currentFilter = filter;
}

function filterPhotos(filter) {
    const photoGrid = document.getElementById('photo-grid');
    const loadMoreButton = document.getElementById('load-more');
    
    // Clear current photos
    photoGrid.innerHTML = '';
    photosLoaded = 0;
    
    // Load filtered photos
    loadPhotos();
}

// Projects functionality
function initializeProjectsGrid() {
    const projectsGrid = document.getElementById('projects-grid');
    
    if (projectsGrid && projectsData.length) {
        projectsData.forEach(project => {
            const projectElement = createProjectElement(project);
            projectsGrid.appendChild(projectElement);
        });
    }
}

function createProjectElement(project) {
    const projectDiv = document.createElement('div');
    projectDiv.className = 'project-card';
    
    const projectImage = project.image 
        ? `<img src="${project.image}" alt="${project.title}" class="project-image">`
        : `<div class="project-image">${project.title.substring(0, 2)}</div>`;
    
    projectDiv.innerHTML = `
        ${projectImage}
        <div class="project-content">
            <h3 class="project-title">${project.title}</h3>
            <p class="project-description">${project.description}</p>
            ${project.technologies?.length ? `
            <div class="project-tech">
                ${project.technologies.map(tech => `
                    <span class="tech-tag">${tech}</span>
                `).join('')}
            </div>
            ` : ''}
            <div class="project-links">
                ${project.github ? `
                <a href="${project.github}" target="_blank" class="project-link">
                    <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                    </svg>
                    GitHub
                </a>
                ` : ''}
                ${project.demo ? `
                <a href="${project.demo}" target="_blank" class="project-link">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                    </svg>
                    Live Demo
                </a>
                ` : ''}
            </div>
        </div>
    `;
    
    return projectDiv;
}

// PhotoSwipe lightbox
function initializeLightbox() {
    // PhotoSwipe will be initialized when clicking on photos
    // The metadata modal provides the detailed view instead
}

// Smooth scrolling
function initializeSmoothScrolling() {
    const links = document.querySelectorAll('a[href^="#"]');
    
    links.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                const headerHeight = 80;
                const targetPosition = target.offsetTop - headerHeight;
                
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
}

// Utility functions
function formatDate(dateString) {
    if (!dateString) return 'Unknown';
    
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    } catch (error) {
        return dateString;
    }
}

function updateLastUpdatedDate() {
    const lastUpdatedElement = document.getElementById('last-updated');
    if (lastUpdatedElement) {
        const currentDate = new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        lastUpdatedElement.textContent = currentDate;
    }
}

// Sample data (fallback when JSON files don't exist)
function getSamplePhotographyData() {
    return [
        {
            id: "sample-1",
            filename: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80",
            title: "Mountain Landscape",
            category: "landscape",
            location: {
                name: "Swiss Alps",
                country: "Switzerland"
            },
            camera: {
                make: "Canon",
                model: "EOS R5",
                lens: "RF 24-70mm f/2.8L IS USM",
                settings: {
                    aperture: "f/8",
                    shutter: "1/125s",
                    iso: 200,
                    focal_length: "35mm"
                }
            },
            metadata: {
                date: "2024-03-15T17:30:00Z",
                filesize: "8.2MB",
                dimensions: "8192x5464"
            },
            comment: "A breathtaking sunrise over the Swiss Alps. The light was perfect that morning.",
            tags: ["landscape", "mountains", "sunrise", "nature"]
        },
        {
            id: "sample-2",
            filename: "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80",
            title: "City Streets",
            category: "street",
            location: {
                name: "Stockholm",
                country: "Sweden"
            },
            camera: {
                make: "Sony",
                model: "A7R IV",
                lens: "FE 35mm f/1.8",
                settings: {
                    aperture: "f/2.8",
                    shutter: "1/60s",
                    iso: 800,
                    focal_length: "35mm"
                }
            },
            metadata: {
                date: "2024-02-20T14:15:00Z",
                filesize: "6.8MB",
                dimensions: "7008x4672"
            },
            comment: "Captured the essence of Stockholm's old town during a winter afternoon.",
            tags: ["street", "urban", "stockholm", "winter"]
        },
        {
            id: "sample-3",
            filename: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80",
            title: "Portrait Session",
            category: "portrait",
            location: {
                name: "Studio",
                country: "Sweden"
            },
            camera: {
                make: "Canon",
                model: "EOS 5D Mark IV",
                lens: "EF 85mm f/1.8 USM",
                settings: {
                    aperture: "f/2.8",
                    shutter: "1/200s",
                    iso: 400,
                    focal_length: "85mm"
                }
            },
            metadata: {
                date: "2024-01-10T11:00:00Z",
                filesize: "12.1MB",
                dimensions: "6720x4480"
            },
            comment: "A professional portrait session with beautiful natural lighting.",
            tags: ["portrait", "studio", "professional", "natural light"]
        }
    ];
}

function getSampleProjectsData() {
    return [
        {
            id: "project-1",
            title: "Machine Learning Dashboard",
            description: "A comprehensive dashboard for visualizing machine learning model performance and metrics. Built with React and D3.js.",
            technologies: ["React", "D3.js", "Python", "Flask", "PostgreSQL"],
            github: "https://github.com/antonlu/ml-dashboard",
            demo: "https://ml-dashboard-demo.vercel.app",
            image: null
        },
        {
            id: "project-2",
            title: "Photography Portfolio API",
            description: "RESTful API for managing photography portfolios with EXIF data extraction and image processing capabilities.",
            technologies: ["Node.js", "Express", "MongoDB", "Sharp", "ExifReader"],
            github: "https://github.com/antonlu/photo-api",
            demo: null,
            image: null
        },
        {
            id: "project-3",
            title: "Deep Learning Research",
            description: "Research project on computational linguistics using transformer models for Swedish language processing.",
            technologies: ["Python", "PyTorch", "Transformers", "CUDA", "Jupyter"],
            github: "https://github.com/antonlu/swedish-nlp",
            demo: null,
            image: null
        }
    ];
}

// Close modal when clicking outside
window.addEventListener('click', function(e) {
    const modal = document.getElementById('photo-metadata-modal');
    if (e.target === modal) {
        closeMetadataModal();
    }
});

// Keyboard navigation
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeMetadataModal();
    }
});

// Make closeMetadataModal globally available
window.closeMetadataModal = closeMetadataModal;