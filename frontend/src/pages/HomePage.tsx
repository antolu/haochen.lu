import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';

import { photos, projects } from '../api/client';

const HomePage: React.FC = () => {
  const { data: featuredPhotos } = useQuery({
    queryKey: ['photos', 'featured'],
    queryFn: () => photos.getFeatured(6),
  });

  const { data: featuredProjects } = useQuery({
    queryKey: ['projects', 'featured'],
    queryFn: () => projects.getFeatured(),
  });

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative h-screen flex items-center justify-center bg-gradient-to-r from-gray-900 to-gray-700">
        <div className="absolute inset-0 bg-black opacity-50"></div>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="relative z-10 text-center text-white px-4"
        >
          <h1 className="text-5xl md:text-7xl font-serif font-bold mb-6">
            Anton Lu
          </h1>
          <p className="text-xl md:text-2xl mb-8 max-w-2xl mx-auto leading-relaxed">
            Photography • Technology • Creative Expression
          </p>
          <p className="text-lg mb-10 max-w-3xl mx-auto text-gray-300">
            Capturing moments through the lens, building solutions through code, and sharing stories that matter.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/photography"
              className="px-8 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors duration-200 font-medium"
            >
              View Photography
            </Link>
            <Link
              to="/projects"
              className="px-8 py-3 border border-white text-white rounded-lg hover:bg-white hover:text-gray-900 transition-colors duration-200 font-medium"
            >
              Explore Projects
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Featured Photography */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-serif font-bold text-gray-900 mb-4">
              Featured Photography
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              A curated selection of my favorite captures, each telling its own unique story.
            </p>
          </motion.div>

          {featuredPhotos && featuredPhotos.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
              {featuredPhotos.map((photo, index) => (
                <motion.div
                  key={photo.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  viewport={{ once: true }}
                  className="group cursor-pointer"
                >
                  <div className="aspect-w-4 aspect-h-3 rounded-lg overflow-hidden bg-gray-200">
                    <img
                      src={`/${photo.webp_path}`}
                      alt={photo.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  <div className="mt-4">
                    <h3 className="text-lg font-medium text-gray-900">{photo.title}</h3>
                    {photo.description && (
                      <p className="text-gray-600 text-sm mt-1 line-clamp-2">{photo.description}</p>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          <div className="text-center">
            <Link
              to="/photography"
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 transition-colors duration-200"
            >
              View All Photography
            </Link>
          </div>
        </div>
      </section>

      {/* Featured Projects */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-serif font-bold text-gray-900 mb-4">
              Featured Projects
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Innovative solutions and creative endeavors that showcase my technical expertise and passion for development.
            </p>
          </motion.div>

          {featuredProjects && featuredProjects.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
              {featuredProjects.slice(0, 4).map((project, index) => (
                <motion.div
                  key={project.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  viewport={{ once: true }}
                  className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300"
                >
                  {project.image_url && (
                    <div className="h-48 bg-gray-200">
                      <img
                        src={project.image_url}
                        alt={project.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="p-6">
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      {project.title}
                    </h3>
                    <p className="text-gray-600 mb-4 line-clamp-3">
                      {project.short_description || project.description}
                    </p>
                    {project.technologies && (
                      <div className="flex flex-wrap gap-2 mb-4">
                        {JSON.parse(project.technologies).slice(0, 3).map((tech: string) => (
                          <span
                            key={tech}
                            className="px-2 py-1 bg-primary-100 text-primary-700 text-xs rounded-full"
                          >
                            {tech}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex space-x-4">
                      {project.github_url && (
                        <a
                          href={project.github_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                        >
                          View Code
                        </a>
                      )}
                      {project.demo_url && (
                        <a
                          href={project.demo_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                        >
                          Live Demo
                        </a>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          <div className="text-center">
            <Link
              to="/projects"
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 transition-colors duration-200"
            >
              View All Projects
            </Link>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center"
          >
            <h2 className="text-4xl font-serif font-bold text-gray-900 mb-8">
              About
            </h2>
            <p className="text-lg text-gray-700 leading-relaxed mb-8">
              I'm a passionate photographer and developer who finds beauty in both captured moments 
              and elegant code. My work spans across visual storytelling through photography and 
              building innovative digital solutions that make a difference.
            </p>
            <p className="text-lg text-gray-700 leading-relaxed mb-10">
              Whether I'm behind the lens or behind the keyboard, I strive to create work that 
              not only meets technical excellence but also tells a compelling story.
            </p>
            <Link
              to="/blog"
              className="inline-flex items-center px-6 py-3 border border-primary-600 text-base font-medium rounded-md text-primary-600 hover:bg-primary-600 hover:text-white transition-colors duration-200"
            >
              Read My Blog
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;