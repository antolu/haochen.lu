import React, { useEffect, useState, useRef, useCallback, lazy, Suspense } from 'react';
import { motion } from 'framer-motion';
import type { Photo } from '../../types';
import { useUpdatePhoto, usePhotoTags } from '../../hooks/usePhotos';
import TagMultiSelect from './TagMultiSelect';
// Remove direct import of MapPicker and lazy-load it instead
const LazyMapPicker = lazy(() => import('../MapPicker'));

interface PhotoFormProps {
  photo: Photo;
  onSuccess?: (updated: Photo) => void;
  onCancel?: () => void;
}

const PhotoForm: React.FC<PhotoFormProps> = ({ photo, onSuccess, onCancel }) => {
  const updateMutation = useUpdatePhoto();
  const { data: distinctTags = [] } = usePhotoTags();

  const [form, setForm] = useState({
    title: photo.title || '',
    description: photo.description || '',
    category: photo.category || '',
    tags: photo.tags || '',
    comments: photo.comments || '',
    featured: !!photo.featured,
    // Location
    location_lat: typeof photo.location_lat === 'number' ? photo.location_lat : undefined,
    location_lon: typeof photo.location_lon === 'number' ? photo.location_lon : undefined,
    location_name: photo.location_name || '',
    location_address: photo.location_address || '',
  });

  useEffect(() => {
    setForm({
      title: photo.title || '',
      description: photo.description || '',
      category: photo.category || '',
      tags: photo.tags || '',
      comments: photo.comments || '',
      featured: !!photo.featured,
      location_lat: typeof photo.location_lat === 'number' ? photo.location_lat : undefined,
      location_lon: typeof photo.location_lon === 'number' ? photo.location_lon : undefined,
      location_name: photo.location_name || '',
      location_address: photo.location_address || '',
    });
  }, [photo]);

  const isSaving = updateMutation.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const updated = await updateMutation.mutateAsync({ id: photo.id, data: form as any });
    onSuccess?.(updated as Photo);
  };

  // Reverse geocode when coordinates change (debounced)
  const reverseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const doReverseGeocode = useCallback(async (lat: number, lng: number) => {
    try {
      const resp = await fetch(
        `/api/locations/reverse?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`
      );
      if (!resp.ok) return;
      const data = await resp.json();
      setForm(f => ({
        ...f,
        location_name: data.location_name || '',
        location_address: data.location_address || '',
      }));
    } catch {
      // ignore; keep coordinates
    }
  }, []);

  useEffect(() => {
    if (typeof form.location_lat !== 'number' || typeof form.location_lon !== 'number') return;
    if (reverseTimer.current) clearTimeout(reverseTimer.current);
    reverseTimer.current = setTimeout(
      () => doReverseGeocode(form.location_lat as number, form.location_lon as number),
      400
    );
    return () => {
      if (reverseTimer.current) clearTimeout(reverseTimer.current);
    };
  }, [form.location_lat, form.location_lon, doReverseGeocode]);

  const handleMapSelect = (lat: number, lng: number) => {
    setForm(f => ({ ...f, location_lat: lat, location_lon: lng }));
  };

  const parseNumber = (val: string) => {
    const n = parseFloat(val);
    return Number.isFinite(n) ? n : undefined;
  };

  return (
    <motion.div
      className="max-w-5xl mx-auto"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Edit Photo</h2>
            <p className="text-sm text-gray-600 mt-1">Update photo information and tags</p>
          </div>
          <div className="flex gap-3">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Preview Panel */}
          <div className="md:col-span-1">
            <div className="bg-white p-3 rounded-lg border border-gray-200 sticky top-6">
              <div className="aspect-square w-full overflow-hidden rounded-md bg-gray-100 group cursor-zoom-in relative">
                {/* Prefer a medium/large variant, fallback to original */}
                <img
                  src={
                    photo.variants?.large?.path ||
                    photo.variants?.medium?.path ||
                    photo.original_path
                  }
                  alt={photo.title || 'Photo preview'}
                  className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                />
                {/* Click to open full image in new tab */}
                <a
                  href={
                    photo.variants?.xlarge?.path ||
                    photo.variants?.large?.path ||
                    photo.original_path
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="absolute inset-0"
                  aria-label="Open full image"
                />
              </div>
              <div className="mt-3 text-xs text-gray-600 space-y-1">
                <div className="truncate">
                  <span className="font-medium text-gray-700">Filename:</span> {photo.filename}
                </div>
                <div>
                  <span className="font-medium text-gray-700">Size:</span> {photo.width}×
                  {photo.height}
                </div>
                {photo.date_taken && (
                  <div>
                    <span className="font-medium text-gray-700">Taken:</span>{' '}
                    {new Date(photo.date_taken).toLocaleString()}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Form Fields */}
          <div className="md:col-span-2">
            <div className="bg-white p-6 rounded-lg border border-gray-200 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">Title</label>
                <input
                  className="mt-1 w-full border border-gray-300 rounded px-3 py-2"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  className="mt-1 w-full border border-gray-300 rounded px-3 py-2"
                  rows={6}
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Category</label>
                  <input
                    className="mt-1 w-full border border-gray-300 rounded px-3 py-2"
                    value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Comments</label>
                  <input
                    className="mt-1 w-full border border-gray-300 rounded px-3 py-2"
                    value={form.comments}
                    onChange={e => setForm(f => ({ ...f, comments: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Tags</label>
                <TagMultiSelect
                  value={(form.tags || '')
                    .split(',')
                    .map(t => t.trim())
                    .filter(Boolean)}
                  options={distinctTags}
                  onChange={vals => setForm(f => ({ ...f, tags: vals.join(',') }))}
                  placeholder="Search or create tags..."
                />
              </div>

              <div>
                <label className="inline-flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={form.featured}
                    onChange={e => setForm(f => ({ ...f, featured: e.target.checked }))}
                  />
                  <span className="text-sm text-gray-700">Featured</span>
                </label>
              </div>

              {/* Location Section */}
              <div className="pt-2 border-t border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-gray-900">Location</h3>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="text-sm text-gray-600 hover:text-gray-800 underline"
                      onClick={() =>
                        setForm(f => ({
                          ...f,
                          location_lat: undefined,
                          location_lon: undefined,
                          location_name: '',
                          location_address: '',
                        }))
                      }
                    >
                      Clear
                    </button>
                    {typeof photo.location_lat === 'number' &&
                      typeof photo.location_lon === 'number' && (
                        <button
                          type="button"
                          className="text-sm text-gray-600 hover:text-gray-800 underline"
                          onClick={() =>
                            setForm(f => ({
                              ...f,
                              location_lat: photo.location_lat,
                              location_lon: photo.location_lon,
                            }))
                          }
                        >
                          Reset to EXIF
                        </button>
                      )}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <Suspense
                    fallback={
                      <div className="h-[320px] w-full rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center text-gray-500">
                        Loading map...
                      </div>
                    }
                  >
                    <LazyMapPicker
                      latitude={typeof form.location_lat === 'number' ? form.location_lat : 37.7749}
                      longitude={
                        typeof form.location_lon === 'number' ? form.location_lon : -122.4194
                      }
                      zoom={13}
                      height={320}
                      onLocationSelect={handleMapSelect}
                      onLocationChange={handleMapSelect}
                      showSearch
                    />
                  </Suspense>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Latitude</label>
                      <input
                        className="mt-1 w-full border border-gray-300 rounded px-3 py-2"
                        inputMode="decimal"
                        value={
                          typeof form.location_lat === 'number' ? String(form.location_lat) : ''
                        }
                        placeholder="e.g., 37.7749"
                        onChange={e => {
                          const v = parseNumber(e.target.value);
                          setForm(f => ({ ...f, location_lat: v }));
                        }}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Longitude</label>
                      <input
                        className="mt-1 w-full border border-gray-300 rounded px-3 py-2"
                        inputMode="decimal"
                        value={
                          typeof form.location_lon === 'number' ? String(form.location_lon) : ''
                        }
                        placeholder="e.g., -122.4194"
                        onChange={e => {
                          const v = parseNumber(e.target.value);
                          setForm(f => ({ ...f, location_lon: v }));
                        }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Location Name
                      </label>
                      <input
                        className="mt-1 w-full border border-gray-300 rounded px-3 py-2"
                        value={form.location_name}
                        onChange={e => setForm(f => ({ ...f, location_name: e.target.value }))}
                        placeholder="City, State, Country"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Address</label>
                      <input
                        className="mt-1 w-full border border-gray-300 rounded px-3 py-2"
                        value={form.location_address}
                        onChange={e => setForm(f => ({ ...f, location_address: e.target.value }))}
                        placeholder="Full address"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    </motion.div>
  );
};

export default PhotoForm;
