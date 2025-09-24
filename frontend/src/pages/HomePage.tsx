import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";

import { photos, projects, content, heroImages } from "../api/client";
import type { Photo } from "../types";
import { formatDate } from "../utils/dateFormat";
import { selectOptimalImage, ImageUseCase } from "../utils/imageUtils";
import ProfilePictureDisplay from "../components/ProfilePictureDisplay";

const HomePage: React.FC = () => {
  const { data: latestPhotos } = useQuery({
    queryKey: ["photos", "latest"],
    queryFn: () => photos.list({ per_page: 6, order_by: "created_at" }),
  });

  const { data: latestProjects } = useQuery({
    queryKey: ["projects", "latest"],
    queryFn: () => projects.list({ status: "active" }),
  });

  // Fetch active hero image
  const { data: activeHeroImage } = useQuery({
    queryKey: ["hero-images", "active"],
    queryFn: () => heroImages.getActive(),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Fetch all homepage content
  const { data: homeContent } = useQuery({
    queryKey: ["content", "homepage"],
    queryFn: () =>
      content.getByKeys([
        "hero.tagline",
        "hero.subtitle",
        "about.title",
        "about.description",
        "about.interests_title",
        "about.skills_title",
        "photography.title",
        "photography.description",
        "projects.title",
        "projects.description",
        "contact.title",
        "contact.description",
        "social.linkedin_url",
        "social.google_scholar_url",
      ]),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedPhoto(null);
    };
    if (selectedPhoto) window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedPhoto]);

  return (
    <div className="min-h-screen w-full m-0 p-0 mobile-safe">
      {/* Hero Section */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden">
        {/* Dynamic Hero Background Image */}
        {activeHeroImage ? (
          (() => {
            const optimalImage = selectOptimalImage(
              activeHeroImage.photo,
              ImageUseCase.HERO,
            );

            // Generate responsive focal points with fallbacks
            const mobileFocalPoint = activeHeroImage.focal_points_responsive
              ?.mobile || {
              x: activeHeroImage.focal_point_x,
              y: activeHeroImage.focal_point_y,
            };
            const tabletFocalPoint = activeHeroImage.focal_points_responsive
              ?.tablet || {
              x: activeHeroImage.focal_point_x,
              y: activeHeroImage.focal_point_y,
            };
            const desktopFocalPoint = activeHeroImage.focal_points_responsive
              ?.desktop || {
              x: activeHeroImage.focal_point_x,
              y: activeHeroImage.focal_point_y,
            };

            return (
              <div
                className="absolute inset-0 w-full h-full hero-image-container"
                style={
                  {
                    "--hero-mobile-x": `${mobileFocalPoint.x}%`,
                    "--hero-mobile-y": `${mobileFocalPoint.y}%`,
                    "--hero-tablet-x": `${tabletFocalPoint.x}%`,
                    "--hero-tablet-y": `${tabletFocalPoint.y}%`,
                    "--hero-desktop-x": `${desktopFocalPoint.x}%`,
                    "--hero-desktop-y": `${desktopFocalPoint.y}%`,
                  } as React.CSSProperties
                }
              >
                <img
                  src={optimalImage.url}
                  srcSet={optimalImage.srcset}
                  sizes={optimalImage.sizes}
                  alt={activeHeroImage.photo.title || "Hero image"}
                  className="w-full h-full object-cover dynamic-hero-focal-point"
                  loading="eager"
                />
              </div>
            );
          })()
        ) : (
          /* Fallback to static hero image */
          <picture className="absolute inset-0 w-full h-full">
            <source
              media="(min-width: 1920px)"
              srcSet="/images/hero-xl.webp"
              type="image/webp"
            />
            <source
              media="(min-width: 1200px)"
              srcSet="/images/hero-lg.webp"
              type="image/webp"
            />
            <source
              media="(min-width: 768px)"
              srcSet="/images/hero-md.webp"
              type="image/webp"
            />
            <source
              media="(max-width: 767px)"
              srcSet="/images/hero-sm.webp"
              type="image/webp"
            />
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
        )}

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
            <span className="block mb-2">
              {homeContent?.["hero.tagline"]?.content ??
                "Student. Traveler. Photographer."}
            </span>
            <span className="text-lg opacity-90">
              {homeContent?.["hero.subtitle"]?.content ??
                "Machine Learning at KTH Stockholm"}
            </span>
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
                document
                  .querySelector("#contact-section")
                  ?.scrollIntoView({ behavior: "smooth" });
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
            document
              .querySelector("#about-section")
              ?.scrollIntoView({ behavior: "smooth" });
          }}
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
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
            <h2 className="text-4xl md:text-5xl font-serif font-bold mb-4">
              {homeContent?.["about.title"]?.content ?? "About Me"}
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              {homeContent?.["about.description"]?.content ??
                "Passionate about learning new things, whether it's machine learning algorithms, photography techniques, or exploring new cultures through travel."}
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
                  My name is Anton (Hào-chen) Lu, and I'm a M.Sc. student at KTH
                  Royal Institute of Technology in Stockholm, Sweden. I'm
                  currently enrolled in a five-year degree programme in
                  Engineering Physics, pursuing a M.Sc. in Machine Learning with
                  specialization in deep learning and computational linguistics.
                </p>
                <p className="text-gray-700 leading-relaxed">
                  My biggest passion is learning new things, whether it be a new
                  problem solving method, a new programming language, a new
                  spoken language, or how to capture the perfect moment through
                  photography.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-lg shadow-sm">
                  <h3 className="font-semibold text-gray-900 mb-3">
                    {homeContent?.["about.interests_title"]?.content ??
                      "Interests"}
                  </h3>
                  <ul className="space-y-2 text-gray-700">
                    <li>📸 Photography</li>
                    <li>🎮 Gaming</li>
                    <li>💻 Programming</li>
                    <li>🏊 Swimming</li>
                  </ul>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-sm">
                  <h3 className="font-semibold text-gray-900 mb-3">
                    {homeContent?.["about.skills_title"]?.content ?? "Skills"}
                  </h3>
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
              <div className="aspect-square rounded-2xl shadow-xl overflow-hidden">
                <ProfilePictureDisplay
                  className="w-full h-full rounded-2xl"
                  fallback="AL"
                  size="large"
                />
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
            <h2 className="text-4xl font-serif font-bold text-gray-900 mb-4">
              {homeContent?.["photography.title"]?.content ??
                "Latest Photography"}
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              {homeContent?.["photography.description"]?.content ??
                "My most recent captures from travels, adventures, and everyday moments."}
            </p>
          </motion.div>

          {latestPhotos?.photos && latestPhotos.photos.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-10">
              {latestPhotos.photos.slice(0, 6).map((photo, index) => (
                <motion.button
                  key={photo.id}
                  type="button"
                  onClick={() => setSelectedPhoto(photo)}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  viewport={{ once: true }}
                  className="group cursor-pointer text-left"
                >
                  <div className="aspect-square rounded-lg overflow-hidden bg-gray-200">
                    {(() => {
                      // Use DPI-aware selection for hero/gallery display
                      const optimalImage = selectOptimalImage(
                        photo,
                        ImageUseCase.HERO,
                      );
                      return (
                        <img
                          src={optimalImage.url}
                          srcSet={optimalImage.srcset}
                          sizes={optimalImage.sizes}
                          alt={photo.title ?? "Photo"}
                          className="w-full h-full object-cover group-hover:scale-102 md:group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                      );
                    })()}
                  </div>
                </motion.button>
              ))}
            </div>
          )}

          <div className="text-center">
            <Link
              to="/photography"
              className="inline-flex items-center px-8 py-4 bg-primary-600 text-white text-lg font-medium rounded-lg hover:bg-primary-700 transition-colors duration-200"
            >
              View Photography
              <svg
                className="ml-2 w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
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
            <h2 className="text-4xl font-serif font-bold text-gray-900 mb-4">
              {homeContent?.["projects.title"]?.content ?? "Latest Projects"}
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              {homeContent?.["projects.description"]?.content ??
                "Recent projects and ongoing work that showcase my technical expertise and passion for development."}
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
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      {project.title}
                    </h3>
                    <p className="text-gray-600 mb-4 line-clamp-3">
                      {project.short_description ?? project.description}
                    </p>
                    {project.technologies && (
                      <div className="flex flex-wrap gap-2 mb-4">
                        {(JSON.parse(project.technologies) as string[])
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
            <h2 className="text-4xl md:text-5xl font-serif font-bold mb-4">
              {homeContent?.["contact.title"]?.content ?? "Get In Touch"}
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              {homeContent?.["contact.description"]?.content ??
                "I'm always open to discussing new opportunities, collaborations, or just having a chat about photography and technology."}
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
                    <svg
                      className="w-5 h-5"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"></path>
                      <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"></path>
                    </svg>
                    <span>anton@haochen.lu</span>
                  </a>
                </div>

                <div className="flex justify-center space-x-6">
                  {homeContent?.["social.linkedin_url"]?.content && (
                    <a
                      href={homeContent["social.linkedin_url"].content}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-primary-600 transition-colors"
                    >
                      <svg
                        className="w-6 h-6"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                      </svg>
                    </a>
                  )}
                  {homeContent?.["social.google_scholar_url"]?.content && (
                    <a
                      href={homeContent["social.google_scholar_url"].content}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-primary-600 transition-colors"
                    >
                      <svg
                        className="w-6 h-6"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M5.242 13.769L0 9.5 12 0l12 9.5-5.242 4.269C17.548 11.249 14.978 9.5 12 9.5c-2.977 0-5.548 1.748-6.758 4.269zM12 10a7 7 0 1 0 0 14 7 7 0 0 0 0-14z" />
                      </svg>
                    </a>
                  )}
                  <a
                    href="#"
                    className="text-gray-400 hover:text-primary-600 transition-colors"
                  >
                    <svg
                      className="w-6 h-6"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z" />
                    </svg>
                  </a>
                  <a
                    href="#"
                    className="text-gray-400 hover:text-primary-600 transition-colors"
                  >
                    <svg
                      className="w-6 h-6"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Photo Metadata Modal */}
      <AnimatePresence>
        {selectedPhoto && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="absolute inset-0 bg-black/60"
              onClick={() => setSelectedPhoto(null)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            />

            <motion.div
              className="relative bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto"
              role="dialog"
              aria-modal="true"
              initial={{ opacity: 0, scale: 0.98, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 8 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex items-center justify-between p-4 border-b">
                <h3 className="text-lg font-semibold truncate">
                  {selectedPhoto.title ?? "Photo"}
                </h3>
                <button
                  onClick={() => setSelectedPhoto(null)}
                  className="text-gray-500 hover:text-gray-700"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>

              <div className="p-6 grid md:grid-cols-2 gap-6">
                <button
                  type="button"
                  onClick={() => {
                    void navigate("/photography", {
                      state: { photoId: selectedPhoto.id },
                    });
                    setSelectedPhoto(null);
                  }}
                  className="block text-left"
                  aria-label="Open in album"
                >
                  {(() => {
                    // Use DPI-aware selection for modal display
                    const optimalImage = selectOptimalImage(
                      selectedPhoto,
                      ImageUseCase.LIGHTBOX,
                    );
                    return (
                      <img
                        src={optimalImage.url}
                        srcSet={optimalImage.srcset}
                        sizes={optimalImage.sizes}
                        alt={selectedPhoto.title ?? "Photo"}
                        className="w-full h-80 object-cover rounded-lg"
                      />
                    );
                  })()}
                  <div className="mt-2 text-xs text-gray-500">
                    Open in album →
                  </div>
                </button>

                <div className="space-y-5 text-sm">
                  {selectedPhoto.description && (
                    <div>
                      <div className="text-gray-900 font-medium mb-1">
                        About
                      </div>
                      <p className="text-gray-700 leading-relaxed">
                        {selectedPhoto.description}
                      </p>
                    </div>
                  )}

                  {selectedPhoto.date_taken && (
                    <div>
                      <div className="text-gray-500">Date taken</div>
                      <div className="text-gray-800">
                        {formatDate(selectedPhoto.date_taken)}
                      </div>
                    </div>
                  )}

                  {/* eslint-disable @typescript-eslint/prefer-nullish-coalescing */}
                  {(selectedPhoto.camera_display_name ||
                    selectedPhoto.camera_make ||
                    selectedPhoto.camera_model) && (
                    <div>
                      <div className="text-gray-500">Camera</div>
                      <div className="text-gray-800">
                        {selectedPhoto.camera_display_name ??
                          `${selectedPhoto.camera_make ?? ""} ${selectedPhoto.camera_model ?? ""}`.trim()}
                      </div>
                    </div>
                  )}
                  {(selectedPhoto.lens_display_name ?? selectedPhoto.lens) && (
                    <div>
                      <div className="text-gray-500">Lens</div>
                      <div className="text-gray-800">
                        {selectedPhoto.lens_display_name ?? selectedPhoto.lens}
                      </div>
                    </div>
                  )}
                  {/* eslint-enable @typescript-eslint/prefer-nullish-coalescing */}

                  {/* eslint-disable @typescript-eslint/prefer-nullish-coalescing */}
                  {(selectedPhoto.aperture ||
                    selectedPhoto.shutter_speed ||
                    selectedPhoto.iso ||
                    selectedPhoto.focal_length) && (
                    <div>
                      <div className="text-gray-500">Settings</div>
                      <div className="text-gray-800">
                        {selectedPhoto.aperture
                          ? `f/${selectedPhoto.aperture}`
                          : ""}
                        {selectedPhoto.shutter_speed
                          ? ` • ${selectedPhoto.shutter_speed}s`
                          : ""}
                        {selectedPhoto.iso ? ` • ISO ${selectedPhoto.iso}` : ""}
                        {selectedPhoto.focal_length
                          ? ` • ${selectedPhoto.focal_length}mm`
                          : ""}
                      </div>
                    </div>
                  )}
                  {/* eslint-enable @typescript-eslint/prefer-nullish-coalescing */}

                  {typeof selectedPhoto.location_lat === "number" &&
                    typeof selectedPhoto.location_lon === "number" && (
                      <div>
                        <div className="text-gray-500">Location</div>
                        <div className="text-gray-800">
                          {selectedPhoto.location_name ?? "Unknown"}
                          <div className="text-xs text-gray-500">
                            {selectedPhoto.location_lat.toFixed(6)},{" "}
                            {selectedPhoto.location_lon.toFixed(6)}
                          </div>
                        </div>
                      </div>
                    )}

                  {selectedPhoto.tags && (
                    <div>
                      <div className="text-gray-500">Tags</div>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {selectedPhoto.tags.split(",").map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs"
                          >
                            {tag.trim()}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default HomePage;
