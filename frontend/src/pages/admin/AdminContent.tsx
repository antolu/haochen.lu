import React from 'react';
import ContentManager from '../../components/admin/ContentManager';

const AdminContent: React.FC = () => {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Website Content</h1>
        <p className="text-gray-600 mt-2">
          Manage all editable text content on your website. Update text elements without modifying
          code files.
        </p>
      </div>

      <ContentManager />

      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">💡 Quick Start Guide</h3>
        <div className="text-blue-800 space-y-2">
          <p>
            <strong>Key Format:</strong> Use descriptive keys like "hero.title",
            "about.description", etc.
          </p>
          <p>
            <strong>Categories:</strong> Group content by section (hero, about, contact, navigation,
            general).
          </p>
          <p>
            <strong>Content Types:</strong> Choose between text (plain), HTML (formatted), or
            markdown.
          </p>
          <p>
            <strong>Active/Inactive:</strong> Only active content is displayed on the website.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminContent;
