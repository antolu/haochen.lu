import React, { useState } from 'react';
import { motion } from 'framer-motion';
import YamlEditor from '../../components/YamlEditor';

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  config?: any;
}

const EXAMPLE_CONFIG = `# Example Cookbook Subapp Configuration
meta:
  name: "Cookbook"
  slug: "cookbook"
  description: "Personal recipe collection and cooking management system"
  version: "1.0.0"

ui:
  icon: "🍳"
  color: "#FF6B35"

integration:
  frontend_path: "/cookbook"
  api_path: "/api/cookbook"
  admin_path: "/cookbook/admin"
  requires_auth: true
  admin_only: false
  show_in_menu: true
  menu_order: 10
  has_admin: true
  admin_iframe: true
  admin_title: "Recipe Management"

docker:
  backend_image: "antonlu/cookbook-backend:latest"
  frontend_image: "antonlu/cookbook-frontend:latest"
  backend_port: 8001
  redis_db: 1
  environment:
    - "REDIS_URL=redis://redis:6379/1"
    - "DATABASE_URL=postgresql+asyncpg://postgres:\${POSTGRES_PASSWORD}@db:5432/portfolio"
    - "SECRET_KEY=\${SECRET_KEY}"
    - "SESSION_SECRET_KEY=\${SESSION_SECRET_KEY}"
    - "CORS_ORIGINS=\${CORS_ORIGINS}"
  volumes:
    - "./cookbook_uploads:/app/uploads"
  depends_on:
    - "db"
    - "redis"

routing:
  frontend:
    location: "/cookbook/"
    proxy_pass: "http://cookbook-frontend/"
  api:
    location: "/api/cookbook/"
    proxy_pass: "http://cookbook-backend:8000/api/"
  admin:
    location: "/cookbook/admin/"
    proxy_pass: "http://cookbook-frontend/admin/"

database:
  schema: "cookbook"
  migrations: true`;

