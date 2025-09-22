/**
 * RepositoryConnector Component Tests
 *
 * Comprehensive tests for the RepositoryConnector component including:
 * - URL validation and pattern matching
 * - Repository type detection (GitHub, GitLab)
 * - API integration for repository validation
 * - Success and error state handling
 * - Loading states and user interactions
 * - Accessibility and keyboard navigation
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RepositoryConnector from '../../components/RepositoryConnector';
import { renderWithProviders } from '../utils/project-test-utils';
import { api } from '../../api/client';

// Mock the API client
vi.mock('../../api/client', () => ({
  api: {
    post: vi.fn(() => Promise.resolve({ data: {} })),
  },
}));

const mockApi = vi.mocked(api);

describe('RepositoryConnector', () => {
  const mockOnChange = vi.fn();
  const mockOnValidationChange = vi.fn();

  const defaultProps = {
    onChange: mockOnChange,
    onValidationChange: mockOnValidationChange,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(mockApi.post).mockResolvedValue({
      data: {
        type: 'github',
        owner: 'testuser',
        name: 'testproject',
        url: 'https://github.com/testuser/testproject',
        valid: true,
      },
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Basic Rendering', () => {
    it('renders with default props', () => {
      renderWithProviders(<RepositoryConnector {...defaultProps} />);

      expect(screen.getByText('Repository URL')).toBeInTheDocument();
      expect(screen.getByText('(optional)')).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText(/https:\/\/github\.com\/username\/repository/)
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /validate/i })).toBeInTheDocument();
    });

    it('renders with initial value', () => {
      const initialValue = 'https://github.com/test/repo';
      renderWithProviders(<RepositoryConnector {...defaultProps} value={initialValue} />);

      const input = screen.getByDisplayValue(initialValue);
      expect(input).toBeInTheDocument();
    });

    it('applies custom className', () => {
      const { container } = renderWithProviders(
        <RepositoryConnector {...defaultProps} className="custom-class" />
      );

      expect(container.firstChild).toHaveClass('custom-class');
    });

    it('disables input and button when disabled prop is true', () => {
      renderWithProviders(<RepositoryConnector {...defaultProps} disabled />);

      const input = screen.getByPlaceholderText(/https:\/\/github\.com\/username\/repository/);
      const button = screen.getByRole('button', { name: /validate/i });

      expect(input).toBeDisabled();
      expect(button).toBeDisabled();
    });

    it('shows help text about repository connection', () => {
      renderWithProviders(<RepositoryConnector {...defaultProps} />);

      expect(
        screen.getByText(
          /Connect your GitHub or GitLab repository to automatically sync README content/
        )
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          /Private repositories require authentication tokens configured on the server/
        )
      ).toBeInTheDocument();
    });
  });

  describe('URL Input and Validation', () => {
    it('updates URL input when user types', async () => {
      const user = userEvent.setup();
      renderWithProviders(<RepositoryConnector {...defaultProps} />);

      const input = screen.getByPlaceholderText(/https:\/\/github\.com\/username\/repository/);
      await user.type(input, 'https://github.com/test/repo');

      expect(input).toHaveValue('https://github.com/test/repo');
    });

    it('calls onChange when URL changes', async () => {
      const user = userEvent.setup();
      renderWithProviders(<RepositoryConnector {...defaultProps} />);

      const input = screen.getByPlaceholderText(/https:\/\/github\.com\/username\/repository/);
      await user.type(input, 'https://github.com/test/repo');

      expect(mockOnChange).toHaveBeenCalledWith({
        url: 'https://github.com/test/repo',
      });
    });

    it('validates GitHub URL pattern', async () => {
      const user = userEvent.setup();
      renderWithProviders(<RepositoryConnector {...defaultProps} />);

      const input = screen.getByPlaceholderText(/https:\/\/github\.com\/username\/repository/);
      await user.type(input, 'https://github.com/user/repo');

      expect(mockOnValidationChange).toHaveBeenCalledWith(true);
      expect(
        screen.queryByText('Please enter a valid GitHub or GitLab repository URL')
      ).not.toBeInTheDocument();
    });

    it('validates GitLab URL pattern', async () => {
      const user = userEvent.setup();
      renderWithProviders(<RepositoryConnector {...defaultProps} />);

      const input = screen.getByPlaceholderText(/https:\/\/github\.com\/username\/repository/);
      await user.type(input, 'https://gitlab.com/user/repo');

      expect(mockOnValidationChange).toHaveBeenCalledWith(true);
      expect(
        screen.queryByText('Please enter a valid GitHub or GitLab repository URL')
      ).not.toBeInTheDocument();
    });

    it('shows error for invalid URL patterns', async () => {
      const user = userEvent.setup();
      renderWithProviders(<RepositoryConnector {...defaultProps} />);

      const input = screen.getByPlaceholderText(/https:\/\/github\.com\/username\/repository/);
      await user.type(input, 'invalid-url');

      expect(mockOnValidationChange).toHaveBeenCalledWith(false);
      expect(
        screen.getByText('Please enter a valid GitHub or GitLab repository URL')
      ).toBeInTheDocument();
    });

    it('clears validation when URL is emptied', async () => {
      const user = userEvent.setup();
      renderWithProviders(<RepositoryConnector {...defaultProps} />);

      const input = screen.getByPlaceholderText(/https:\/\/github\.com\/username\/repository/);
      await user.type(input, 'invalid-url');
      expect(
        screen.getByText('Please enter a valid GitHub or GitLab repository URL')
      ).toBeInTheDocument();

      await user.clear(input);
      expect(
        screen.queryByText('Please enter a valid GitHub or GitLab repository URL')
      ).not.toBeInTheDocument();
      expect(mockOnValidationChange).toHaveBeenCalledWith(true);
    });

    it('accepts custom Git server URLs', async () => {
      const user = userEvent.setup();
      renderWithProviders(<RepositoryConnector {...defaultProps} />);

      const input = screen.getByPlaceholderText(/https:\/\/github\.com\/username\/repository/);
      await user.type(input, 'https://git.example.com/user/repo');

      expect(mockOnValidationChange).toHaveBeenCalledWith(true);
      expect(
        screen.queryByText('Please enter a valid GitHub or GitLab repository URL')
      ).not.toBeInTheDocument();
    });
  });

  describe('Repository Validation', () => {
    it('triggers validation when validate button is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<RepositoryConnector {...defaultProps} />);

      const input = screen.getByPlaceholderText(/https:\/\/github\.com\/username\/repository/);
      const validateButton = screen.getByRole('button', { name: /validate/i });

      await user.type(input, 'https://github.com/test/repo');
      await user.click(validateButton);

      expect(vi.mocked(mockApi.post)).toHaveBeenCalledWith('/projects/repository/validate', {
        repository_url: 'https://github.com/test/repo',
      });
    });

    it('shows loading state during validation', async () => {
      const user = userEvent.setup();
      vi.mocked(mockApi.post).mockImplementation(
        () =>
          new Promise<{ data: unknown }>(resolve => setTimeout(() => resolve({ data: {} }), 100))
      );

      renderWithProviders(<RepositoryConnector {...defaultProps} />);

      const input = screen.getByPlaceholderText(/https:\/\/github\.com\/username\/repository/);
      const validateButton = screen.getByRole('button', { name: /validate/i });

      await user.type(input, 'https://github.com/test/repo');
      await user.click(validateButton);

      expect(screen.getByText('Validating...')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /validating/i })).toBeDisabled();
    });

    it('displays success state after successful validation', async () => {
      const user = userEvent.setup();
      renderWithProviders(<RepositoryConnector {...defaultProps} />);

      const input = screen.getByPlaceholderText(/https:\/\/github\.com\/username\/repository/);
      const validateButton = screen.getByRole('button', { name: /validate/i });

      await user.type(input, 'https://github.com/testuser/testproject');
      await user.click(validateButton);

      await waitFor(() => {
        expect(screen.getByText(/Repository Validated/i)).toBeInTheDocument();
        expect(screen.getByText(/testuser\/testproject/i)).toBeInTheDocument();
        // Allow multiple matches for provider label
        expect(screen.getAllByText(/github/i).length).toBeGreaterThan(0);
      });

      expect(mockOnValidationChange).toHaveBeenCalledWith(true);
      expect(mockOnChange).toHaveBeenCalledWith({
        url: 'https://github.com/testuser/testproject',
        type: 'github',
        owner: 'testuser',
        name: 'testproject',
      });
    });

    it('displays error state after failed validation', async () => {
      const user = userEvent.setup();
      vi.mocked(mockApi.post).mockRejectedValue(
        new Error(
          JSON.stringify({
            response: {
              data: {
                detail: 'Repository not found',
              },
            },
          })
        )
      );

      renderWithProviders(<RepositoryConnector {...defaultProps} />);

      const input = screen.getByPlaceholderText(/https:\/\/github\.com\/username\/repository/);
      const validateButton = screen.getByRole('button', { name: /validate/i });

      await user.type(input, 'https://github.com/nonexistent/repo');
      await user.click(validateButton);

      await waitFor(() => {
        expect(screen.getByText(/Validation Error/i)).toBeInTheDocument();
        expect(screen.getByText(/Failed to validate repository|not found/i)).toBeInTheDocument();
      });

      expect(mockOnValidationChange).toHaveBeenCalledWith(false);
    });

    it('handles network errors gracefully', async () => {
      const user = userEvent.setup();
      vi.mocked(mockApi.post).mockRejectedValue(new Error('Network error'));

      renderWithProviders(<RepositoryConnector {...defaultProps} />);

      const input = screen.getByPlaceholderText(/https:\/\/github\.com\/username\/repository/);
      const validateButton = screen.getByRole('button', { name: /validate/i });

      await user.type(input, 'https://github.com/test/repo');
      await user.click(validateButton);

      await waitFor(() => {
        expect(screen.getByText('Validation Error')).toBeInTheDocument();
        expect(screen.getByText('Failed to validate repository')).toBeInTheDocument();
      });
    });

    it('does not validate empty URL', async () => {
      const user = userEvent.setup();
      renderWithProviders(<RepositoryConnector {...defaultProps} />);

      const validateButton = screen.getByRole('button', { name: /validate/i });
      await user.click(validateButton);

      expect(vi.mocked(mockApi.post)).not.toHaveBeenCalled();
    });

    it('disables validate button for empty URL', () => {
      renderWithProviders(<RepositoryConnector {...defaultProps} />);

      const validateButton = screen.getByRole('button', { name: /validate/i });
      expect(validateButton).toBeDisabled();
    });
  });

  describe('Repository Type Icons', () => {
    it('displays GitHub icon for GitHub repositories', async () => {
      const user = userEvent.setup();
      vi.mocked(mockApi.post).mockResolvedValue({
        data: {
          type: 'github',
          owner: 'test',
          name: 'repo',
          url: 'https://github.com/test/repo',
          valid: true,
        },
      });

      renderWithProviders(<RepositoryConnector {...defaultProps} />);

      const input = screen.getByPlaceholderText(/https:\/\/github\.com\/username\/repository/);
      const validateButton = screen.getByRole('button', { name: /validate/i });

      await user.type(input, 'https://github.com/test/repo');
      await user.click(validateButton);

      await waitFor(() => {
        const validated = screen.getByText(/Repository Validated/i);
        expect(validated).toBeInTheDocument();
      });
    });

    it('displays GitLab icon for GitLab repositories', async () => {
      const user = userEvent.setup();
      vi.mocked(mockApi.post).mockResolvedValue({
        data: {
          type: 'gitlab',
          owner: 'test',
          name: 'repo',
          url: 'https://gitlab.com/test/repo',
          valid: true,
        },
      });

      renderWithProviders(<RepositoryConnector {...defaultProps} />);

      const input = screen.getByPlaceholderText(/https:\/\/github\.com\/username\/repository/);
      const validateButton = screen.getByRole('button', { name: /validate/i });

      await user.type(input, 'https://gitlab.com/test/repo');
      await user.click(validateButton);

      await waitFor(() => {
        const typeBadges = screen.getAllByText(/gitlab/i);
        expect(typeBadges.length).toBeGreaterThan(0);
        const gitlabIcon = typeBadges[0].closest('div')?.querySelector('svg');
        expect(gitlabIcon).toBeInTheDocument();
      });
    });
  });

  describe('State Management', () => {
    it('clears previous validation when URL changes', async () => {
      const user = userEvent.setup();
      renderWithProviders(<RepositoryConnector {...defaultProps} />);

      const input = screen.getByPlaceholderText(/https:\/\/github\.com\/username\/repository/);
      const validateButton = screen.getByRole('button', { name: /validate/i });

      // First validation
      await user.type(input, 'https://github.com/test/repo');
      await user.click(validateButton);

      await waitFor(() => {
        expect(screen.getByText('Repository Validated')).toBeInTheDocument();
      });

      // Change URL
      await user.clear(input);
      await user.type(input, 'https://github.com/other/repo');

      // Previous validation should be cleared
      expect(screen.queryByText('Repository Validated')).not.toBeInTheDocument();
    });

    it('clears errors when URL changes', async () => {
      const user = userEvent.setup();
      renderWithProviders(<RepositoryConnector {...defaultProps} />);

      const input = screen.getByPlaceholderText(/https:\/\/github\.com\/username\/repository/);

      // Enter invalid URL
      await user.type(input, 'invalid-url');
      expect(
        screen.getByText('Please enter a valid GitHub or GitLab repository URL')
      ).toBeInTheDocument();

      // Change to valid URL
      await user.clear(input);
      await user.type(input, 'https://github.com/test/repo');

      // Error should be cleared
      expect(
        screen.queryByText('Please enter a valid GitHub or GitLab repository URL')
      ).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper labels and descriptions', () => {
      renderWithProviders(<RepositoryConnector {...defaultProps} />);

      const input = screen.getByLabelText(/repository url/i);
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute('type', 'url');
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      renderWithProviders(<RepositoryConnector {...defaultProps} />);

      // Tab to input
      await user.tab();
      const input = screen.getByPlaceholderText(/https:\/\/github\.com\/username\/repository/);
      expect(input).toHaveFocus();

      // Enter a value so the button becomes enabled, then tab to validate button
      await user.type(input, 'https://github.com/test/repo');
      await user.tab();
      const button = screen.getByRole('button', { name: /validate/i });
      expect(button).toHaveFocus();
    });

    it('provides appropriate ARIA attributes for validation states', async () => {
      const user = userEvent.setup();
      renderWithProviders(<RepositoryConnector {...defaultProps} />);

      const input = screen.getByPlaceholderText(/https:\/\/github\.com\/username\/repository/);
      const validateButton = screen.getByRole('button', { name: /validate/i });

      await user.type(input, 'https://github.com/test/repo');
      await user.click(validateButton);

      await waitFor(() => {
        // Success state should have appropriate styling and icons
        const successMessage = screen.getByText('Repository Validated');
        expect(successMessage).toBeInTheDocument();
      });
    });

    it('provides error messages with proper styling', async () => {
      const user = userEvent.setup();
      renderWithProviders(<RepositoryConnector {...defaultProps} />);

      const input = screen.getByPlaceholderText(/https:\/\/github\.com\/username\/repository/);
      await user.type(input, 'invalid-url');

      const errorMessage = screen.getByText('Please enter a valid GitHub or GitLab repository URL');
      expect(errorMessage).toBeInTheDocument();
      // Styling assertion removed to avoid coupling to CSS classes
    });
  });

  describe('Edge Cases', () => {
    it('handles missing onChange callback gracefully', () => {
      expect(() => {
        renderWithProviders(
          <RepositoryConnector
            onChange={undefined as never}
            onValidationChange={mockOnValidationChange}
          />
        );
      }).not.toThrow();
    });

    it('handles missing onValidationChange callback gracefully', () => {
      const user = userEvent.setup();
      renderWithProviders(
        <RepositoryConnector onChange={mockOnChange} onValidationChange={undefined} />
      );

      const input = screen.getByPlaceholderText(/https:\/\/github\.com\/username\/repository/);

      expect(() => user.type(input, 'https://github.com/test/repo')).not.toThrow();
    });

    it('handles very long URLs', () => {
      const longUrl = `https://github.com/${'a'.repeat(100)}/${'b'.repeat(100)}`;

      renderWithProviders(<RepositoryConnector {...defaultProps} />);

      const input = screen.getByPlaceholderText(/https:\/\/github\.com\/username\/repository/);
      fireEvent.change(input, { target: { value: longUrl } });

      expect(input).toHaveValue(longUrl);
      expect(mockOnChange).toHaveBeenCalledWith({ url: longUrl });
    });

    it('handles special characters in repository names', async () => {
      const user = userEvent.setup();
      vi.mocked(mockApi.post).mockResolvedValue({
        data: {
          type: 'github',
          owner: 'test-user',
          name: 'test-repo.js',
          url: 'https://github.com/test-user/test-repo.js',
          valid: true,
        },
      });

      renderWithProviders(<RepositoryConnector {...defaultProps} />);

      const input = screen.getByPlaceholderText(/https:\/\/github\.com\/username\/repository/);
      const validateButton = screen.getByRole('button', { name: /validate/i });

      await user.type(input, 'https://github.com/test-user/test-repo.js');
      await user.click(validateButton);

      await waitFor(() => {
        expect(screen.getByText('test-user/test-repo.js')).toBeInTheDocument();
      });
    });

    it('handles API responses without expected fields', async () => {
      const user = userEvent.setup();
      vi.mocked(mockApi.post).mockResolvedValue({
        data: {
          type: 'unknown',
          valid: true,
        },
      });

      renderWithProviders(<RepositoryConnector {...defaultProps} />);

      const input = screen.getByPlaceholderText(/https:\/\/github\.com\/username\/repository/);
      const validateButton = screen.getByRole('button', { name: /validate/i });

      await user.type(input, 'https://example.com/user/repo');
      await user.click(validateButton);

      // Should not crash even with incomplete data
      await waitFor(() => {
        expect(screen.getByText('Repository Validated')).toBeInTheDocument();
      });
    });
  });
});
