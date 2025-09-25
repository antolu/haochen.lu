import React from "react";
import ContentManager from "../../components/admin/ContentManager";

const AdminContent: React.FC = () => {
  return (
    <div className="p-4 md:p-6">
      <div className="mb-4 md:mb-6">
        <h1 className="text-2xl md:text-3xl font-semibold">Website Content</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage all editable text content on your website.
        </p>
      </div>

      <ContentManager />
    </div>
  );
};

export default AdminContent;
