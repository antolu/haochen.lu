import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
// Removed Heroicons import - using inline SVGs instead
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';

import { subapps, content } from '../api/client';
import { useAuthStore } from '../stores/authStore';

const MainLayout: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const location = useLocation();
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);

  // Enhanced scroll detection with granular positioning
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      setScrollY(currentScrollY);
    };

    // Add passive event listener for better performance
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Scroll-based states for different UI adaptations
  const isScrolled = scrollY > 10;

  const { data: subAppsData } = useQuery({
    queryKey: ['subapps', isAuthenticated ? 'authenticated' : 'public'],
    queryFn: () => (isAuthenticated ? subapps.listAuthenticated() : subapps.list()),
  });

  // Fetch footer content
  const { data: footerContent } = useQuery({
    queryKey: ['content', 'footer'],
    queryFn: () => content.getByKeys(['contact.cv_url']),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const navigation = [
    { name: 'Home', href: '/' },
    { name: 'Photography', href: '/photography' },
    { name: 'Projects', href: '/projects' },
    { name: 'Blog', href: '/blog' },
  ];

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  // Dynamic styles based on scroll position
  const headerHeight = isScrolled ? 'h-16' : 'h-24 md:h-28';

  // More dramatic logo scaling with font weight and letter spacing
  const logoClasses = isScrolled
    ? 'text-3xl md:text-5xl font-semibold tracking-tight'
    : 'text-4xl md:text-6xl font-black tracking-normal';

  // Enhanced navigation styling
  const navClasses = isScrolled
    ? 'text-xs md:text-sm font-medium tracking-normal'
    : 'text-base md:text-lg font-normal tracking-wide';

  const navPadding = isScrolled ? 'py-2' : 'py-3 md:py-4';

  return (
    <div className="min-h-screen bg-white mobile-safe">
      {/* Header */}
      <header
        className={`fixed top-0 w-full z-50 transition-all duration-500 ease-out ${
          isScrolled
            ? 'bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-200'
            : 'bg-white/80 backdrop-blur-sm'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div
            className={`flex justify-between items-center transition-all duration-500 ease-out ${headerHeight}`}
          >
            {/* Logo */}
            <div className="flex-shrink-0">
              <Link to="/" className="flex items-center">
                <h1
                  className={`font-serif text-gray-900 transition-all duration-300 ease-out ${logoClasses}`}
                >
                  Anton Lu
                </h1>
              </Link>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex space-x-8">
              {navigation.map(item => (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`nav-link px-3 transition-all duration-300 ease-out ${navPadding} ${navClasses} ${
                    isActive(item.href)
                      ? 'text-primary-600 active'
                      : 'text-gray-700 hover:text-primary-600'
                  }`}
                >
                  {item.name}
                </Link>
              ))}

              {/* Sub-apps dropdown or direct links */}
              {subAppsData?.subapps && subAppsData.subapps.length > 0 && (
                <div className="relative group">
                  <button
                    className={`px-3 text-gray-700 hover:text-primary-600 transition-all duration-300 ease-out ${navPadding} ${navClasses}`}
                  >
                    Apps
                  </button>
                  <div className="absolute left-0 mt-2 w-56 bg-white rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                    <div className="py-1">
                      {subAppsData.subapps.map(app => (
                        <a
                          key={app.id}
                          href={app.is_external ? app.url : `${app.url}`}
                          target={app.is_external ? '_blank' : '_self'}
                          rel={app.is_external ? 'noopener noreferrer' : undefined}
                          className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-primary-600 transition-colors duration-200"
                        >
                          {app.icon && (
                            <span
                              className="mr-3 text-lg"
                              style={{ color: app.color || undefined }}
                            >
                              {app.icon}
                            </span>
                          )}
                          <div>
                            <div className="font-medium">{app.name}</div>
                            {app.description && (
                              <div className="text-xs text-gray-500">{app.description}</div>
                            )}
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </nav>

            {/* Mobile menu button */}
            <div className="md:hidden">
              <button
                type="button"
                className="mobile-menu-button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                <span className="sr-only">Open main menu</span>
                {mobileMenuOpen ? (
                  <svg
                    className="block h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="1.5"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg
                    className="block h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="1.5"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="md:hidden border-t border-gray-200 bg-white"
            >
              <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
                {navigation.map(item => (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`block px-3 py-2 rounded-md text-base font-medium transition-colors duration-200 ${
                      isActive(item.href)
                        ? 'text-primary-600 bg-primary-50'
                        : 'text-gray-700 hover:text-primary-600 hover:bg-gray-50'
                    }`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {item.name}
                  </Link>
                ))}

                {/* Mobile sub-apps */}
                {subAppsData?.subapps && subAppsData.subapps.length > 0 && (
                  <div className="border-t border-gray-200 pt-3 mt-3">
                    <div className="px-3 py-2 text-sm font-medium text-gray-500 uppercase tracking-wider">
                      Applications
                    </div>
                    {subAppsData.subapps.map(app => (
                      <a
                        key={app.id}
                        href={app.is_external ? app.url : `${app.url}`}
                        target={app.is_external ? '_blank' : '_self'}
                        rel={app.is_external ? 'noopener noreferrer' : undefined}
                        className="flex items-center px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-primary-600 hover:bg-gray-50 transition-colors duration-200"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        {app.icon && (
                          <span className="mr-3" style={{ color: app.color || undefined }}>
                            {app.icon}
                          </span>
                        )}
                        {app.name}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Main content */}
      <main className="pt-20 md:pt-24">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="col-span-1 md:col-span-2">
              <h3 className="text-2xl font-serif font-bold mb-4">Anton Lu</h3>
              <p className="text-gray-300 mb-4 max-w-md">
                Capturing moments through the lens, sharing stories through code and words.
                Passionate about photography, technology, and creative expression.
              </p>
              <div className="flex space-x-4">{/* Add social links here */}</div>
            </div>

            <div>
              <h4 className="text-lg font-semibold mb-4">Navigation</h4>
              <ul className="space-y-2">
                {navigation.map(item => (
                  <li key={item.name}>
                    <Link
                      to={item.href}
                      className="text-gray-300 hover:text-white transition-colors duration-200"
                    >
                      {item.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-lg font-semibold mb-4">Contact</h4>
              <ul className="space-y-2 text-gray-300">
                <li>Email: anton@haochen.lu</li>
                <li>Location: Geneva, Switzerland</li>
                {footerContent?.['contact.cv_url']?.content && (
                  <li>
                    CV:{' '}
                    <a
                      href={footerContent['contact.cv_url'].content}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-300 hover:text-white transition-colors duration-200 underline"
                    >
                      Download CV
                    </a>
                  </li>
                )}
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; {new Date().getFullYear()} Anton Lu. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default MainLayout;
