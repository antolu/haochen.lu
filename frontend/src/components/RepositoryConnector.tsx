import React, { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { api } from "../api/client";

interface RepositoryInfo {
  type: string;
  owner: string;
  name: string;
  url: string;
  valid: boolean;
}

interface RepositoryConnectorProps {
  value?: string;
  onChange: (data: {
    url: string;
    type?: string;
    owner?: string;
    name?: string;
  }) => void;
  onValidationChange?: (isValid: boolean) => void;
  className?: string;
  disabled?: boolean;
}

const RepositoryConnector: React.FC<RepositoryConnectorProps> = ({
  value = "",
  onChange,
  onValidationChange,
  className = "",
  disabled = false,
}) => {
  const [url, setUrl] = useState(value);
  const [repoInfo, setRepoInfo] = useState<RepositoryInfo | null>(null);
  const [error, setError] = useState<string>("");

  // Sync internal state with value prop when it changes
  useEffect(() => {
    setUrl(value || "");
    // Reset validation state when value changes externally
    setRepoInfo(null);
    setError("");
  }, [value]);

  const validateMutation = useMutation({
    mutationFn: async (repositoryUrl: string) => {
      const response = await api.post("/projects/repository/validate", {
        repository_url: repositoryUrl,
      });
      return response.data as RepositoryInfo;
    },
    onSuccess: (data) => {
      setRepoInfo(data);
      setError("");
      onValidationChange?.(true);
      onChange({
        url: data.url,
        type: data.type,
        owner: data.owner,
        name: data.name,
      });
    },
    onError: (error: AxiosError<{ detail?: string }>) => {
      setRepoInfo(null);
      const errorMessage =
        error.response?.data?.detail ?? "Failed to validate repository";
      setError(errorMessage);
      onValidationChange?.(false);
    },
  });

  const handleUrlChange = (newUrl: string) => {
    setUrl(newUrl);
    setRepoInfo(null);
    setError("");

    if (!newUrl.trim()) {
      onValidationChange?.(true); // Empty is valid
      onChange({ url: "" });
      return;
    }

    // Basic URL pattern validation
    const isValidPattern =
      /^https?:\/\/(github\.com|gitlab\.com|[^/]+\.[^/]+)\/[^/]+\/[^/]+/.test(
        newUrl,
      );
    if (!isValidPattern) {
      setError("Please enter a valid GitHub or GitLab repository URL");
      onValidationChange?.(false);
      return;
    }

    onChange({ url: newUrl });
    onValidationChange?.(true); // Allow saving even without validation
  };

  const handleValidate = () => {
    if (!url.trim()) return;
    validateMutation.mutate(url);
  };

  const getRepositoryIcon = (type: string) => {
    if (type === "github") {
      return (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 0C5.374 0 0 5.373 0 12 0 17.302 3.438 21.8 8.207 23.387c.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
        </svg>
      );
    } else if (type === "gitlab") {
      return (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M23.955 13.587l-1.342-4.135-2.664-8.189c-.135-.423-.73-.423-.867 0L16.418 9.45H7.582L4.919 1.263c-.135-.423-.73-.423-.867 0L1.388 9.452.046 13.587a.905.905 0 0 0 .331 1.023L12 23.054l11.623-8.443a.905.905 0 0 0 .332-1.024" />
        </svg>
      );
    }
    return null;
  };

  return (
    <div className={className}>
      <label
        htmlFor="repo-url-input"
        className="block text-sm font-medium text-gray-700 mb-2"
      >
        Repository URL
        <span className="text-gray-500 ml-1">(optional)</span>
      </label>

      <div className="flex gap-2">
        <div className="flex-1">
          <input
            type="url"
            value={url}
            onChange={(e) => handleUrlChange(e.target.value)}
            disabled={disabled}
            placeholder="https://github.com/username/repository or https://gitlab.com/username/repository"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
            id="repo-url-input"
          />
        </div>

        <button
          type="button"
          onClick={handleValidate}
          disabled={disabled || !url.trim() || validateMutation.isPending}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
        >
          {validateMutation.isPending ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
              Validating...
            </>
          ) : (
            <>
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Validate
            </>
          )}
        </button>
      </div>

      {/* Validation Status */}
      {error && (
        <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start">
            <svg
              className="w-5 h-5 text-red-500 mr-2 flex-shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <p className="text-sm text-red-800 font-medium">
                Validation Error
              </p>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {repoInfo && (
        <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-start">
            <svg
              className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div className="flex-1">
              <p className="text-sm text-green-800 font-medium mb-1">
                Repository Validated
              </p>
              <div className="flex items-center gap-3 text-sm text-green-700">
                <div className="flex items-center gap-1">
                  {getRepositoryIcon(repoInfo.type)}
                  <span className="capitalize">{repoInfo.type}</span>
                </div>
                <span className="font-mono bg-green-100 px-2 py-1 rounded">
                  {repoInfo.owner}/{repoInfo.name}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      <p className="mt-2 text-sm text-gray-500">
        Connect your GitHub or GitLab repository to automatically sync README
        content. Private repositories require authentication tokens configured
        on the server.
      </p>
    </div>
  );
};

export default RepositoryConnector;
