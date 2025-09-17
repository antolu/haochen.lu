import React, { useMemo, useState } from 'react';
import type { Photo } from '../../types';
import { useReorderPhotos, useDeletePhoto, useTogglePhotoFeatured } from '../../hooks/usePhotos';

interface PhotoListTableProps {
  photos: Photo[];
  isLoading?: boolean;
  onEdit: (photo: Photo) => void;
}

const PhotoListTable: React.FC<PhotoListTableProps> = ({ photos, isLoading = false, onEdit }) => {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [localOrder, setLocalOrder] = useState<Record<string, number>>({});

  const deleteMutation = useDeletePhoto();
  const toggleFeaturedMutation = useTogglePhotoFeatured();
  const reorderMutation = useReorderPhotos();

  const sorted = useMemo(() => {
    const arr = [...photos].map(p => ({ ...p, order: localOrder[p.id] ?? p.order }));
    arr.sort((a, b) =>
      a.order !== b.order
        ? a.order - b.order
        : new Date(b.date_taken || b.created_at).getTime() -
          new Date(a.date_taken || a.created_at).getTime()
    );
    return arr;
  }, [photos, localOrder]);

  const handleDragStart = (index: number) => setDragIndex(index);
  const handleDragOver = (e: React.DragEvent<HTMLTableRowElement>) => e.preventDefault();
  const handleDrop = (dropIndex: number) => {
    if (dragIndex === null || dragIndex === dropIndex) return;
    const reordered = [...sorted];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(dropIndex, 0, moved);
    const newOrders: Record<string, number> = {};
    reordered.forEach((p, i) => {
      newOrders[p.id] = i;
    });
    setLocalOrder(newOrders);
    setDragIndex(null);
    // Persist
    reorderMutation.mutate({
      items: reordered.map((p, i) => ({ id: p.id, order: i })),
      normalize: false,
    });
  };

  if (isLoading) {
    return <div className="p-6 text-gray-500">Loading...</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">#</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
              Preview
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
              Title
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
              Category
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
              Tags
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
              Featured
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
              Order
            </th>
            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {sorted.map((p, index) => (
            <tr
              key={p.id}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(index)}
              className="hover:bg-gray-50"
            >
              <td className="px-4 py-2 text-sm text-gray-500 cursor-move">☰</td>
              <td className="px-4 py-2">
                <img
                  src={p.variants?.thumbnail?.path || p.variants?.small?.path || p.original_path}
                  alt={p.title}
                  className="h-12 w-12 object-cover rounded"
                />
              </td>
              <td className="px-4 py-2">
                <div className="text-sm text-gray-900 truncate max-w-xs" title={p.title}>
                  {p.title || 'Untitled'}
                </div>
                {p.description && (
                  <div className="text-xs text-gray-500 truncate max-w-sm" title={p.description}>
                    {p.description}
                  </div>
                )}
              </td>
              <td className="px-4 py-2 text-sm text-gray-700">{p.category || '-'}</td>
              <td
                className="px-4 py-2 text-sm text-gray-700 truncate max-w-xs"
                title={p.tags || ''}
              >
                {p.tags || '-'}
              </td>
              <td className="px-4 py-2">
                <button
                  onClick={() => toggleFeaturedMutation.mutate({ id: p.id, featured: !p.featured })}
                  className={`px-2 py-1 text-xs rounded border ${p.featured ? 'bg-yellow-100 border-yellow-300 text-yellow-700' : 'bg-gray-100 border-gray-300 text-gray-700'}`}
                >
                  {p.featured ? 'Featured' : 'Normal'}
                </button>
              </td>
              <td className="px-4 py-2 text-sm text-gray-500">{p.order}</td>
              <td className="px-4 py-2 text-right">
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => onEdit(p)}
                    className="px-2 py-1 text-xs bg-blue-600 text-white rounded"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate(p.id)}
                    className="px-2 py-1 text-xs bg-red-600 text-white rounded"
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default PhotoListTable;
