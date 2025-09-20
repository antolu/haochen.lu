import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  EyeSlashIcon,
  MagnifyingGlassIcon,
  PhotoIcon,
} from '@heroicons/react/24/outline';
import {
  useLensAliases,
  useDeleteLensAlias,
  useLensDiscovery,
  type LensAlias,
  type LensAliasFilters,
} from '../../hooks/useLensAliases';
import LensAliasForm from '../../components/LensAliasForm';

type ViewMode = 'list' | 'create' | 'edit' | 'discovery';

const AdminLensAliases: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [editingAlias, setEditingAlias] = useState<LensAlias | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [mountFilter, setMountFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState<boolean | undefined>(undefined);
  const [currentPage, setCurrentPage] = useState(1);

  const filters: LensAliasFilters = {
    search: searchQuery || undefined,
    brand: brandFilter || undefined,
    mount_type: mountFilter || undefined,
    is_active: activeFilter,
    page: currentPage,
    per_page: 20,
  };

  const { data: aliasesData, isLoading, error } = useLensAliases(filters);
  const { data: discoveryData } = useLensDiscovery();
  const deleteMutation = useDeleteLensAlias();

  const aliases = aliasesData?.aliases || [];
  const totalPages = aliasesData?.pages || 0;

  const handleCreateAlias = () => {
    setEditingAlias(null);
    setViewMode('create');
  };

  const handleEditAlias = (alias: LensAlias) => {
    setEditingAlias(alias);
    setViewMode('edit');
  };

  const handleDeleteAlias = async (alias: LensAlias) => {
    if (
      window.confirm(
        `Are you sure you want to delete the alias for "${alias.original_name}"? This action cannot be undone.`
      )
    ) {
      try {
        await deleteMutation.mutateAsync(alias.id);
      } catch (error) {
        console.error('Failed to delete lens alias:', error);
        alert('Failed to delete lens alias. Please try again.');
      }
    }
  };

  const handleFormSuccess = () => {
    setViewMode('list');
    setEditingAlias(null);
  };

  const handleFormCancel = () => {
    setViewMode('list');
    setEditingAlias(null);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setBrandFilter('');
    setMountFilter('');
    setActiveFilter(undefined);
    setCurrentPage(1);
  };

  if (viewMode === 'create' || viewMode === 'edit') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-serif font-bold text-gray-900">
            {viewMode === 'create' ? 'Create Lens Alias' : 'Edit Lens Alias'}
          </h1>
          <button
            onClick={handleFormCancel}
            className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            Back to List
          </button>
        </div>

        <div className="bg-white shadow rounded-lg">
          <LensAliasForm
            alias={editingAlias}
            onSuccess={handleFormSuccess}
            onCancel={handleFormCancel}
          />
        </div>
      </div>
    );
  }

  if (viewMode === 'discovery') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-serif font-bold text-gray-900">Lens Discovery</h1>
          <button
            onClick={() => setViewMode('list')}
            className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            Back to List
          </button>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Discovery Statistics</h3>
            <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
              <div>Total unique lenses: {discoveryData?.total_unique_lenses || 0}</div>
              <div>Total photos: {discoveryData?.total_photos || 0}</div>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-md font-medium text-gray-900">Lenses found in photos:</h4>
            {discoveryData?.lenses.map((lens, index) => (
              <div
                key={index}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  lens.has_alias ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'
                }`}
              >
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{lens.original_name}</div>
                  <div className="text-sm text-gray-500">
                    {lens.photo_count} photo{lens.photo_count !== 1 ? 's' : ''}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {lens.has_alias ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Has Alias
                    </span>
                  ) : (
                    <button
                      onClick={() => {
                        setEditingAlias({
                          id: '',
                          original_name: lens.original_name,
                          display_name: lens.original_name,
                          brand: '',
                          model: '',
                          is_active: true,
                          created_at: '',
                          updated_at: '',
                        });
                        setViewMode('create');
                      }}
                      className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      Create Alias
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-serif font-bold text-gray-900">Lens Aliases</h1>
        <div className="flex space-x-3">
          <button
            onClick={() => setViewMode('discovery')}
            className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <PhotoIcon className="h-4 w-4 mr-2" />
            Discovery
          </button>
          <button
            onClick={handleCreateAlias}
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            Add Alias
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white shadow rounded-lg p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
              Search
            </label>
            <div className="relative">
              <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                id="search"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search by original or display name..."
                className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>

          <div className="min-w-[150px]">
            <label htmlFor="brand" className="block text-sm font-medium text-gray-700 mb-1">
              Brand
            </label>
            <input
              type="text"
              id="brand"
              value={brandFilter}
              onChange={e => setBrandFilter(e.target.value)}
              placeholder="Filter by brand..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          <div className="min-w-[150px]">
            <label htmlFor="mount" className="block text-sm font-medium text-gray-700 mb-1">
              Mount Type
            </label>
            <input
              type="text"
              id="mount"
              value={mountFilter}
              onChange={e => setMountFilter(e.target.value)}
              placeholder="Filter by mount..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          <div className="min-w-[120px]">
            <label htmlFor="active" className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              id="active"
              value={activeFilter === undefined ? '' : activeFilter.toString()}
              onChange={e =>
                setActiveFilter(e.target.value === '' ? undefined : e.target.value === 'true')
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">All</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>

          <button
            onClick={clearFilters}
            className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="text-sm text-red-600">Error loading lens aliases. Please try again.</div>
        </div>
      ) : (
        <>
          {/* Table */}
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Original Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Display Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Brand
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Focal Length
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Mount Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                <AnimatePresence>
                  {aliases.map(alias => (
                    <motion.tr
                      key={alias.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className="hover:bg-gray-50"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {alias.original_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {alias.display_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {alias.brand || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {alias.focal_length || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {alias.mount_type || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            alias.is_active
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {alias.is_active ? (
                            <>
                              <EyeIcon className="h-3 w-3 mr-1" />
                              Active
                            </>
                          ) : (
                            <>
                              <EyeSlashIcon className="h-3 w-3 mr-1" />
                              Inactive
                            </>
                          )}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => handleEditAlias(alias)}
                            className="text-primary-600 hover:text-primary-900 p-1"
                            title="Edit alias"
                          >
                            <PencilIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteAlias(alias)}
                            className="text-red-600 hover:text-red-900 p-1"
                            title="Delete alias"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>

            {aliases.length === 0 && (
              <div className="text-center py-12">
                <div className="text-gray-500">No lens aliases found.</div>
                <button
                  onClick={handleCreateAlias}
                  className="mt-2 text-primary-600 hover:text-primary-900 font-medium"
                >
                  Create your first alias
                </button>
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Page {currentPage} of {totalPages}
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AdminLensAliases;
