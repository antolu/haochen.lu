import React, { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import type { AxiosError } from 'axios';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

import { useAuthStore } from '../stores/authStore';
import type { LoginRequest } from '../types';

interface LoginFormData extends LoginRequest {
  rememberMe: boolean;
}

const LoginPage: React.FC = () => {
  const location = useLocation();
  const { login, isAuthenticated, error, clearError, isLoading: authLoading } = useAuthStore();
  const [isLocalLoading, setIsLocalLoading] = useState(false);

  // Use auth store loading state or local loading state
  const isLoading = authLoading || isLocalLoading;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>();

  const from =
    (location.state && typeof location.state === 'object' && 'from' in location.state
      ? (location.state as { from?: { pathname?: string } }).from?.pathname
      : undefined) ?? '/admin';

  // Clear local loading state when authentication state changes
  useEffect(() => {
    if (isAuthenticated || error) {
      setIsLocalLoading(false);
    }
  }, [isAuthenticated, error]);

  if (isAuthenticated) {
    return <Navigate to={from} replace />;
  }

  const onSubmit = async (data: LoginFormData): Promise<void> => {
    setIsLocalLoading(true);
    clearError();

    try {
      // Set a timeout to prevent hanging login attempts
      const loginPromise = login(data, data.rememberMe);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Login timeout')), 30000)
      );

      await Promise.race([loginPromise, timeoutPromise]);
      toast.success('Login successful!');
    } catch (error: unknown) {
      let errorMessage = 'Login failed';

      const axiosError = error as AxiosError<{ detail?: string }>;
      const message = (error as Error).message;

      if (message === 'Login timeout') {
        errorMessage = 'Login request timed out. Please try again.';
      } else if (axiosError?.response?.data?.detail) {
        errorMessage = axiosError.response.data.detail ?? errorMessage;
      } else if (axiosError?.response?.status === 401) {
        errorMessage = 'Invalid username or password';
      } else if (axiosError?.response?.status === 403) {
        errorMessage = 'Access denied';
      } else if ((axiosError?.response?.status ?? 0) >= 500) {
        errorMessage = 'Server error. Please try again later.';
      }

      toast.error(errorMessage);
    } finally {
      // Always reset loading state, even on errors or timeouts
      setIsLocalLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-md w-full space-y-8"
      >
        <div>
          <h2 className="mt-6 text-center text-3xl font-serif font-bold text-gray-900">
            Sign in to Admin Panel
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Access the content management system
          </p>
        </div>

        <form
          className="mt-8 space-y-6"
          onSubmit={e => {
            void handleSubmit(d => onSubmit(d))(e);
          }}
        >
          <div className="rounded-md shadow-sm space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                Username
              </label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                className={`relative block w-full px-3 py-2 border rounded-md placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm ${
                  errors.username ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="Enter your username"
                {...register('username', { required: 'Username is required' })}
              />
              {errors.username && (
                <p className="mt-1 text-sm text-red-600">{errors.username.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                className={`relative block w-full px-3 py-2 border rounded-md placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm ${
                  errors.password ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="Enter your password"
                {...register('password', { required: 'Password is required' })}
              />
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
              )}
            </div>
          </div>

          <div className="flex items-center">
            <input
              id="rememberMe"
              type="checkbox"
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              {...register('rememberMe')}
            />
            <label htmlFor="rememberMe" className="ml-2 block text-sm text-gray-700">
              Keep me logged in for 30 days
            </label>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="text-sm text-red-700">{error}</div>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="flex items-center">
                  <div className="spinner mr-2"></div>
                  Signing in...
                </div>
              ) : (
                'Sign in'
              )}
            </button>
          </div>

          <div className="text-center">
            <a href="/" className="text-primary-600 hover:text-primary-500 text-sm font-medium">
              ← Back to home
            </a>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default LoginPage;
