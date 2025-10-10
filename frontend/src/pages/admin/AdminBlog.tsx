import React from "react";

const AdminBlog: React.FC = () => {
  return (
    <div>
      <div className="mb-8 space-y-2">
        <h1 className="text-4xl font-bold tracking-tight">Blog Management</h1>
        <p className="text-muted-foreground text-lg">
          Create and manage your blog posts
        </p>
      </div>

      <div className="bg-muted/30 rounded-xl p-12 text-center">
        <p className="text-muted-foreground">
          Blog management interface coming soon...
        </p>
      </div>
    </div>
  );
};

export default AdminBlog;
