# Anton Lu - Photography & Portfolio Website

A modern, responsive personal website showcasing photography portfolio with rich metadata display and coding projects. Now features a **complete backend system** for uploading photos with automatic EXIF extraction and dynamic content management.

## ✨ New Features

### 🚀 Backend Content Management
- **Photo Upload System**: Drag & drop interface with automatic EXIF extraction
- **Real-time Content Management**: Add/edit/delete photos and projects through web interface
- **Automatic Image Processing**: EXIF data extraction including GPS coordinates
- **RESTful API**: Full CRUD operations for photos and projects
- **Image Optimization**: Automatic image resizing and compression with Sharp

### 📸 Enhanced Photography Portfolio
- **Rich Metadata Display**: Camera settings, location, equipment details
- **Interactive Gallery**: PhotoSwipe-powered lightbox with touch support
- **Category Filtering**: Landscape, portrait, street, travel categories
- **GPS Integration**: Automatic coordinate extraction from EXIF data
- **Admin Dashboard**: Upload and manage photos directly through web interface

### 💻 Dynamic Project Management
- **Web-based Project Creation**: Add projects through admin interface
- **Technology Stack Tracking**: Automatic technology tagging
- **GitHub Integration**: Direct links to source code
- **Status Management**: Track project completion status

## 🛠 Technical Stack

### Backend
- **Node.js/Express** - Server framework
- **Multer** - File upload handling
- **ExifR** - EXIF data extraction
- **Sharp** - Image processing and optimization
- **UUID** - Unique identifier generation

### Frontend
- **Vanilla JavaScript** - No framework dependencies
- **Tailwind CSS** - Utility-first styling
- **PhotoSwipe** - Lightbox functionality
- **Responsive Design** - Mobile-first approach

## 🚀 Getting Started

### Prerequisites
- Node.js 16+ and npm
- Modern web browser

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd haochen.lu
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment setup**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Access the application**
   - Frontend: `http://localhost:3000`
   - Admin Panel: `http://localhost:3000/admin/content-manager.html`

### Production Deployment

1. **Set environment variables**
   ```bash
   NODE_ENV=production
   PORT=3000
   ```

2. **Start the server**
   ```bash
   npm start
   ```

3. **Configure nginx** (optional)
   ```bash
   cp nginx.conf.example /etc/nginx/sites-available/haochen.lu
   # Edit paths and SSL certificates
   sudo ln -s /etc/nginx/sites-available/haochen.lu /etc/nginx/sites-enabled/
   sudo nginx -t && sudo systemctl reload nginx
   ```

## 📁 Project Structure

```
/
├── server/                     # Backend Node.js application
│   ├── app.js                 # Main server file
│   └── routes/                # API route handlers
│       ├── upload.js          # Photo upload with EXIF extraction
│       ├── photos.js          # Photo CRUD operations
│       └── projects.js        # Project CRUD operations
├── admin/
│   └── content-manager.html   # Web-based admin interface
├── assets/
│   ├── css/custom.css        # Custom styles
│   ├── js/main.js            # Frontend application logic
│   └── images/               # Uploaded images
│       ├── portfolio/        # Photography portfolio images
│       └── projects/         # Project screenshots
├── data/                     # JSON data files (auto-managed)
│   ├── photography.json      # Photo metadata
│   └── projects.json         # Project data
├── index.html               # Main website
├── package.json             # Node.js dependencies
└── nginx.conf.example       # Production nginx configuration
```

## 🎯 API Endpoints

### Photos
- `GET /api/photos` - List all photos (with filtering/pagination)
- `GET /api/photos/:id` - Get single photo
- `POST /api/upload/photo` - Upload photo with EXIF extraction
- `PUT /api/photos/:id` - Update photo metadata
- `DELETE /api/photos/:id` - Delete photo
- `GET /api/photos/stats/overview` - Photo statistics

### Projects
- `GET /api/projects` - List all projects
- `GET /api/projects/:id` - Get single project
- `POST /api/projects` - Create new project
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project
- `GET /api/projects/stats/overview` - Project statistics

## 📊 Content Management

### Photo Upload Process
1. **Drag & Drop**: Select image files in admin interface
2. **Preview**: Immediate preview with basic file information
3. **Metadata Entry**: Add title, category, comments, and tags
4. **Upload**: Automatic EXIF extraction and image processing
5. **Storage**: Optimized images saved to `/assets/images/portfolio/`

### Automatic EXIF Extraction
- **Camera Settings**: Aperture, shutter speed, ISO, focal length
- **Equipment**: Camera make/model, lens information
- **GPS Coordinates**: Latitude/longitude if available
- **Metadata**: File size, dimensions, capture date
- **Image Processing**: Auto-rotation, compression, optimization

### Project Management
- Add projects through web interface
- Technology stack tracking
- GitHub and demo URL integration
- Status management (completed, in-progress, planned)

## 🔒 Security Features

- **Rate Limiting**: Upload and API request throttling
- **File Validation**: Image type and size restrictions
- **Input Sanitization**: XSS protection
- **CORS Configuration**: Controlled cross-origin access
- **Helmet Security Headers**: Standard security headers

## 🎨 Customization

### Styling
- Colors: Update Tailwind config in `index.html`
- Fonts: Modify Google Fonts imports
- Custom CSS: Add styles to `assets/css/custom.css`

### Content Categories
- Photography: landscape, portrait, street, travel
- Projects: web-development, machine-learning, mobile-development, etc.

## 📱 Mobile Responsiveness

- **Mobile-First Design**: Optimized for all device sizes
- **Touch-Friendly Interface**: Drag & drop works on mobile
- **Responsive Gallery**: Adaptive photo grid
- **Mobile Upload**: Full upload functionality on mobile devices

## 🔧 Development

### Available Scripts
- `npm start` - Start production server
- `npm run dev` - Start development server with auto-reload
- `npm test` - Run tests (placeholder)

### Environment Variables
- `NODE_ENV` - Environment (development/production)
- `PORT` - Server port (default: 3000)
- `MAX_FILE_SIZE` - Maximum upload size (default: 50MB)
- `CORS_ORIGINS` - Allowed CORS origins

## 🚀 Deployment Options

### Static + API Hosting
- Frontend: Netlify, Vercel, GitHub Pages
- Backend: Heroku, DigitalOcean, AWS

### Full Stack Hosting
- Single server deployment with nginx reverse proxy
- Docker containerization ready
- PM2 process management recommended

## 📈 Performance Features

- **Image Optimization**: Automatic compression with Sharp
- **Caching Headers**: Optimized cache strategies
- **Lazy Loading**: Progressive image loading
- **CDN Ready**: External image URL support
- **Gzip Compression**: Nginx configuration included

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

This project is open source. Feel free to use it as a template for your own portfolio.

---

Built with ❤️ by Anton Lu. Now featuring a complete backend system for seamless content management.