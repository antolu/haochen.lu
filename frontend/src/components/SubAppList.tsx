import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { SubApp } from '../types';
import { formatDateSimple } from '../utils/dateFormat';

interface SubAppListProps {
  subapps: SubApp[];
  onEdit: (subapp: SubApp) => void;
  onDelete: (subappId: string) => void;
  onToggleEnabled: (subappId: string, enabled: boolean) => void;
  isLoading?: boolean;
}

const SubAppList: React.FC<SubAppListProps> = ({
  subapps,
  onEdit,
  onDelete,
  onToggleEnabled,
  isLoading = false,
}) => {
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredSubapps = subapps.filter(
    subapp =>
      subapp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      subapp.url.toLowerCase().includes(searchTerm.toLowerCase()) ||
      subapp.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDeleteClick = (subappId: string) => {
    setDeleteConfirm(subappId);
  };

  const handleDeleteConfirm = (subappId: string) => {
    onDelete(subappId);
    setDeleteConfirm(null);
  };

  const handleDeleteCancel = () => {
    setDeleteConfirm(null);
  };

  const getStatusBadge = (subapp: SubApp) => {
    if (!subapp.enabled) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          Disabled
        </span>
      );
    }

    if (subapp.admin_only) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
          Admin Only
        </span>
      );
    }

    if (subapp.requires_auth) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
          Auth Required
        </span>
      );
    }

    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
        Public
      </span>
    );
  };

  const renderIcon = (subapp: SubApp) => {
    if (!subapp.icon) {
      return (
        <div className="h-8 w-8 bg-gray-200 rounded-lg flex items-center justify-center">
          <span className="text-gray-500 text-sm font-medium">
            {subapp.name.charAt(0).toUpperCase()}
          </span>
        </div>
      );
    }

    // Check if icon is an emoji (single character) or URL
    if (subapp.icon.length <= 2) {
      return <div className="h-8 w-8 flex items-center justify-center text-lg">{subapp.icon}</div>;
    }

    // Assume it's an image URL
    return (
      <img
        src={subapp.icon}
        alt={`${subapp.name} icon`}
        className="h-8 w-8 rounded-lg object-cover"
        onError={e => {
          // Fallback to initial letter if image fails to load
          const target = e.target as HTMLImageElement;
          target.style.display = 'none';
          const fallback = target.parentElement?.querySelector('.fallback');
          if (fallback) {
            (fallback as HTMLElement).style.display = 'flex';
          }
        }}
      />
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="animate-pulse">
              <div className="flex items-center space-x-4">
                <div className="h-8 w-8 bg-gray-300 rounded-lg" />
                <div className="flex-1">
                  <div className="h-4 bg-gray-300 rounded w-1/4 mb-2" />
                  <div className="h-3 bg-gray-300 rounded w-1/2" />
                </div>
                <div className="h-6 bg-gray-300 rounded-full w-16" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative">
          <input
            type="text"
            placeholder="Search sub-apps..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg
              className="h-5 w-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* Sub-apps List */}
      <AnimatePresence>
        {filteredSubapps.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center py-12"
          >
            <div className="text-gray-500">
              {searchTerm
                ? 'No sub-apps match your search.'
                : 'No sub-apps found. Create your first one!'}
            </div>
          </motion.div>
        ) : (
          <div className="space-y-4">
            {filteredSubapps.map(subapp => (
              <motion.div
                key={subapp.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-white rounded-lg border border-gray-200 p-6 hover:border-gray-300 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4 flex-1">
                    {/* Icon */}
                    <div className="relative">
                      {renderIcon(subapp)}
                      <div className="fallback h-8 w-8 bg-gray-200 rounded-lg hidden items-center justify-center">
                        <span className="text-gray-500 text-sm font-medium">
                          {subapp.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-3">
                        <h3 className="text-lg font-medium text-gray-900 truncate">
                          {subapp.name}
                        </h3>
                        {getStatusBadge(subapp)}
                        {subapp.is_external && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            External
                          </span>
                        )}
                        {!subapp.show_in_menu && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                            Hidden
                          </span>
                        )}
                      </div>

                      <div className="mt-1">
                        <a
                          href={subapp.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:text-blue-800 hover:underline truncate block"
                        >
                          {subapp.url}
                        </a>
                      </div>

                      {subapp.description && (
                        <p className="mt-2 text-sm text-gray-600 line-clamp-2">
                          {subapp.description}
                        </p>
                      )}

                      <div className="mt-2 flex items-center text-xs text-gray-500 space-x-4">
                        <span>Order: {subapp.order}</span>
                        <span>Created: {formatDateSimple(subapp.created_at)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-2 ml-4">
                    {/* Toggle Enable/Disable */}
                    <button
                      onClick={() => onToggleEnabled(subapp.id, !subapp.enabled)}
                      className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                        subapp.enabled
                          ? 'text-orange-700 bg-orange-100 hover:bg-orange-200'
                          : 'text-green-700 bg-green-100 hover:bg-green-200'
                      }`}
                      title={subapp.enabled ? 'Disable' : 'Enable'}
                    >
                      {subapp.enabled ? 'Disable' : 'Enable'}
                    </button>

                    {/* Edit Button */}
                    <button
                      onClick={() => onEdit(subapp)}
                      className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 rounded transition-colors"
                      title="Edit"
                    >
                      Edit
                    </button>

                    {/* Delete Button */}
                    {deleteConfirm === subapp.id ? (
                      <div className="flex space-x-1">
                        <button
                          onClick={() => handleDeleteConfirm(subapp.id)}
                          className="px-2 py-1.5 text-xs font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded transition-colors"
                          title="Confirm Delete"
                        >
                          Yes
                        </button>
                        <button
                          onClick={handleDeleteCancel}
                          className="px-2 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                          title="Cancel Delete"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleDeleteClick(subapp.id)}
                        className="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded transition-colors"
                        title="Delete"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SubAppList;
