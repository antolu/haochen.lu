# Anton Lu - Photography & Portfolio Website

A modern, responsive personal website showcasing photography portfolio with rich metadata display and coding projects.

## ✨ Features

### 📸 Photography Portfolio
- **Rich Metadata Display**: Camera settings, location, equipment details
- **Interactive Gallery**: PhotoSwipe-powered lightbox with touch support
- **Category Filtering**: Landscape, portrait, street, travel categories
- **Mobile-Responsive**: Optimized for all device sizes
- **EXIF Integration**: Automatic metadata extraction support
- **Lazy Loading**: Performance-optimized image loading

### 💻 Project Showcase
- **Dynamic Project Grid**: Responsive layout for coding projects
- **Technology Tags**: Visual representation of tech stack
- **GitHub Integration**: Direct links to source code
- **Live Demos**: Links to deployed applications

### 🎨 Modern Design
- **Mobile-First**: Responsive design starting from 320px
- **Tailwind CSS**: Utility-first styling approach
- **Smooth Animations**: Subtle transitions and hover effects
- **Accessibility**: WCAG 2.1 compliant, keyboard navigation
- **Performance**: Optimized for fast loading

### 🛠 Content Management
- **JSON-Based**: Easy content updates via JSON files
- **Admin Interface**: Simple web-based content manager
- **Image Support**: Local and external image hosting
- **SEO Optimized**: Meta tags and structured data

## 🚀 Quick Start

### Prerequisites
- Web server (nginx, Apache, or local development server)
- Modern web browser with JavaScript enabled

### Installation

1. **Clone or download** this repository to your web server directory
2. **Configure your web server** to serve the files (see nginx.conf.example)
3. **Update content** by editing JSON files or using the admin interface
4. **Add your images** to the `assets/images/portfolio/` directory

### Local Development

```bash
# Start a local development server
python3 -m http.server 8000

# Or use Node.js
npx serve .

# Or use PHP
php -S localhost:8000
```

Visit `http://localhost:8000` to view the site.

## 📁 Project Structure

```
/
├── index.html                 # Main landing page
├── assets/
│   ├── css/
│   │   └── custom.css        # Custom styles and responsive design
│   ├── js/
│   │   └── main.js           # Main application logic
│   └── images/
│       ├── portfolio/        # Photography portfolio images
│       └── projects/         # Project screenshot images
├── data/
│   ├── photography.json      # Photography portfolio data
│   └── projects.json         # Coding projects data
├── admin/
│   └── content-manager.html  # Content management interface
├── nginx.conf.example        # Nginx configuration template
└── README.md                 # This file
```

## 📊 Content Management

### Adding Photography

1. **Via Admin Interface**: Visit `/admin/content-manager.html`
2. **Manual JSON Edit**: Edit `/data/photography.json`

#### Photo Object Structure:
```json
{
  "id": "unique-photo-id",
  "filename": "photo.jpg",
  "title": "Photo Title",
  "category": "landscape|portrait|street|travel",
  "location": {
    "name": "Location Name",
    "country": "Country"
  },
  "camera": {
    "make": "Camera Make",
    "model": "Camera Model",
    "lens": "Lens Model",
    "settings": {
      "aperture": "f/5.6",
      "shutter": "1/125s",
      "iso": 400,
      "focal_length": "50mm"
    }
  },
  "metadata": {
    "date": "2024-01-01T12:00:00Z",
    "filesize": "5.0MB",
    "dimensions": "1920x1080"
  },
  "comment": "Your comment about this photo",
  "tags": ["tag1", "tag2"]
}
```

### Adding Projects

1. **Via Admin Interface**: Use the projects section in content manager
2. **Manual JSON Edit**: Edit `/data/projects.json`

#### Project Object Structure:
```json
{
  "id": "unique-project-id",
  "title": "Project Title",
  "description": "Project description",
  "technologies": ["React", "Node.js", "MongoDB"],
  "github": "https://github.com/username/repo",
  "demo": "https://demo-url.com",
  "status": "completed|in-progress",
  "year": "2024",
  "category": "web-development|machine-learning|mobile-development"
}
```

## 🔧 Customization

### Styling
- **Colors**: Update Tailwind config in `index.html` (lines 30-46)
- **Fonts**: Modify Google Fonts imports in the head section
- **Custom CSS**: Add styles to `assets/css/custom.css`

### Content
- **About Section**: Edit the about section in `index.html` (lines 117-174)
- **Contact Info**: Update contact details (lines 252-258)
- **Social Links**: Add your social media URLs (lines 262-278)

### Hero Section
- **Background Image**: Replace hero background in `custom.css` (line 4)
- **Text**: Update hero text in `index.html` (lines 92-107)

## 🌐 Deployment

### Nginx Configuration
1. Copy `nginx.conf.example` to your nginx sites directory
2. Update paths and SSL certificate locations
3. Restart nginx: `sudo systemctl restart nginx`

### Performance Optimization
- **Image Compression**: Optimize images before upload
- **CDN**: Consider using a CDN for images
- **Caching**: Nginx config includes optimal cache headers
- **Gzip**: Compression enabled for all text assets

## 📱 Mobile Responsiveness

The site is built mobile-first with breakpoints:
- **Mobile**: 320px - 768px
- **Tablet**: 768px - 1024px  
- **Desktop**: 1024px+

## 🔍 SEO Features

- **Meta Tags**: Comprehensive meta tags for social sharing
- **Structured Data**: JSON-LD markup for search engines
- **Sitemap**: XML sitemap for search engine indexing
- **Performance**: Fast loading for better search rankings

## 📈 Analytics & Monitoring

To add analytics:
1. **Google Analytics**: Add tracking code to `index.html`
2. **Google Search Console**: Verify site ownership
3. **Performance Monitoring**: Consider adding Core Web Vitals tracking

## 🔒 Security

- **Content Security Policy**: Configured in nginx
- **HTTPS Only**: Redirect HTTP to HTTPS
- **Admin Protection**: Basic auth for admin interface (optional)

## 🛠 Tech Stack

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Styling**: Tailwind CSS
- **Gallery**: PhotoSwipe
- **EXIF**: ExifReader.js
- **Server**: Nginx (recommended)

## 📄 License

This project is open source. Feel free to use it as a template for your own portfolio.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📞 Support

For questions or issues:
- Email: anton@haochen.lu
- GitHub: Create an issue in the repository

## 🚀 Roadmap

Future enhancements:
- [ ] Blog integration
- [ ] Multi-language support
- [ ] Advanced image editing
- [ ] Social media integration
- [ ] Comment system
- [ ] Search functionality
- [ ] Progressive Web App features

---

Built with ❤️ by Anton Lu