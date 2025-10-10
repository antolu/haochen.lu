import React, { useState } from "react";
import { motion } from "framer-motion";
import YamlEditor from "../../components/YamlEditor";

// Types retained in comments for reference; inferred at usage sites
interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  config?: Record<string, unknown>;
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
  const [yamlContent, setYamlContent] = useState("");
  const [validationResult, setValidationResult] =
    useState<ValidationResult | null>(null);
  const [isIntegrating, setIsIntegrating] = useState(false);
  const [integrationResult, setIntegrationResult] = useState<null | {
    success: boolean;
    message?: string;
    frontend_url?: string;
    admin_url?: string;
    error?: string;
  }>(null);
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
      const response = await fetch("/api/subapp-integration/integrate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        },
        body: JSON.stringify({
          yaml_content: yamlContent,
          validate_only: false,
        }),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as {
          detail?: { message?: string };
        };
        throw new Error(errorData.detail?.message ?? "Integration failed");
      }

      const result = (await response.json()) as {
        success: boolean;
        message?: string;
        frontend_url?: string;
        admin_url?: string;
      };
      setIntegrationResult(result);
    } catch (error) {
      setIntegrationResult({
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
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
    setYamlContent("");
    setValidationResult(null);
    setIntegrationResult(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight">Integrate Subapp</h1>
        <p className="text-muted-foreground text-lg">
          Add a new subapp by pasting its YAML configuration below. The
          configuration will be validated in real-time.
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => setShowExample(!showExample)}
          className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 dark:text-blue-400 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
        >
          {showExample ? "Hide Example" : "Show Example"}
        </button>

        <button
          onClick={handleClear}
          className="px-4 py-2 text-sm font-medium text-muted-foreground bg-muted hover:bg-muted/80 rounded-lg transition-colors"
        >
          Clear
        </button>
      </div>

      {/* Example Configuration */}
      {showExample && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="bg-muted/30 rounded-xl p-4"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium">Example Configuration</h3>
            <button
              onClick={handleLoadExample}
              className="px-3 py-1 text-xs font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 dark:text-blue-400 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 rounded transition-colors"
            >
              Load Example
            </button>
          </div>
          <pre className="text-xs text-muted-foreground overflow-x-auto whitespace-pre-wrap">
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
          className="bg-card rounded-xl shadow-sm p-6"
        >
          <h3 className="text-lg font-medium mb-4">Ready to Integrate</h3>

          {validationResult.config && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <h4 className="text-sm font-medium mb-2">Subapp Details</h4>
                <dl className="space-y-1 text-sm">
                  <div className="flex">
                    <dt className="w-20 text-muted-foreground">Name:</dt>
                    <dd>
                      {(validationResult.config as { meta?: { name?: string } })
                        ?.meta?.name ?? ""}
                    </dd>
                  </div>
                  <div className="flex">
                    <dt className="w-20 text-muted-foreground">Slug:</dt>
                    <dd className="font-mono">
                      {(validationResult.config as { meta?: { slug?: string } })
                        ?.meta?.slug ?? ""}
                    </dd>
                  </div>
                  <div className="flex">
                    <dt className="w-20 text-muted-foreground">Version:</dt>
                    <dd>
                      {(
                        validationResult.config as {
                          meta?: { version?: string };
                        }
                      )?.meta?.version ?? ""}
                    </dd>
                  </div>
                </dl>
              </div>

              <div>
                <h4 className="text-sm font-medium mb-2">Access URLs</h4>
                <dl className="space-y-1 text-sm">
                  <div className="flex">
                    <dt className="w-20 text-muted-foreground">Frontend:</dt>
                    <dd className="font-mono text-primary">
                      {(
                        validationResult.config as {
                          integration?: { frontend_path?: string };
                        }
                      )?.integration?.frontend_path ?? ""}
                    </dd>
                  </div>
                  <div className="flex">
                    <dt className="w-20 text-muted-foreground">API:</dt>
                    <dd className="font-mono text-primary">
                      {(
                        validationResult.config as {
                          integration?: { api_path?: string };
                        }
                      )?.integration?.api_path ?? ""}
                    </dd>
                  </div>
                  {(
                    validationResult.config as {
                      integration?: { has_admin?: boolean };
                    }
                  )?.integration?.has_admin && (
                    <div className="flex">
                      <dt className="w-20 text-muted-foreground">Admin:</dt>
                      <dd className="font-mono text-primary">
                        /admin/subapps/
                        {
                          (
                            validationResult.config as {
                              meta?: { slug?: string };
                            }
                          )?.meta?.slug
                        }
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            </div>
          )}

          <button
            onClick={() => {
              void handleIntegrate();
            }}
            disabled={isIntegrating}
            className={`
              px-6 py-3 font-medium rounded-lg transition-colors
              ${
                isIntegrating
                  ? "bg-muted text-muted-foreground cursor-not-allowed"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              }
            `}
          >
            {isIntegrating ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                Integrating...
              </div>
            ) : (
              "Integrate Subapp"
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
            rounded-xl p-6
            ${
              integrationResult.success
                ? "bg-gradient-to-br from-green-500/20 to-green-600/20"
                : "bg-gradient-to-br from-red-500/20 to-red-600/20"
            }
          `}
        >
          <div className="flex items-center mb-4">
            {integrationResult.success ? (
              <svg
                className="h-6 w-6 text-green-600 dark:text-green-400 mr-3"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              <svg
                className="h-6 w-6 text-red-600 dark:text-red-400 mr-3"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            )}
            <h3
              className={`text-lg font-medium ${integrationResult.success ? "text-green-800 dark:text-green-300" : "text-red-800 dark:text-red-300"}`}
            >
              {integrationResult.success
                ? "Integration Successful!"
                : "Integration Failed"}
            </h3>
          </div>

          {integrationResult.success ? (
            <div className="space-y-2">
              <p className="text-green-700 dark:text-green-300">
                {integrationResult.message}
              </p>
              {integrationResult.frontend_url && (
                <div className="space-y-1">
                  <p className="text-sm text-green-600 dark:text-green-400">
                    Your subapp is now available at:
                  </p>
                  <div className="space-y-1 text-sm">
                    <div>
                      <strong>Frontend:</strong>{" "}
                      <a
                        href={integrationResult.frontend_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {integrationResult.frontend_url}
                      </a>
                    </div>
                    {integrationResult.admin_url && (
                      <div>
                        <strong>Admin:</strong>{" "}
                        <a
                          href={integrationResult.admin_url}
                          className="text-primary hover:underline"
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
            <p className="text-red-700 dark:text-red-300">
              {integrationResult.error}
            </p>
          )}
        </motion.div>
      )}
    </div>
  );
};

export default AdminSubAppIntegration;
