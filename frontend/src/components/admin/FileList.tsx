import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Clipboard, Trash2, X } from "lucide-react";
import { files as filesApi, type FileRecord } from "../../api/client";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getExtension(name: string): string {
  const parts = name.split(".");
  return parts.length > 1 ? `.${parts[parts.length - 1]}` : "";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

type SortCol = "name" | "extension" | "created_at" | "file_size";

function SortHeader({
  col,
  label,
  sortBy,
  order,
  onSort,
  className,
}: {
  col: SortCol;
  label: string;
  sortBy: SortCol;
  order: "asc" | "desc";
  onSort: (col: SortCol) => void;
  className?: string;
}) {
  return (
    <th
      className={`px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 select-none ${className ?? ""}`}
      onClick={() => onSort(col)}
    >
      {label} {sortBy === col ? (order === "asc" ? "↑" : "↓") : ""}
    </th>
  );
}

interface Props {
  fileRecords: FileRecord[];
  sortBy: SortCol;
  order: "asc" | "desc";
  onSort: (col: SortCol) => void;
  search: string;
  onSearch: (v: string) => void;
}

export function FileList({
  fileRecords,
  sortBy,
  order,
  onSort,
  search,
  onSearch,
}: Props) {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      filesApi.rename(id, name),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-files"] });
      setEditingId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => filesApi.remove(id),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["admin-files"] }),
  });

  function copyUrl(record: FileRecord) {
    void navigator.clipboard.writeText(window.location.origin + record.url);
    setCopiedId(record.id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  return (
    <div>
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by name..."
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          className="w-full max-w-xs border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800/60">
            <tr>
              <SortHeader
                col="name"
                label="Name"
                sortBy={sortBy}
                order={order}
                onSort={onSort}
              />
              <SortHeader
                col="extension"
                label="Ext"
                sortBy={sortBy}
                order={order}
                onSort={onSort}
                className="w-16"
              />
              <SortHeader
                col="file_size"
                label="Size"
                sortBy={sortBy}
                order={order}
                onSort={onSort}
                className="w-24"
              />
              <SortHeader
                col="created_at"
                label="Uploaded"
                sortBy={sortBy}
                order={order}
                onSort={onSort}
                className="w-36"
              />
              <th className="px-4 py-3 w-24" />
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
            {fileRecords.map((record) => (
              <tr
                key={record.id}
                className="hover:bg-gray-50 dark:hover:bg-gray-800/50"
              >
                <td className="px-4 py-3 text-sm">
                  {editingId === record.id ? (
                    <div className="flex gap-1 items-center">
                      <input
                        autoFocus
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && editingName.trim())
                            renameMutation.mutate({
                              id: record.id,
                              name: editingName.trim(),
                            });
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm font-mono w-64 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        onClick={() => {
                          if (editingName.trim())
                            renameMutation.mutate({
                              id: record.id,
                              name: editingName.trim(),
                            });
                        }}
                        disabled={!editingName.trim()}
                        title="Confirm"
                        className="inline-flex items-center justify-center w-7 h-7 rounded text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 disabled:opacity-40 transition-colors"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        title="Cancel"
                        className="inline-flex items-center justify-center w-7 h-7 rounded text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setEditingId(record.id);
                        setEditingName(record.original_name);
                      }}
                      className="text-blue-600 dark:text-blue-400 hover:underline font-mono text-xs text-left"
                    >
                      {record.original_name}
                    </button>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 font-mono">
                  {getExtension(record.original_name)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                  {formatBytes(record.file_size)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                  {formatDate(record.created_at)}
                </td>
                <td className="px-4 py-3 text-sm text-right">
                  <div className="flex gap-1 justify-end">
                    <button
                      onClick={() => copyUrl(record)}
                      title="Copy URL"
                      className="inline-flex items-center justify-center w-7 h-7 rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      {copiedId === record.id ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Clipboard className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete ${record.original_name}?`))
                          deleteMutation.mutate(record.id);
                      }}
                      title="Delete"
                      className="inline-flex items-center justify-center w-7 h-7 rounded text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {fileRecords.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-sm text-gray-400 dark:text-gray-500"
                >
                  No files uploaded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
