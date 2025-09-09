import React from 'react';

const PhotographyPage: React.FC = () => {
  return (
    <div className="min-h-screen py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-4xl font-serif font-bold text-gray-900 mb-8">
            Photography
          </h1>
          <p className="text-lg text-gray-600 mb-12">
            A collection of my favorite captures from around the world.
          </p>
          <div className="bg-gray-100 rounded-lg p-12">
            <p className="text-gray-500">Gallery coming soon...</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PhotographyPage;