/**
 * Session Manager Component
 * Provides session management functionality including logout everywhere
 */
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/stores/authStore';
import type { AxiosError } from 'axios';

const SessionManager: React.FC = () => {
  const { logoutEverywhere, logout, user } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogoutEverywhere = async (): Promise<void> => {
    if (!confirm('This will log you out of all devices. Continue?')) {
      return;
    }

    setIsLoading(true);
    try {
      await logoutEverywhere();
      toast.success('Successfully logged out of all devices');
      // Component will unmount due to auth state change
    } catch (error: unknown) {
      const axiosError = error as AxiosError<{ detail?: string }>;
      toast.error(axiosError.response?.data?.detail ?? 'Failed to logout from all devices');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async (): Promise<void> => {
    setIsLoading(true);
    try {
      await logout();
      toast.success('Successfully logged out');
    } catch (error: unknown) {
      const axiosError = error as AxiosError<{ detail?: string }>;
      toast.error(axiosError.response?.data?.detail ?? 'Logout failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
    >
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Session Management</h3>

      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div>
            <h4 className="font-medium text-gray-900">Current Session</h4>
            <p className="text-sm text-gray-600">
              Logged in as: <span className="font-medium">{user?.username}</span>
            </p>
          </div>
          <button
            onClick={() => {
              void handleLogout();
            }}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
          >
            {isLoading ? 'Logging out...' : 'Logout'}
          </button>
        </div>

        <div className="border-t border-gray-200 pt-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h4 className="font-medium text-gray-900 mb-2">Security Actions</h4>
              <p className="text-sm text-gray-600 mb-4">
                If you suspect unauthorized access to your account, you can immediately revoke all
                active sessions across all devices.
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              void handleLogoutEverywhere();
            }}
            disabled={isLoading}
            className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
          >
            {isLoading ? (
              <div className="flex items-center justify-center">
                <div className="spinner mr-2"></div>
                Revoking sessions...
              </div>
            ) : (
              'Logout from all devices'
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default SessionManager;
