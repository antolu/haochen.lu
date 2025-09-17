import React, { useState, useEffect, useMemo } from 'react';
import type { Photo } from '../../types';
import { useUpdatePhoto, usePhotoTags } from '../../hooks/usePhotos';
import TagMultiSelect from './TagMultiSelect';

interface PhotoEditorDrawerProps {
  photo: Photo | null;
  onClose: () => void;
}

const PhotoEditorDrawer: React.FC<PhotoEditorDrawerProps> = ({ photo, onClose }) => {
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: '',
    tags: '',
    comments: '',
    featured: false,
  });

  const updateMutation = useUpdatePhoto();
  const { data: distinctTags = [] } = usePhotoTags();

  useEffect(() => {
    if (photo) {
      setForm({
        title: photo.title || '',
        description: photo.description || '',
        category: photo.category || '',
        tags: photo.tags || '',
        comments: photo.comments || '',
        featured: !!photo.featured,
      });
    }
  }, [photo]);

  if (!photo) return null;

  const handleSave = async () => {
    await updateMutation.mutateAsync({ id: photo.id, data: form });
    onClose();
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="absolute top-0 right-0 h-full w-full max-w-md bg-white shadow-xl p-6 overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Edit Photo</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            ✕
          </button>
        </div>

        <div className="space-y-4">
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
              rows={4}
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Category</label>
            <input
              className="mt-1 w-full border border-gray-300 rounded px-3 py-2"
              value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
            />
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

          <div className="flex justify-end gap-2 pt-4">
            <button onClick={onClose} className="px-4 py-2 rounded border border-gray-300">
              Cancel
            </button>
            <button onClick={handleSave} className="px-4 py-2 rounded bg-blue-600 text-white">
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PhotoEditorDrawer;
