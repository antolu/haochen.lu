import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useUploadQueue } from "../stores/uploadQueue";
import { useUploadProcessor } from "../hooks/useUploadProcessor";
import {
  Upload,
  X,
  CheckCircle,
  AlertCircle,
  Pause,
  Play,
  RotateCw,
  ChevronDown,
  ChevronUp,
  Trash2,
} from "lucide-react";

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

export const UploadQueue: React.FC = () => {
  const {
    queue,
    removeFromQueue,
    pauseUpload,
    resumeUpload,
    retryUpload,
    clearCompleted,
    getPendingCount,
    getCompletedCount,
    getErrorCount,
  } = useUploadQueue();

  const { isProcessing } = useUploadProcessor();
  const [isExpanded, setIsExpanded] = useState(true);
  const [filter, setFilter] = useState<
    "all" | "active" | "completed" | "error"
  >("all");

  const pendingCount = getPendingCount();
  const completedCount = getCompletedCount();
  const errorCount = getErrorCount();

  // Don't show if queue is empty
  if (queue.length === 0) {
    return null;
  }

  const filteredQueue = queue.filter((upload) => {
    if (filter === "all") return true;
    if (filter === "active")
      return upload.status === "uploading" || upload.status === "pending";
    if (filter === "completed") return upload.status === "completed";
    if (filter === "error") return upload.status === "error";
    return true;
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 100 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 100 }}
      className="fixed bottom-4 right-4 w-96 max-w-[calc(100vw-2rem)] bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border dark:border-gray-700 z-50"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Upload className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            {isProcessing && (
              <div className="absolute -top-1 -right-1 h-3 w-3 bg-blue-600 rounded-full animate-pulse" />
            )}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Upload Queue
            </h3>
            <p className="text-xs text-muted-foreground">
              {pendingCount} pending • {completedCount} done • {errorCount}{" "}
              failed
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {completedCount > 0 && (
            <button
              onClick={clearCompleted}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              title="Clear completed"
            >
              <Trash2 className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            {/* Filter Tabs */}
            <div className="flex gap-1 p-2 bg-muted dark:bg-gray-900/50 border-b border dark:border-gray-700">
              {[
                { key: "all", label: "All" },
                { key: "active", label: "Active" },
                { key: "completed", label: "Done" },
                { key: "error", label: "Failed" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key as typeof filter)}
                  className={`px-3 py-1 text-xs rounded transition-colors ${
                    filter === tab.key
                      ? "bg-blue-600 text-white"
                      : "text-muted-foreground hover:bg-gray-200 dark:hover:bg-gray-700"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Queue Items */}
            <div className="max-h-96 overflow-y-auto">
              <AnimatePresence>
                {filteredQueue.map((upload) => (
                  <motion.div
                    key={upload.id}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="border-b border dark:border-gray-700 last:border-b-0"
                  >
                    <div className="p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <div className="flex items-start gap-3">
                        {/* Status Icon */}
                        <div className="flex-shrink-0 mt-1">
                          {upload.status === "completed" && (
                            <CheckCircle className="h-5 w-5 text-green-600" />
                          )}
                          {upload.status === "error" && (
                            <AlertCircle className="h-5 w-5 text-red-600" />
                          )}
                          {upload.status === "uploading" && (
                            <div className="h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                          )}
                          {upload.status === "pending" && (
                            <div className="h-5 w-5 border-2 border-muted-foreground rounded-full" />
                          )}
                          {upload.status === "paused" && (
                            <Pause className="h-5 w-5 text-yellow-600" />
                          )}
                        </div>

                        {/* File Info */}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-gray-900 dark:text-white truncate">
                            {upload.metadata.title || upload.fileName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(upload.fileSize)}
                          </p>

                          {/* Progress Bar */}
                          {(upload.status === "uploading" ||
                            upload.status === "pending") && (
                            <div className="mt-2">
                              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                                <div
                                  className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                                  style={{ width: `${upload.progress}%` }}
                                />
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                {upload.progress}%
                              </p>
                            </div>
                          )}

                          {/* Error Message */}
                          {upload.status === "error" && upload.error && (
                            <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                              {upload.error}
                            </p>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex-shrink-0 flex gap-1">
                          {upload.status === "uploading" && (
                            <button
                              onClick={() => pauseUpload(upload.id)}
                              className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                              title="Pause"
                            >
                              <Pause className="h-4 w-4 text-muted-foreground" />
                            </button>
                          )}

                          {upload.status === "paused" && (
                            <button
                              onClick={() => resumeUpload(upload.id)}
                              className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                              title="Resume"
                            >
                              <Play className="h-4 w-4 text-muted-foreground" />
                            </button>
                          )}

                          {upload.status === "error" && (
                            <button
                              onClick={() => retryUpload(upload.id)}
                              className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                              title="Retry"
                            >
                              <RotateCw className="h-4 w-4 text-muted-foreground" />
                            </button>
                          )}

                          {(upload.status === "completed" ||
                            upload.status === "error") && (
                            <button
                              onClick={() => removeFromQueue(upload.id)}
                              className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                              title="Remove"
                            >
                              <X className="h-4 w-4 text-muted-foreground" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {filteredQueue.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">
                  <p className="text-sm">No uploads in this category</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
