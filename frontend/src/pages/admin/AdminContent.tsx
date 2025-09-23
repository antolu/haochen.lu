import React from "react";
import ContentManager from "../../components/admin/ContentManager";

const AdminContent: React.FC = () => {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Website Content</h1>
        <p className="text-gray-600 mt-2">
          Manage all editable text content on your website. Update text elements
          without modifying code files.
        </p>
      </div>

      <ContentManager />
    </div>
  );
};

export default AdminContent;
