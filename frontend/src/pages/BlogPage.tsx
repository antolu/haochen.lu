import React from 'react';

const BlogPage: React.FC = () => {
  return (
    <div className="min-h-screen py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-4xl font-serif font-bold text-gray-900 mb-8">
            Blog
          </h1>
          <p className="text-lg text-gray-600 mb-12">
            Thoughts on photography, technology, and creative expression.
          </p>
          <div className="bg-gray-100 rounded-lg p-12">
            <p className="text-gray-500">Blog posts coming soon...</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BlogPage;