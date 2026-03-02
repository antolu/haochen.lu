import React from "react";
import ContentManager from "../../components/admin/ContentManager";

const AdminContent: React.FC = () => {
  return (
    <div>
      <div className="mb-10 space-y-3">
        <h1 className="admin-page-title">Website Content</h1>
        <p className="text-muted-foreground text-xl">
          Manage all editable text content on your website
        </p>
      </div>

      <ContentManager />
    </div>
  );
};

export default AdminContent;
