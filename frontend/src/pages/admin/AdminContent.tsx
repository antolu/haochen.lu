import React from "react";
import ContentManager from "../../components/admin/ContentManager";

const AdminContent: React.FC = () => {
  return (
    <div>
      <div className="mb-8 space-y-2">
        <h1 className="text-4xl font-bold tracking-tight">Website Content</h1>
        <p className="text-muted-foreground text-lg">
          Manage all editable text content on your website
        </p>
      </div>

      <ContentManager />
    </div>
  );
};

export default AdminContent;
