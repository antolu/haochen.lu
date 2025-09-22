/**
 * P1 - Frontend Component Tests: Navigation
 *
 * Tests for navigation components including responsive behavior,
 * authentication states, and accessibility.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders, mockUser, mockAdminUser } from '../utils';

// Mock navigation components
const MockNavigation = ({
  user = null,
  onLogin,
  onLogout,
  currentPath = '/',
  isMobile = false,
}: {
  user?: { is_admin?: boolean };
  onLogin?: () => void;
  onLogout?: () => void;
  currentPath?: string;
  isMobile?: boolean;
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const navLinks = [
    { path: '/', label: 'Home', public: true },
    { path: '/gallery', label: 'Gallery', public: true },
    { path: '/projects', label: 'Projects', public: true },
    { path: '/blog', label: 'Blog', public: true },
    { path: '/about', label: 'About', public: true },
    { path: '/admin', label: 'Admin', public: false, adminOnly: true },
  ];

  const visibleLinks = navLinks.filter(link => {
    if (link.public) return true;
    if (link.adminOnly) return user?.is_admin;
    return !!user;
  });

  return (
    <nav data-testid="main-navigation" className="bg-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <a href="/" data-testid="logo" className="text-xl font-bold">
              Portfolio
            </a>
          </div>

          {/* Desktop Navigation */}
          {!isMobile && (
            <div className="hidden md:flex items-center space-x-8" data-testid="desktop-nav">
              {visibleLinks.map(link => (
                <a
                  key={link.path}
                  href={link.path}
                  data-testid={`nav-link-${link.path.replace('/', '') || 'home'}`}
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    currentPath === link.path
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                  aria-current={currentPath === link.path ? 'page' : undefined}
                >
                  {link.label}
                </a>
              ))}

              {/* Auth buttons */}
              <div className="flex items-center space-x-4" data-testid="auth-section">
                {user ? (
                  <div className="flex items-center space-x-4">
                    <span data-testid="user-greeting" className="text-sm text-gray-700">
                      Hello, {user.full_name ?? user.username}
                    </span>
                    {user.is_admin && (
                      <span
                        data-testid="admin-badge"
                        className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded"
                      >
                        Admin
                      </span>
                    )}
                    <button
                      onClick={onLogout}
                      data-testid="logout-button"
                      className="text-sm text-gray-700 hover:text-gray-900"
                    >
                      Logout
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={onLogin}
                    data-testid="login-button"
                    className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
                  >
                    Login
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Mobile menu button */}
          {isMobile && (
            <div className="md:hidden flex items-center">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                data-testid="mobile-menu-button"
                className="text-gray-700 hover:text-gray-900 focus:outline-none focus:text-gray-900 p-2"
                aria-label="Toggle mobile menu"
                aria-expanded={mobileMenuOpen}
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {mobileMenuOpen ? (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  ) : (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 6h16M4 12h16M4 18h16"
                    />
                  )}
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Mobile Navigation */}
        {isMobile && mobileMenuOpen && (
          <div data-testid="mobile-nav" className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1">
              {visibleLinks.map(link => (
                <a
                  key={link.path}
                  href={link.path}
                  data-testid={`mobile-nav-link-${link.path.replace('/', '') || 'home'}`}
                  className={`block px-3 py-2 rounded-md text-base font-medium ${
                    currentPath === link.path
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link.label}
                </a>
              ))}

              {/* Mobile auth section */}
              <div className="border-t pt-4 mt-4" data-testid="mobile-auth-section">
                {user ? (
                  <div className="space-y-2">
                    <div className="px-3 py-2 text-sm text-gray-700">
                      Hello, {user.full_name ?? user.username}
                      {user.is_admin && (
                        <span className="ml-2 px-2 py-1 bg-red-100 text-red-800 text-xs rounded">
                          Admin
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        onLogout?.();
                        setMobileMenuOpen(false);
                      }}
                      data-testid="mobile-logout-button"
                      className="block w-full text-left px-3 py-2 text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50"
                    >
                      Logout
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      onLogin?.();
                      setMobileMenuOpen(false);
                    }}
                    data-testid="mobile-login-button"
                    className="block w-full text-left px-3 py-2 text-base font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Login
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

const MockBreadcrumbs = ({ items }: { items: Array<{ label: string; path?: string }> }) => {
  return (
    <nav data-testid="breadcrumbs" aria-label="Breadcrumb">
      <ol className="flex items-center space-x-2 text-sm text-gray-500">
        {items.map((item, index) => (
          <li key={index} className="flex items-center">
            {index > 0 && (
              <svg className="h-4 w-4 mx-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            )}
            {item.path ? (
              <a
                href={item.path}
                data-testid={`breadcrumb-${index}`}
                className="hover:text-gray-900"
              >
                {item.label}
              </a>
            ) : (
              <span data-testid={`breadcrumb-${index}`} className="font-medium text-gray-900">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
};

describe('Navigation Component Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render navigation with logo', () => {
      renderWithProviders(<MockNavigation />);

      expect(screen.getByTestId('main-navigation')).toBeInTheDocument();
      expect(screen.getByTestId('logo')).toBeInTheDocument();
      expect(screen.getByText('Portfolio')).toBeInTheDocument();
    });

    it('should render desktop navigation links', () => {
      renderWithProviders(<MockNavigation />);

      expect(screen.getByTestId('desktop-nav')).toBeInTheDocument();
      expect(screen.getByTestId('nav-link-home')).toBeInTheDocument();
      expect(screen.getByTestId('nav-link-gallery')).toBeInTheDocument();
      expect(screen.getByTestId('nav-link-projects')).toBeInTheDocument();
      expect(screen.getByTestId('nav-link-blog')).toBeInTheDocument();
      expect(screen.getByTestId('nav-link-about')).toBeInTheDocument();
    });

    it('should not show admin link for regular users', () => {
      renderWithProviders(<MockNavigation />);

      expect(screen.queryByTestId('nav-link-admin')).not.toBeInTheDocument();
    });

    it('should show admin link for admin users', () => {
      renderWithProviders(<MockNavigation user={mockAdminUser} />);

      expect(screen.getByTestId('nav-link-admin')).toBeInTheDocument();
    });
  });

  describe('Authentication States', () => {
    it('should show login button when user is not authenticated', () => {
      renderWithProviders(<MockNavigation />);

      expect(screen.getByTestId('login-button')).toBeInTheDocument();
      expect(screen.getByText('Login')).toBeInTheDocument();
      expect(screen.queryByTestId('logout-button')).not.toBeInTheDocument();
    });

    it('should show user info and logout button when authenticated', () => {
      renderWithProviders(<MockNavigation user={mockUser} />);

      expect(screen.getByTestId('user-greeting')).toBeInTheDocument();
      expect(screen.getByText(`Hello, ${mockUser.full_name}`)).toBeInTheDocument();
      expect(screen.getByTestId('logout-button')).toBeInTheDocument();
      expect(screen.queryByTestId('login-button')).not.toBeInTheDocument();
    });

    it('should show admin badge for admin users', () => {
      renderWithProviders(<MockNavigation user={mockAdminUser} />);

      expect(screen.getByTestId('admin-badge')).toBeInTheDocument();
      expect(screen.getByText('Admin')).toBeInTheDocument();
    });

    it('should handle login button click', async () => {
      const handleLogin = vi.fn();
      const user = await import('@testing-library/user-event').then(m => m.userEvent.setup());

      renderWithProviders(<MockNavigation onLogin={handleLogin} />);

      const loginButton = screen.getByTestId('login-button');
      await user.click(loginButton);

      expect(handleLogin).toHaveBeenCalledTimes(1);
    });

    it('should handle logout button click', async () => {
      const handleLogout = vi.fn();
      const user = await import('@testing-library/user-event').then(m => m.userEvent.setup());

      renderWithProviders(<MockNavigation user={mockUser} onLogout={handleLogout} />);

      const logoutButton = screen.getByTestId('logout-button');
      await user.click(logoutButton);

      expect(handleLogout).toHaveBeenCalledTimes(1);
    });
  });

  describe('Active Link Highlighting', () => {
    it('should highlight active link', () => {
      renderWithProviders(<MockNavigation currentPath="/gallery" />);

      const galleryLink = screen.getByTestId('nav-link-gallery');
      expect(galleryLink).toHaveClass('bg-blue-100', 'text-blue-700');
      expect(galleryLink).toHaveAttribute('aria-current', 'page');
    });

    it('should not highlight inactive links', () => {
      renderWithProviders(<MockNavigation currentPath="/gallery" />);

      const homeLink = screen.getByTestId('nav-link-home');
      expect(homeLink).not.toHaveClass('bg-blue-100', 'text-blue-700');
      expect(homeLink).not.toHaveAttribute('aria-current');
    });

    it('should handle root path correctly', () => {
      renderWithProviders(<MockNavigation currentPath="/" />);

      const homeLink = screen.getByTestId('nav-link-home');
      expect(homeLink).toHaveClass('bg-blue-100', 'text-blue-700');
      expect(homeLink).toHaveAttribute('aria-current', 'page');
    });
  });

  describe('Mobile Navigation', () => {
    it('should show mobile menu button on mobile', () => {
      renderWithProviders(<MockNavigation isMobile={true} />);

      expect(screen.getByTestId('mobile-menu-button')).toBeInTheDocument();
      expect(screen.queryByTestId('desktop-nav')).not.toBeInTheDocument();
    });

    it('should toggle mobile menu on button click', async () => {
      const user = await import('@testing-library/user-event').then(m => m.userEvent.setup());

      renderWithProviders(<MockNavigation isMobile={true} />);

      const menuButton = screen.getByTestId('mobile-menu-button');

      // Mobile menu should not be visible initially
      expect(screen.queryByTestId('mobile-nav')).not.toBeInTheDocument();

      // Click to open menu
      await user.click(menuButton);
      expect(screen.getByTestId('mobile-nav')).toBeInTheDocument();

      // Click to close menu
      await user.click(menuButton);
      expect(screen.queryByTestId('mobile-nav')).not.toBeInTheDocument();
    });

    it('should show mobile navigation links when menu is open', async () => {
      const user = await import('@testing-library/user-event').then(m => m.userEvent.setup());

      renderWithProviders(<MockNavigation isMobile={true} />);

      const menuButton = screen.getByTestId('mobile-menu-button');
      await user.click(menuButton);

      expect(screen.getByTestId('mobile-nav-link-home')).toBeInTheDocument();
      expect(screen.getByTestId('mobile-nav-link-gallery')).toBeInTheDocument();
      expect(screen.getByTestId('mobile-nav-link-projects')).toBeInTheDocument();
      expect(screen.getByTestId('mobile-nav-link-blog')).toBeInTheDocument();
      expect(screen.getByTestId('mobile-nav-link-about')).toBeInTheDocument();
    });

    it('should close mobile menu when link is clicked', async () => {
      const user = await import('@testing-library/user-event').then(m => m.userEvent.setup());

      renderWithProviders(<MockNavigation isMobile={true} />);

      const menuButton = screen.getByTestId('mobile-menu-button');
      await user.click(menuButton);

      const galleryLink = screen.getByTestId('mobile-nav-link-gallery');
      await user.click(galleryLink);

      expect(screen.queryByTestId('mobile-nav')).not.toBeInTheDocument();
    });

    it('should show mobile auth section', async () => {
      const user = await import('@testing-library/user-event').then(m => m.userEvent.setup());

      renderWithProviders(<MockNavigation isMobile={true} user={mockUser} />);

      const menuButton = screen.getByTestId('mobile-menu-button');
      await user.click(menuButton);

      expect(screen.getByTestId('mobile-auth-section')).toBeInTheDocument();
      expect(screen.getByTestId('mobile-logout-button')).toBeInTheDocument();
    });

    it('should handle mobile logout', async () => {
      const handleLogout = vi.fn();
      const user = await import('@testing-library/user-event').then(m => m.userEvent.setup());

      renderWithProviders(
        <MockNavigation isMobile={true} user={mockUser} onLogout={handleLogout} />
      );

      const menuButton = screen.getByTestId('mobile-menu-button');
      await user.click(menuButton);

      const mobileLogoutButton = screen.getByTestId('mobile-logout-button');
      await user.click(mobileLogoutButton);

      expect(handleLogout).toHaveBeenCalledTimes(1);
      expect(screen.queryByTestId('mobile-nav')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', async () => {
      const user = await import('@testing-library/user-event').then(m => m.userEvent.setup());

      renderWithProviders(<MockNavigation isMobile={true} />);

      const menuButton = screen.getByTestId('mobile-menu-button');
      expect(menuButton).toHaveAttribute('aria-label', 'Toggle mobile menu');
      expect(menuButton).toHaveAttribute('aria-expanded', 'false');

      await user.click(menuButton);
      expect(menuButton).toHaveAttribute('aria-expanded', 'true');
    });

    it('should mark current page with aria-current', () => {
      renderWithProviders(<MockNavigation currentPath="/gallery" />);

      const galleryLink = screen.getByTestId('nav-link-gallery');
      expect(galleryLink).toHaveAttribute('aria-current', 'page');

      const homeLink = screen.getByTestId('nav-link-home');
      expect(homeLink).not.toHaveAttribute('aria-current');
    });

    it('should be keyboard navigable', async () => {
      const user = await import('@testing-library/user-event').then(m => m.userEvent.setup());

      renderWithProviders(<MockNavigation />);

      // Logo should be focusable
      const logo = screen.getByTestId('logo');
      await user.tab();
      expect(logo).toHaveFocus();

      // Navigation links should be focusable
      await user.tab();
      expect(screen.getByTestId('nav-link-home')).toHaveFocus();
    });
  });

  describe('Responsive Design', () => {
    it('should hide desktop nav on mobile', () => {
      renderWithProviders(<MockNavigation isMobile={true} />);

      // Desktop nav should have classes that hide it on mobile
      expect(screen.queryByTestId('desktop-nav')).not.toBeInTheDocument();
    });

    it('should show desktop nav on desktop', () => {
      renderWithProviders(<MockNavigation isMobile={false} />);

      expect(screen.getByTestId('desktop-nav')).toBeInTheDocument();
      expect(screen.queryByTestId('mobile-menu-button')).not.toBeInTheDocument();
    });
  });

  describe('Breadcrumbs Component', () => {
    it('should render breadcrumbs correctly', () => {
      const breadcrumbItems = [
        { label: 'Home', path: '/' },
        { label: 'Gallery', path: '/gallery' },
        { label: 'Landscape' }, // Current page (no link)
      ];

      renderWithProviders(<MockBreadcrumbs items={breadcrumbItems} />);

      expect(screen.getByTestId('breadcrumbs')).toBeInTheDocument();
      expect(screen.getByTestId('breadcrumb-0')).toBeInTheDocument();
      expect(screen.getByTestId('breadcrumb-1')).toBeInTheDocument();
      expect(screen.getByTestId('breadcrumb-2')).toBeInTheDocument();

      expect(screen.getByText('Home')).toBeInTheDocument();
      expect(screen.getByText('Gallery')).toBeInTheDocument();
      expect(screen.getByText('Landscape')).toBeInTheDocument();
    });

    it('should make breadcrumb items clickable when they have paths', () => {
      const breadcrumbItems = [{ label: 'Home', path: '/' }, { label: 'Current Page' }];

      renderWithProviders(<MockBreadcrumbs items={breadcrumbItems} />);

      const homeLink = screen.getByTestId('breadcrumb-0');
      const currentPage = screen.getByTestId('breadcrumb-1');

      expect(homeLink.tagName).toBe('A');
      expect(homeLink).toHaveAttribute('href', '/');

      expect(currentPage.tagName).toBe('SPAN');
      expect(currentPage).not.toHaveAttribute('href');
    });

    it('should have proper accessibility attributes', () => {
      const breadcrumbItems = [{ label: 'Home', path: '/' }, { label: 'Gallery' }];

      renderWithProviders(<MockBreadcrumbs items={breadcrumbItems} />);

      const breadcrumbNav = screen.getByTestId('breadcrumbs');
      expect(breadcrumbNav).toHaveAttribute('aria-label', 'Breadcrumb');
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing user data gracefully', () => {
      renderWithProviders(<MockNavigation user={{}} />);

      expect(screen.getByTestId('user-greeting')).toBeInTheDocument();
      expect(screen.getByText('Hello,')).toBeInTheDocument(); // Should show "Hello, " with empty name
    });

    it('should handle long usernames gracefully', () => {
      const userWithLongName = {
        ...mockUser,
        full_name: 'Very Long Full Name That Might Overflow The Navigation Area',
        username: 'very_long_username_that_might_cause_layout_issues',
      };

      renderWithProviders(<MockNavigation user={userWithLongName} />);

      expect(screen.getByTestId('user-greeting')).toBeInTheDocument();
      expect(screen.getByText(/Very Long Full Name/)).toBeInTheDocument();
    });

    it('should prevent navigation when user lacks permissions', () => {
      const regularUser = { ...mockUser, is_admin: false };

      renderWithProviders(<MockNavigation user={regularUser} />);

      // Admin link should not be visible
      expect(screen.queryByTestId('nav-link-admin')).not.toBeInTheDocument();
    });
  });
});
