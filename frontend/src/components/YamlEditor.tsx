import React, { useState, useEffect, useCallback } from "react";

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  config?: Record<string, unknown>;
}

interface YamlEditorProps {
  value: string;
  onChange: (value: string) => void;
  onValidationChange?: (result: ValidationResult) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

const YamlEditor: React.FC<YamlEditorProps> = ({
  value,
  onChange,
  onValidationChange,
  placeholder = "Paste your subapp configuration YAML here...",
  className = "",
  disabled = false,
}) => {
  const [validationResult, setValidationResult] =
    useState<ValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  // Validation function
  const validateYaml = useCallback(
    async (yamlContent: string) => {
      if (!yamlContent.trim()) {
        const emptyResult: ValidationResult = {
          valid: true,
          errors: [],
          warnings: [],
        };
        setValidationResult(emptyResult);
        setIsValidating(false);
        onValidationChange?.(emptyResult);
        return;
      }

      setIsValidating(true);

      try {
        const response = await fetch("/api/subapp-integration/validate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("access_token")}`,
          },
          body: JSON.stringify({
            yaml_content: yamlContent,
            validate_only: true,
          }),
        });

        if (!response.ok) {
          throw new Error(`Validation failed: ${response.statusText}`);
        }

        const result = (await response.json()) as ValidationResult;
        setValidationResult(result);
        onValidationChange?.(result);
      } catch (error) {
        const errorResult: ValidationResult = {
          valid: false,
          errors: [
            `Validation request failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          ],
          warnings: [],
        };
        setValidationResult(errorResult);
        onValidationChange?.(errorResult);
      } finally {
        setIsValidating(false);
      }
    },
    [onValidationChange],
  );

  // Trigger validation when value changes
  useEffect(() => {
    void validateYaml(value);
  }, [value, validateYaml]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  const getValidationIcon = () => {
    if (isValidating) {
      return (
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
      );
    }

    if (!validationResult) {
      return null;
    }

    if (validationResult.valid) {
      return (
        <svg
          className="h-4 w-4 text-green-600"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
            clipRule="evenodd"
          />
        </svg>
      );
    } else {
      return (
        <svg
          className="h-4 w-4 text-red-600"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
            clipRule="evenodd"
          />
        </svg>
      );
    }
  };

  const getValidationStatus = () => {
    if (isValidating) return "Validating...";
    if (!validationResult) return "No validation performed";
    if (validationResult.valid) return "Configuration is valid";
    return `${validationResult.errors.length} error(s) found`;
  };

  const getEditorBorderColor = () => {
    if (!validationResult) return "border-gray-300 focus:border-blue-500";
    if (validationResult.valid)
      return "border-green-500 focus:border-green-600";
    return "border-red-500 focus:border-red-600";
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Header with validation status */}
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">
          Subapp Configuration
        </label>
        <div className="flex items-center space-x-2 text-sm">
          {getValidationIcon()}
          <span
            className={`${
              !validationResult
                ? "text-gray-500"
                : validationResult.valid
                  ? "text-green-600"
                  : "text-red-600"
            }`}
          >
            {getValidationStatus()}
          </span>
        </div>
      </div>

      {/* YAML Editor */}
      <div className="relative">
        <textarea
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          disabled={disabled}
          className={`
            w-full h-96 p-4 font-mono text-sm
            border-2 rounded-lg
            resize-none
            ${getEditorBorderColor()}
            focus:outline-none focus:ring-2 focus:ring-opacity-50
            ${
              !validationResult
                ? "focus:ring-blue-500"
                : validationResult.valid
                  ? "focus:ring-green-500"
                  : "focus:ring-red-500"
            }
            ${disabled ? "bg-gray-100 cursor-not-allowed" : "bg-white"}
          `}
          spellCheck={false}
        />
      </div>

      {/* Validation Results */}
      {validationResult && (
        <div className="space-y-2">
          {/* Errors */}
          {validationResult.errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <h4 className="text-sm font-medium text-red-800 mb-2">
                Validation Errors:
              </h4>
              <ul className="text-sm text-red-700 space-y-1">
                {validationResult.errors.map((error, index) => (
                  <li key={index} className="flex items-start">
                    <span className="flex-shrink-0 w-4 h-4 mt-0.5 mr-2">•</span>
                    <span>{error}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Warnings */}
          {validationResult.warnings.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <h4 className="text-sm font-medium text-yellow-800 mb-2">
                Warnings:
              </h4>
              <ul className="text-sm text-yellow-700 space-y-1">
                {validationResult.warnings.map((warning, index) => (
                  <li key={index} className="flex items-start">
                    <span className="flex-shrink-0 w-4 h-4 mt-0.5 mr-2">⚠</span>
                    <span>{warning}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Success */}
          {validationResult.valid && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="flex items-center">
                <svg
                  className="h-4 w-4 text-green-600 mr-2"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="text-sm font-medium text-green-800">
                  Configuration is valid and ready for integration
                </span>
              </div>
              {validationResult.config && (
                <div className="mt-2 text-sm text-green-700">
                  {(() => {
                    const meta = (validationResult.config as unknown as {
                      meta?: { name?: string; slug?: string };
                      integration?: { frontend_path?: string };
                    }) ?? { meta: {}, integration: {} };
                    return (
                      <>
                        <p>
                          <strong>Name:</strong> {meta.meta?.name ?? ""}
                        </p>
                        <p>
                          <strong>Slug:</strong> {meta.meta?.slug ?? ""}
                        </p>
                        <p>
                          <strong>Frontend Path:</strong>{" "}
                          {meta.integration?.frontend_path ?? ""}
                        </p>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default YamlEditor;