const AdminSubAppIntegration: React.FC = () => {
  const [yamlContent, setYamlContent] = useState('');
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [isIntegrating, setIsIntegrating] = useState(false);
  const [integrationResult, setIntegrationResult] = useState<any>(null);
  const [showExample, setShowExample] = useState(false);

  const handleValidationChange = (result: ValidationResult | null) => {
    setValidationResult(result);
    setIntegrationResult(null); // Clear previous integration result
  };

  const handleIntegrate = async () => {
    if (!validationResult?.valid) {
      return;
    }

    setIsIntegrating(true);

    try {
      const response = await fetch('/api/subapp-integration/integrate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('access_token')}`,
        },
        body: JSON.stringify({
          yaml_content: yamlContent,
          validate_only: false,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail?.message || 'Integration failed');
      }

      const result = await response.json();
      setIntegrationResult(result);
    } catch (error) {
      setIntegrationResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    } finally {
      setIsIntegrating(false);
    }
  };

  const handleLoadExample = () => {
    setYamlContent(EXAMPLE_CONFIG);
    setShowExample(false);
  };

  const handleClear = () => {
    setYamlContent('');
    setValidationResult(null);
    setIntegrationResult(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Integrate Subapp</h1>
        <p className="mt-1 text-sm text-gray-600">
          Add a new subapp by pasting its YAML configuration below. The configuration will be
          validated in real-time.
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => setShowExample(!showExample)}
          className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-lg transition-colors"
        >
          {showExample ? 'Hide Example' : 'Show Example'}
        </button>

        <button
          onClick={handleClear}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
        >
          Clear
        </button>
      </div>

      {/* Example Configuration */}
      {showExample && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="bg-gray-50 border border-gray-200 rounded-lg p-4"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-700">Example Configuration</h3>
            <button
              onClick={handleLoadExample}
              className="px-3 py-1 text-xs font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 rounded transition-colors"
            >
              Load Example
            </button>
          </div>
          <pre className="text-xs text-gray-600 overflow-x-auto whitespace-pre-wrap">
            {EXAMPLE_CONFIG}
          </pre>
        </motion.div>
      )}

      {/* YAML Editor */}
      <YamlEditor
        value={yamlContent}
        onChange={setYamlContent}
        onValidationChange={handleValidationChange}
        disabled={isIntegrating}
      />

      {/* Integration Actions */}
      {validationResult?.valid && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-gray-200 rounded-lg p-6"
        >
          <h3 className="text-lg font-medium text-gray-900 mb-4">Ready to Integrate</h3>

          {validationResult.config && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Subapp Details</h4>
                <dl className="space-y-1 text-sm">
                  <div className="flex">
                    <dt className="w-20 text-gray-500">Name:</dt>
                    <dd className="text-gray-900">{validationResult.config.meta.name}</dd>
                  </div>
                  <div className="flex">
                    <dt className="w-20 text-gray-500">Slug:</dt>
                    <dd className="font-mono text-gray-900">{validationResult.config.meta.slug}</dd>
                  </div>
                  <div className="flex">
                    <dt className="w-20 text-gray-500">Version:</dt>
                    <dd className="text-gray-900">{validationResult.config.meta.version}</dd>
                  </div>
                </dl>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Access URLs</h4>
                <dl className="space-y-1 text-sm">
                  <div className="flex">
                    <dt className="w-20 text-gray-500">Frontend:</dt>
                    <dd className="font-mono text-blue-600">
                      {validationResult.config.integration.frontend_path}
                    </dd>
                  </div>
                  <div className="flex">
                    <dt className="w-20 text-gray-500">API:</dt>
                    <dd className="font-mono text-blue-600">
                      {validationResult.config.integration.api_path}
                    </dd>
                  </div>
                  {validationResult.config.integration.has_admin && (
                    <div className="flex">
                      <dt className="w-20 text-gray-500">Admin:</dt>
                      <dd className="font-mono text-blue-600">
                        /admin/subapps/{validationResult.config.meta.slug}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            </div>
          )}

          <button
            onClick={handleIntegrate}
            disabled={isIntegrating}
            className={`
              px-6 py-3 font-medium rounded-lg transition-colors
              ${
                isIntegrating
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }
            `}
          >
            {isIntegrating ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Integrating...
              </div>
            ) : (
              'Integrate Subapp'
            )}
          </button>
        </motion.div>
      )}

      {/* Integration Result */}
      {integrationResult && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`
            border rounded-lg p-6
            ${
              integrationResult.success
                ? 'bg-green-50 border-green-200'
                : 'bg-red-50 border-red-200'
            }
          `}
        >
          <div className="flex items-center mb-4">
            {integrationResult.success ? (
              <svg className="h-6 w-6 text-green-600 mr-3" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              <svg className="h-6 w-6 text-red-600 mr-3" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            )}
            <h3
              className={`text-lg font-medium ${integrationResult.success ? 'text-green-800' : 'text-red-800'}`}
            >
              {integrationResult.success ? 'Integration Successful!' : 'Integration Failed'}
            </h3>
          </div>

          {integrationResult.success ? (
            <div className="space-y-2">
              <p className="text-green-700">{integrationResult.message}</p>
              {integrationResult.frontend_url && (
                <div className="space-y-1">
                  <p className="text-sm text-green-600">Your subapp is now available at:</p>
                  <div className="space-y-1 text-sm">
                    <div>
                      <strong>Frontend:</strong>{' '}
                      <a
                        href={integrationResult.frontend_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {integrationResult.frontend_url}
                      </a>
                    </div>
                    {integrationResult.admin_url && (
                      <div>
                        <strong>Admin:</strong>{' '}
                        <a
                          href={integrationResult.admin_url}
                          className="text-blue-600 hover:underline"
                        >
                          {integrationResult.admin_url}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-red-700">{integrationResult.error}</p>
          )}
        </motion.div>
      )}
    </div>
  );
};

export default AdminSubAppIntegration;
