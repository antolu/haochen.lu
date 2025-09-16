import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';

import { photos, projects } from '../api/client';

const HomePage: React.FC = () => {
  const { data: latestPhotos } = useQuery({
    queryKey: ['photos', 'latest'],
    queryFn: () => photos.list({ per_page: 6, order_by: 'created_at' }),
  });

  const { data: latestProjects } = useQuery({
    queryKey: ['projects', 'latest'],
    queryFn: () => projects.list({ status: 'active' }),
  });

  return (
    <div className="min-h-screen w-full m-0 p-0 mobile-safe">
      {/* Hero Section */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden">
        {/* Hero Background Image with responsive focal points:
             Mobile: 70% center (more to the right for portrait crops)
             Tablet: 60% center (balanced for medium screens)
             Desktop: 55% center (more centered for wide screens) */}
        <picture className="absolute inset-0 w-full h-full">
          <source media="(min-width: 1920px)" srcSet="/images/hero-xl.webp" type="image/webp" />
          <source media="(min-width: 1200px)" srcSet="/images/hero-lg.webp" type="image/webp" />
          <source media="(min-width: 768px)" srcSet="/images/hero-md.webp" type="image/webp" />
          <source media="(max-width: 767px)" srcSet="/images/hero-sm.webp" type="image/webp" />
          {/* JPEG fallback for browsers that don't support WebP */}
          <source media="(min-width: 1920px)" srcSet="/images/hero-xl.jpg" />
          <source media="(min-width: 1200px)" srcSet="/images/hero-lg.jpg" />
          <source media="(min-width: 768px)" srcSet="/images/hero-md.jpg" />
          <img
            src="/images/hero-lg.jpg"
            alt="Mountain landscape with person standing on ridge"
            className="w-full h-full object-cover hero-focal-point"
            loading="eager"
          />
        </picture>

        {/* Dark overlay for better text readability */}
        <div className="absolute inset-0 bg-gradient-to-br from-black/50 to-black/30"></div>

        <div className="relative z-10 text-center text-white px-4">
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-5xl md:text-7xl font-serif font-bold mb-4 animate-fade-in"
          >
            Anton Lu
          </motion.h1>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.3 }}
            className="text-xl md:text-2xl mb-12 animate-fade-in-delay"
          >
            <span className="block mb-2">Student. Traveler. Photographer.</span>
            <span className="text-lg opacity-90">Machine Learning at KTH Stockholm</span>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, delay: 0.6 }}
            className="flex flex-col sm:flex-row gap-4 sm:gap-8 justify-center items-center animate-fade-in-delay-2 px-4 max-w-full"
          >
            <Link
              to="/photography"
              className="bg-primary-600 hover:bg-primary-700 text-white px-6 sm:px-8 py-3 sm:py-4 rounded-lg transition-colors font-medium w-full sm:min-w-[200px] text-center"
            >
              Discover My Work
            </Link>
            <button
              onClick={() => {
                document.querySelector('#contact-section')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="border-2 border-white text-white hover:bg-white hover:text-gray-900 px-6 sm:px-8 py-3 sm:py-4 rounded-lg transition-colors font-medium w-full sm:min-w-[200px] text-center"
            >
              Get In Touch
            </button>
          </motion.div>
        </div>

        {/* Scroll indicator arrow - positioned at bottom right to avoid text overlap */}
        <div
          className="absolute bottom-8 right-8 text-white/70 hover:text-white animate-bounce-custom cursor-pointer transition-colors"
          onClick={() => {
            document.querySelector('#about-section')?.scrollIntoView({ behavior: 'smooth' });
          }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M19 14l-7 7m0 0l-7-7m7 7V3"
            ></path>
          </svg>
        </div>
      </section>

      {/* About Section */}
      <section id="about-section" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-serif font-bold mb-4">About Me</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Passionate about learning new things, whether it's machine learning algorithms,
              photography techniques, or exploring new cultures through travel.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="space-y-6"
            >
              <div className="prose prose-lg">
                <p className="text-gray-700 leading-relaxed">
                  My name is Anton (Hào-chen) Lu, and I'm a M.Sc. student at KTH Royal Institute of
                  Technology in Stockholm, Sweden. I'm currently enrolled in a five-year degree
                  programme in Engineering Physics, pursuing a M.Sc. in Machine Learning with
                  specialization in deep learning and computational linguistics.
                </p>
                <p className="text-gray-700 leading-relaxed">
                  My biggest passion is learning new things, whether it be a new problem solving
                  method, a new programming language, a new spoken language, or how to capture the
                  perfect moment through photography.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-lg shadow-sm">
                  <h3 className="font-semibold text-gray-900 mb-3">Interests</h3>
                  <ul className="space-y-2 text-gray-700">
                    <li>📸 Photography</li>
                    <li>🎮 Gaming</li>
                    <li>💻 Programming</li>
                    <li>🏊 Swimming</li>
                  </ul>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-sm">
                  <h3 className="font-semibold text-gray-900 mb-3">Skills</h3>
                  <ul className="space-y-2 text-gray-700">
                    <li>🤖 Machine Learning</li>
                    <li>📊 Data Science</li>
                    <li>🌐 Web Development</li>
                    <li>🎯 Deep Learning</li>
                  </ul>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="aspect-square bg-gradient-to-br from-primary-600 to-primary-800 rounded-2xl shadow-xl">
                <div className="flex items-center justify-center h-full text-white text-6xl font-light">
                  AL
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Featured Photography */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-4xl font-serif font-bold text-gray-900 mb-4">Latest Photography</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              My most recent captures from travels, adventures, and everyday moments.
            </p>
          </motion.div>

          {latestPhotos?.photos && latestPhotos.photos.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-10">
              {latestPhotos.photos.slice(0, 6).map((photo, index) => (
                <motion.div
                  key={photo.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  viewport={{ once: true }}
                  className="group cursor-pointer"
                >
                  <div className="aspect-square rounded-lg overflow-hidden bg-gray-200">
                    <img
                      src={`/${photo.thumbnail_path || photo.webp_path}`}
                      alt={photo.title}
                      className="w-full h-full object-cover group-hover:scale-102 md:group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          <div className="text-center">
            <Link
              to="/photography"
              className="inline-flex items-center px-8 py-4 bg-primary-600 text-white text-lg font-medium rounded-lg hover:bg-primary-700 transition-colors duration-200"
            >
              View Full Album
              <svg className="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M17 8l4 4m0 0l-4 4m4-4H3"
                />
              </svg>
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
            className="text-center mb-12"
          >
            <h2 className="text-4xl font-serif font-bold text-gray-900 mb-4">Latest Projects</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Recent projects and ongoing work that showcase my technical expertise and passion for
              development.
            </p>
          </motion.div>

          {latestProjects?.projects && latestProjects.projects.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
              {latestProjects.projects.slice(0, 4).map((project, index) => (
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
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">{project.title}</h3>
                    <p className="text-gray-600 mb-4 line-clamp-3">
                      {project.short_description || project.description}
                    </p>
                    {project.technologies && (
                      <div className="flex flex-wrap gap-2 mb-4">
                        {JSON.parse(project.technologies)
                          .slice(0, 3)
                          .map((tech: string) => (
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
              className="inline-flex items-center px-6 py-3 border border-primary-600 text-base font-medium rounded-md text-primary-600 hover:bg-primary-600 hover:text-white transition-colors duration-200"
            >
              View All Projects
            </Link>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact-section" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-24"
          >
            <h2 className="text-4xl md:text-5xl font-serif font-bold mb-4">Get In Touch</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              I'm always open to discussing new opportunities, collaborations, or just having a chat
              about photography and technology.
            </p>
          </motion.div>

          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-2xl shadow-lg p-8 md:p-12">
              <div className="text-center space-y-6">
                <div className="flex justify-center space-x-8">
                  <a
                    href="mailto:anton@haochen.lu"
                    className="flex items-center space-x-2 text-gray-700 hover:text-primary-600 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"></path>
                      <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"></path>
                    </svg>
                    <span>anton@haochen.lu</span>
                  </a>
                </div>

                <div className="flex justify-center space-x-6">
                  <a href="#" className="text-gray-400 hover:text-primary-600 transition-colors">
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z" />
                    </svg>
                  </a>
                  <a href="#" className="text-gray-400 hover:text-primary-600 transition-colors">
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
