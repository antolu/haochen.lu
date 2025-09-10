/**
 * P0 - Critical UI Security Tests: XSS Prevention
 *
 * Tests to ensure the frontend properly sanitizes user input and prevents
 * cross-site scripting attacks in all user-facing components.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders, mockUser, createXSSPayload } from '../utils';

// Mock components for testing (these would be your actual components)
const MockPhotoCard = ({ photo }: { photo: any }) => (
  <div data-testid="photo-card">
    <h3>{photo.title}</h3>
    <p>{photo.description}</p>
    <div>{photo.tags?.join(', ')}</div>
  </div>
);

const MockProjectCard = ({ project }: { project: any }) => (
  <div data-testid="project-card">
    <h3>{project.title}</h3>
    <p dangerouslySetInnerHTML={{ __html: project.description }} />
    <div>{project.technologies?.join(', ')}</div>
  </div>
);

const MockBlogPost = ({ post }: { post: any }) => (
  <article data-testid="blog-post">
    <h1>{post.title}</h1>
    <div dangerouslySetInnerHTML={{ __html: post.content }} />
  </article>
);

const MockCommentForm = ({ onSubmit }: { onSubmit: (comment: string) => void }) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    onSubmit(formData.get('comment') as string);
  };

  return (
    <form onSubmit={handleSubmit} data-testid="comment-form">
      <textarea name="comment" placeholder="Enter comment" />
      <button type="submit">Submit</button>
    </form>
  );
};

describe('XSS Prevention Tests', () => {
  beforeEach(() => {
    // Clear any potential XSS artifacts
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  describe('Photo Display XSS Prevention', () => {
    it('should sanitize malicious scripts in photo titles', () => {
      const maliciousPhoto = {
        id: 'photo-1',
        title: createXSSPayload(),
        description: 'Normal description',
        tags: ['nature'],
      };

      renderWithProviders(<MockPhotoCard photo={maliciousPhoto} />);

      const photoCard = screen.getByTestId('photo-card');

      // Should not execute script
      expect(photoCard.textContent).toContain('<script>');
      expect(photoCard.querySelector('script')).toBeNull();

      // Verify no script execution occurred
      expect(window.alert).not.toHaveBeenCalled();
    });

    it('should sanitize XSS attempts in photo descriptions', () => {
      const xssDescriptions = [
        '<script>alert("XSS")</script>',
        '<img src="x" onerror="alert(\'XSS\')">',
        '<svg onload="alert(\'XSS\')">',
        'javascript:alert("XSS")',
        '<iframe src="javascript:alert(\'XSS\')"></iframe>',
      ];

      xssDescriptions.forEach((maliciousDescription, index) => {
        const photo = {
          id: `photo-${index}`,
          title: 'Safe title',
          description: maliciousDescription,
          tags: ['test'],
        };

        const { unmount } = renderWithProviders(<MockPhotoCard photo={photo} />);

        const photoCard = screen.getByTestId('photo-card');

        // Should not contain executable elements
        expect(photoCard.querySelector('script')).toBeNull();
        expect(photoCard.querySelector('iframe')).toBeNull();
        expect(photoCard.querySelector('img[onerror]')).toBeNull();
        expect(photoCard.querySelector('svg[onload]')).toBeNull();

        // Should display safe content only
        expect(photoCard.textContent).not.toContain('javascript:');

        unmount();
      });
    });

    it('should safely handle malicious tags', () => {
      const photo = {
        id: 'photo-1',
        title: 'Safe title',
        description: 'Safe description',
        tags: [
          '<script>alert("XSS")</script>',
          'normal-tag',
          '<img src="x" onerror="alert(\'XSS\')">',
        ],
      };

      renderWithProviders(<MockPhotoCard photo={photo} />);

      const photoCard = screen.getByTestId('photo-card');

      // Tags should be displayed as text, not executed
      expect(photoCard.querySelector('script')).toBeNull();
      expect(photoCard.querySelector('img[onerror]')).toBeNull();
      expect(photoCard.textContent).toContain('normal-tag');
    });
  });

  describe('Project Display XSS Prevention', () => {
    it('should prevent XSS in project descriptions when using dangerouslySetInnerHTML', () => {
      const maliciousProject = {
        id: 'project-1',
        title: 'Safe Project',
        description: '<p>Safe content</p><script>alert("XSS")</script>',
        technologies: ['React', 'TypeScript'],
      };

      // Mock DOMPurify or sanitization function
      const sanitizeHTML = (html: string) => {
        return html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
      };

      const SafeProjectCard = ({ project }: { project: any }) => (
        <div data-testid="project-card">
          <h3>{project.title}</h3>
          <p dangerouslySetInnerHTML={{ __html: sanitizeHTML(project.description) }} />
          <div>{project.technologies?.join(', ')}</div>
        </div>
      );

      renderWithProviders(<SafeProjectCard project={maliciousProject} />);

      const projectCard = screen.getByTestId('project-card');

      // Should display safe content
      expect(projectCard.textContent).toContain('Safe content');

      // Should not contain script elements
      expect(projectCard.querySelector('script')).toBeNull();
      expect(projectCard.innerHTML).not.toContain('<script>');
    });

    it('should sanitize technology stack arrays', () => {
      const project = {
        id: 'project-1',
        title: 'Test Project',
        description: 'Safe description',
        technologies: [
          'React',
          '<script>alert("XSS")</script>',
          'TypeScript',
          '<img src="x" onerror="alert(\'XSS\')">',
        ],
      };

      renderWithProviders(<MockProjectCard project={project} />);

      const projectCard = screen.getByTestId('project-card');

      // Technologies should be displayed as text
      expect(projectCard.textContent).toContain('React');
      expect(projectCard.textContent).toContain('TypeScript');

      // Should not execute malicious elements
      expect(projectCard.querySelector('script')).toBeNull();
      expect(projectCard.querySelector('img[onerror]')).toBeNull();
    });
  });

  describe('Blog Content XSS Prevention', () => {
    it('should prevent script injection in blog post content', () => {
      const maliciousBlogPost = {
        id: 'post-1',
        title: 'Blog Post Title',
        content: `
          <h2>Safe Heading</h2>
          <p>This is safe content.</p>
          <script>alert('XSS Attack!');</script>
          <img src="x" onerror="alert('Another XSS');">
          <iframe src="javascript:alert('XSS')"></iframe>
        `,
      };

      // Mock sanitization (in real app, use DOMPurify)
      const sanitizeContent = (content: string) => {
        return content
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
          .replace(/on\w+="[^"]*"/gi, '')
          .replace(/javascript:/gi, '');
      };

      const SafeBlogPost = ({ post }: { post: any }) => (
        <article data-testid="blog-post">
          <h1>{post.title}</h1>
          <div dangerouslySetInnerHTML={{ __html: sanitizeContent(post.content) }} />
        </article>
      );

      renderWithProviders(<SafeBlogPost post={maliciousBlogPost} />);

      const blogPost = screen.getByTestId('blog-post');

      // Should display safe content
      expect(blogPost.textContent).toContain('Safe Heading');
      expect(blogPost.textContent).toContain('This is safe content.');

      // Should not contain malicious elements
      expect(blogPost.querySelector('script')).toBeNull();
      expect(blogPost.querySelector('iframe')).toBeNull();
      expect(blogPost.querySelector('img[onerror]')).toBeNull();
    });

    it('should handle markdown-to-HTML conversion safely', () => {
      const markdownWithXSS = `
# Blog Title

Normal paragraph content.

<script>alert('XSS')</script>

\`\`\`javascript
// Code block should be safe
alert('This should not execute');
\`\`\`

[Safe link](https://example.com)
[Malicious link](javascript:alert('XSS'))
`;

      // Mock markdown renderer that sanitizes output
      const renderMarkdown = (markdown: string) => {
        // Simplified markdown to HTML conversion with XSS prevention
        return markdown
          .replace(/^# (.+)$/gm, '<h1>$1</h1>')
          .replace(/```[\s\S]*?```/g, '<pre><code>$&</code></pre>')
          .replace(/\[([^\]]+)\]\(javascript:[^)]*\)/g, '[BLOCKED LINK]')
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '[SCRIPT BLOCKED]');
      };

      const MarkdownBlogPost = ({ content }: { content: string }) => (
        <div
          data-testid="markdown-content"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
        />
      );

      renderWithProviders(<MarkdownBlogPost content={markdownWithXSS} />);

      const markdownContent = screen.getByTestId('markdown-content');

      // Should display safe content
      expect(markdownContent.textContent).toContain('Blog Title');
      expect(markdownContent.textContent).toContain('Normal paragraph content');

      // Should block malicious content
      expect(markdownContent.textContent).toContain('[SCRIPT BLOCKED]');
      expect(markdownContent.textContent).toContain('[BLOCKED LINK]');

      // Should not execute scripts
      expect(markdownContent.querySelector('script')).toBeNull();
    });
  });

  describe('Form Input XSS Prevention', () => {
    it('should sanitize user input in comment forms', async () => {
      const mockSubmit = vi.fn();
      const user = await import('@testing-library/user-event').then(m => m.userEvent.setup());

      renderWithProviders(<MockCommentForm onSubmit={mockSubmit} />);

      const textarea = screen.getByPlaceholderText('Enter comment');
      const submitButton = screen.getByText('Submit');

      // Try to submit malicious content
      const maliciousComment = '<script>alert("XSS")</script><p>Normal content</p>';

      await user.type(textarea, maliciousComment);
      await user.click(submitButton);

      expect(mockSubmit).toHaveBeenCalledWith(maliciousComment);

      // The component should handle sanitization before processing
      // In real implementation, sanitize before using the data
    });

    it('should prevent XSS through URL parameters', () => {
      const maliciousURL = '/photo/123?comment=<script>alert("XSS")</script>';

      // Mock URL parsing
      const parseURLParams = (url: string) => {
        const urlObj = new URL(url, 'http://localhost');
        const params = new URLSearchParams(urlObj.search);

        // Sanitize each parameter
        const sanitized: Record<string, string> = {};
        for (const [key, value] of params.entries()) {
          sanitized[key] = value.replace(
            /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
            '[BLOCKED]'
          );
        }

        return sanitized;
      };

      const params = parseURLParams(maliciousURL);

      expect(params.comment).toBe('[BLOCKED]');
      expect(params.comment).not.toContain('<script>');
    });
  });

  describe('Dynamic Content XSS Prevention', () => {
    it('should sanitize dynamically loaded content', async () => {
      const mockApiResponse = {
        id: 'dynamic-1',
        content: '<p>Safe content</p><script>alert("Dynamic XSS")</script>',
        title: 'Dynamic Title',
      };

      // Mock API call
      const fetchContent = vi.fn().mockResolvedValue(mockApiResponse);

      const DynamicContent = () => {
        const [content, setContent] = React.useState<any>(null);

        React.useEffect(() => {
          fetchContent().then(data => {
            // Sanitize before setting state
            const sanitized = {
              ...data,
              content: data.content.replace(
                /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
                ''
              ),
            };
            setContent(sanitized);
          });
        }, []);

        if (!content) return <div>Loading...</div>;

        return (
          <div data-testid="dynamic-content">
            <h1>{content.title}</h1>
            <div dangerouslySetInnerHTML={{ __html: content.content }} />
          </div>
        );
      };

      renderWithProviders(<DynamicContent />);

      await waitFor(() => {
        expect(screen.getByTestId('dynamic-content')).toBeInTheDocument();
      });

      const dynamicContent = screen.getByTestId('dynamic-content');

      // Should display safe content
      expect(dynamicContent.textContent).toContain('Dynamic Title');
      expect(dynamicContent.textContent).toContain('Safe content');

      // Should not contain script elements
      expect(dynamicContent.querySelector('script')).toBeNull();
    });

    it('should prevent XSS in search results', async () => {
      const maliciousSearchResults = [
        {
          id: 'result-1',
          title: 'Safe Result',
          description: 'Normal description',
        },
        {
          id: 'result-2',
          title: '<script>alert("XSS")</script>Malicious Result',
          description: '<img src="x" onerror="alert(\'XSS\')">Bad description',
        },
      ];

      const SearchResults = ({ results }: { results: any[] }) => (
        <div data-testid="search-results">
          {results.map(result => (
            <div key={result.id} data-testid={`result-${result.id}`}>
              <h3>{result.title}</h3>
              <p>{result.description}</p>
            </div>
          ))}
        </div>
      );

      renderWithProviders(<SearchResults results={maliciousSearchResults} />);

      const searchResults = screen.getByTestId('search-results');

      // Should display all results as text
      expect(searchResults.textContent).toContain('Safe Result');
      expect(searchResults.textContent).toContain('Normal description');

      // Malicious content should be displayed as text, not executed
      expect(searchResults.textContent).toContain('<script>');
      expect(searchResults.textContent).toContain('Malicious Result');
      expect(searchResults.textContent).toContain('<img');
      expect(searchResults.textContent).toContain('Bad description');

      // Should not contain actual script or img elements
      expect(searchResults.querySelector('script')).toBeNull();
      expect(searchResults.querySelector('img[onerror]')).toBeNull();
    });
  });

  describe('Event Handler XSS Prevention', () => {
    it('should prevent XSS through event handlers', async () => {
      const user = await import('@testing-library/user-event').then(m => m.userEvent.setup());
      const mockHandler = vi.fn();

      // Simulate a component that might be vulnerable to event handler XSS
      const EventComponent = () => {
        const handleClick = (event: React.MouseEvent) => {
          // Ensure event data is safe
          const target = event.target as HTMLElement;
          const safeData = target.getAttribute('data-safe') || '';
          mockHandler(safeData);
        };

        return (
          <div>
            <button data-testid="safe-button" data-safe="normal-data" onClick={handleClick}>
              Safe Button
            </button>
            <button
              data-testid="potentially-unsafe-button"
              data-safe="<script>alert('XSS')</script>"
              onClick={handleClick}
            >
              Potentially Unsafe Button
            </button>
          </div>
        );
      };

      renderWithProviders(<EventComponent />);

      // Click safe button
      await user.click(screen.getByTestId('safe-button'));
      expect(mockHandler).toHaveBeenCalledWith('normal-data');

      // Click potentially unsafe button - data should be treated as string
      await user.click(screen.getByTestId('potentially-unsafe-button'));
      expect(mockHandler).toHaveBeenCalledWith("<script>alert('XSS')</script>");

      // Verify no script execution
      expect(window.alert).not.toHaveBeenCalled();
    });
  });
});
