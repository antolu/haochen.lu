import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  useCreateCameraAlias,
  useUpdateCameraAlias,
  type CameraAlias,
} from '../hooks/useCameraAliases';

interface CameraAliasFormProps {
  alias?: CameraAlias | null;
  onSuccess: () => void;
  onCancel: () => void;
}

const CameraAliasForm: React.FC<CameraAliasFormProps> = ({ alias, onSuccess, onCancel }) => {
  const [formData, setFormData] = useState({
    original_name: '',
    display_name: '',
    brand: '',
    model: '',
    notes: '',
    is_active: true,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createMutation = useCreateCameraAlias();
  const updateMutation = useUpdateCameraAlias();

  const isEditing = !!alias?.id;

  useEffect(() => {
    if (alias) {
      setFormData({
        original_name: alias.original_name ?? '',
        display_name: alias.display_name ?? '',
        brand: alias.brand ?? '',
        model: alias.model ?? '',
        notes: alias.notes ?? '',
        is_active: alias.is_active ?? true,
      });
    }
  }, [alias]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.original_name.trim()) {
      newErrors.original_name = 'Original name is required';
    }

    if (!formData.display_name.trim()) {
      newErrors.display_name = 'Display name is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const submitData = {
        ...formData,
        original_name: formData.original_name.trim(),
        display_name: formData.display_name.trim(),
        brand: formData.brand.trim() || undefined,
        model: formData.model.trim() || undefined,
        notes: formData.notes.trim() || undefined,
      };

      if (isEditing && alias?.id) {
        await updateMutation.mutateAsync({
          id: alias.id,
          data: submitData,
        });
      } else {
        await createMutation.mutateAsync(submitData);
      }

      onSuccess();
    } catch (error: unknown) {
      console.error('Failed to save camera alias:', error);

      // Handle validation errors from the server
      const errorResponse = error as {
        response?: {
          data?: { detail?: string | Array<{ loc?: string[]; msg?: string }> };
        };
      };
      if (errorResponse.response?.data?.detail) {
        if (typeof errorResponse.response.data.detail === 'string') {
          setErrors({ submit: errorResponse.response.data.detail });
        } else if (Array.isArray(errorResponse.response.data.detail)) {
          const newErrors: Record<string, string> = {};
          errorResponse.response.data.detail.forEach(err => {
            if (err.loc && err.msg) {
              const field = err.loc[err.loc.length - 1];
              newErrors[field] = err.msg;
            }
          });
          setErrors(newErrors);
        }
      } else {
        setErrors({
          submit: 'An unexpected error occurred. Please try again.',
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="p-6">
      <form onSubmit={e => void handleSubmit(e)} className="space-y-6">
        {/* Error display */}
        {errors.submit && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="text-sm text-red-600">{errors.submit}</div>
          </div>
        )}

        {/* Original Name */}
        <div>
          <label htmlFor="original_name" className="block text-sm font-medium text-gray-700 mb-1">
            Original Name *
          </label>
          <input
            type="text"
            id="original_name"
            value={formData.original_name}
            onChange={e => handleInputChange('original_name', e.target.value)}
            placeholder="e.g., SONY ILCE-7RM3"
            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 ${
              errors.original_name ? 'border-red-300' : 'border-gray-300'
            }`}
          />
          {errors.original_name && (
            <div className="mt-1 text-sm text-red-600">{errors.original_name}</div>
          )}
          <div className="mt-1 text-xs text-gray-500">
            The exact camera name as it appears in photo EXIF data
          </div>
        </div>

        {/* Display Name */}
        <div>
          <label htmlFor="display_name" className="block text-sm font-medium text-gray-700 mb-1">
            Display Name *
          </label>
          <input
            type="text"
            id="display_name"
            value={formData.display_name}
            onChange={e => handleInputChange('display_name', e.target.value)}
            placeholder="e.g., Sony A7 RIII"
            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 ${
              errors.display_name ? 'border-red-300' : 'border-gray-300'
            }`}
          />
          {errors.display_name && (
            <div className="mt-1 text-sm text-red-600">{errors.display_name}</div>
          )}
          <div className="mt-1 text-xs text-gray-500">
            User-friendly name to display instead of the original
          </div>
        </div>

        {/* Brand and Model */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="brand" className="block text-sm font-medium text-gray-700 mb-1">
              Brand
            </label>
            <input
              type="text"
              id="brand"
              value={formData.brand}
              onChange={e => handleInputChange('brand', e.target.value)}
              placeholder="e.g., Sony"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label htmlFor="model" className="block text-sm font-medium text-gray-700 mb-1">
              Model
            </label>
            <input
              type="text"
              id="model"
              value={formData.model}
              onChange={e => handleInputChange('model', e.target.value)}
              placeholder="e.g., A7 RIII"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        {/* Notes */}
        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
            Notes
          </label>
          <textarea
            id="notes"
            rows={3}
            value={formData.notes}
            onChange={e => handleInputChange('notes', e.target.value)}
            placeholder="Optional notes about this camera..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {/* Active Status */}
        <div className="flex items-center">
          <input
            type="checkbox"
            id="is_active"
            checked={formData.is_active}
            onChange={e => handleInputChange('is_active', e.target.checked)}
            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
          />
          <label htmlFor="is_active" className="ml-2 block text-sm text-gray-700">
            Active (aliases are only applied when active)
          </label>
        </div>

        {/* Form Actions */}
        <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-md shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Saving...' : isEditing ? 'Update Alias' : 'Create Alias'}
          </button>
        </div>
      </form>
    </motion.div>
  );
};

export default CameraAliasForm;
