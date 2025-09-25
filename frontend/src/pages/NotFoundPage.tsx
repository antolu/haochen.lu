import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "../components/ui/button";

const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
      <div className="text-center px-4 max-w-md mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="text-9xl font-bold text-primary-600 mb-4">404</div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Page Not Found
          </h1>
          <p className="text-gray-600 mb-8 leading-relaxed">
            The page you're looking for doesn't exist. It might have been moved,
            deleted, or you entered the wrong URL.
          </p>
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link to="/">Return to Homepage</Link>
          </Button>
        </motion.div>
      </div>
    </div>
  );
};

export default NotFoundPage;
