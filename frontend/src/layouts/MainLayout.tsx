import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';

import { subapps } from '../api/client';
import { useAuthStore } from '../stores/authStore';

const MainLayout: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const { data: subAppsData } = useQuery({
    queryKey: ['subapps', isAuthenticated ? 'authenticated' : 'public'],
    queryFn: () => isAuthenticated ? subapps.listAuthenticated() : subapps.list(),
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

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex-shrink-0">
              <Link to="/" className="flex items-center">
                <h1 className="text-2xl font-serif font-bold text-gray-900">
                  Anton Lu
                </h1>
              </Link>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex space-x-8">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`px-3 py-2 text-sm font-medium transition-colors duration-200 ${
                    isActive(item.href)
                      ? 'text-primary-600 border-b-2 border-primary-600'
                      : 'text-gray-700 hover:text-primary-600'
                  }`}
                >
                  {item.name}
                </Link>
              ))}
              
              {/* Sub-apps dropdown or direct links */}
              {subAppsData?.subapps && subAppsData.subapps.length > 0 && (
                <div className="relative group">
                  <button className="px-3 py-2 text-sm font-medium text-gray-700 hover:text-primary-600 transition-colors duration-200">
                    Apps
                  </button>
                  <div className="absolute left-0 mt-2 w-56 bg-white rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                    <div className="py-1">
                      {subAppsData.subapps.map((app) => (
                        <a
                          key={app.id}
                          href={app.is_external ? app.url : `${app.url}`}
                          target={app.is_external ? '_blank' : '_self'}
                          rel={app.is_external ? 'noopener noreferrer' : undefined}
                          className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-primary-600 transition-colors duration-200"
                        >
                          {app.icon && (
                            <span className="mr-3 text-lg" style={{ color: app.color || undefined }}>
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
                className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                <span className="sr-only">Open main menu</span>
                {mobileMenuOpen ? (
                  <XMarkIcon className="block h-6 w-6" aria-hidden="true" />
                ) : (
                  <Bars3Icon className="block h-6 w-6" aria-hidden="true" />
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
                {navigation.map((item) => (
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
                    {subAppsData.subapps.map((app) => (
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
      <main>
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
              <div className="flex space-x-4">
                {/* Add social links here */}
              </div>
            </div>
            
            <div>
              <h4 className="text-lg font-semibold mb-4">Navigation</h4>
              <ul className="space-y-2">
                {navigation.map((item) => (
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
                <li>Email: hello@antonlu.com</li>
                <li>Location: Your City, Country</li>
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