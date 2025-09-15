import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github.css';

interface MarkdownRendererProps {
  content: string;
  className?: string;
  compact?: boolean; // For shorter content with less spacing
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  className = '',
  compact = false,
}) => {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCode(text);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const extractTextFromChildren = (children: any): string => {
    if (typeof children === 'string') return children;
    if (Array.isArray(children)) {
      return children.map(extractTextFromChildren).join('');
    }
    if (children?.props?.children) {
      return extractTextFromChildren(children.props.children);
    }
    return '';
  };

  const CopyButton: React.FC<{ text: string }> = ({ text }) => {
    const isCopied = copiedCode === text;

    return (
      <button
        onClick={() => copyToClipboard(text)}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-gray-800 hover:bg-gray-700 text-white p-1.5 rounded text-xs flex items-center gap-1"
        title={isCopied ? 'Copied!' : 'Copy code'}
      >
        {isCopied ? (
          <>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            Copied
          </>
        ) : (
          <>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
            Copy
          </>
        )}
      </button>
    );
  };

  const proseClass = compact
    ? 'prose prose-sm max-w-none prose-gray'
    : 'prose prose-lg max-w-none prose-gray';

  return (
    <div className={`${proseClass} ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          // Custom rendering for links (open external in new tab)
          a: ({ href, children, ...props }) => (
            <a
              href={href}
              target={href?.startsWith('http') ? '_blank' : undefined}
              rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
              className="text-blue-600 hover:text-blue-800 transition-colors"
              {...props}
            >
              {children}
            </a>
          ),

          // Custom rendering for images (lazy load, responsive)
          img: ({ src, alt, ...props }) => (
            <img
              src={src}
              alt={alt}
              loading="lazy"
              className="rounded-lg shadow-md max-w-full h-auto"
              {...props}
            />
          ),

          // Code blocks with copy button
          pre: ({ children, ...props }) => {
            const codeText = extractTextFromChildren(children);

            return (
              <div className="relative group">
                <pre
                  className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto"
                  {...props}
                >
                  {children}
                </pre>
                <CopyButton text={codeText} />
              </div>
            );
          },

          // Inline code styling
          code: ({ children, className, ...props }) => {
            const isInline = !className?.includes('language-');

            if (isInline) {
              return (
                <code
                  className="bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded text-sm font-mono"
                  {...props}
                >
                  {children}
                </code>
              );
            }

            return (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },

          // Custom table styling
          table: ({ children, ...props }) => (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200" {...props}>
                {children}
              </table>
            </div>
          ),

          thead: ({ children, ...props }) => (
            <thead className="bg-gray-50" {...props}>
              {children}
            </thead>
          ),

          th: ({ children, ...props }) => (
            <th
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              {...props}
            >
              {children}
            </th>
          ),

          td: ({ children, ...props }) => (
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900" {...props}>
              {children}
            </td>
          ),

          // Custom blockquote styling
          blockquote: ({ children, ...props }) => (
            <blockquote
              className="border-l-4 border-blue-500 pl-4 py-2 my-4 italic bg-blue-50 rounded-r"
              {...props}
            >
              {children}
            </blockquote>
          ),

          // Custom heading anchors
          h1: ({ children, ...props }) => (
            <h1 className="text-3xl font-bold text-gray-900 mb-4" {...props}>
              {children}
            </h1>
          ),

          h2: ({ children, ...props }) => (
            <h2 className="text-2xl font-semibold text-gray-900 mb-3 mt-8" {...props}>
              {children}
            </h2>
          ),

          h3: ({ children, ...props }) => (
            <h3 className="text-xl font-semibold text-gray-900 mb-2 mt-6" {...props}>
              {children}
            </h3>
          ),

          h4: ({ children, ...props }) => (
            <h4 className="text-lg font-medium text-gray-900 mb-2 mt-4" {...props}>
              {children}
            </h4>
          ),

          // Custom list styling
          ul: ({ children, ...props }) => (
            <ul className="list-disc list-inside space-y-1 my-4" {...props}>
              {children}
            </ul>
          ),

          ol: ({ children, ...props }) => (
            <ol className="list-decimal list-inside space-y-1 my-4" {...props}>
              {children}
            </ol>
          ),

          li: ({ children, ...props }) => (
            <li className="text-gray-700" {...props}>
              {children}
            </li>
          ),

          // Custom paragraph styling
          p: ({ children, ...props }) => (
            <p className="text-gray-700 leading-relaxed mb-4" {...props}>
              {children}
            </p>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;
