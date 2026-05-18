import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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

type SortCol = "name" | "extension" | "created_at" | "file_size";

function SortHeader({
  col,
  label,
  sortBy,
  order,
  onSort,
}: {
  col: SortCol;
  label: string;
  sortBy: SortCol;
  order: "asc" | "desc";
  onSort: (col: SortCol) => void;
}) {
  return (
    <th
      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-700 select-none"
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
          className="w-full max-w-xs border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
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
              />
              <SortHeader
                col="file_size"
                label="Size"
                sortBy={sortBy}
                order={order}
                onSort={onSort}
              />
              <SortHeader
                col="created_at"
                label="Uploaded"
                sortBy={sortBy}
                order={order}
                onSort={onSort}
              />
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {fileRecords.map((record) => (
              <tr key={record.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm">
                  {editingId === record.id ? (
                    <div className="flex gap-2 items-center">
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
                        className="border border-gray-300 rounded px-2 py-1 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                        className="text-xs text-blue-600 hover:underline disabled:opacity-40"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="text-xs text-gray-500 hover:underline"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <a
                      href={record.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline font-mono text-xs"
                    >
                      {record.original_name}
                    </a>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500 font-mono">
                  {getExtension(record.original_name)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {formatBytes(record.file_size)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {new Date(record.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-sm text-right">
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => copyUrl(record)}
                      className="text-xs px-2 py-1 border border-gray-300 rounded hover:bg-gray-50"
                    >
                      {copiedId === record.id ? "Copied!" : "Copy URL"}
                    </button>
                    <button
                      onClick={() => {
                        setEditingId(record.id);
                        setEditingName(record.original_name);
                      }}
                      className="text-xs px-2 py-1 border border-gray-300 rounded hover:bg-gray-50"
                    >
                      Rename
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete ${record.original_name}?`))
                          deleteMutation.mutate(record.id);
                      }}
                      className="text-xs px-2 py-1 border border-red-200 text-red-600 rounded hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {fileRecords.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-sm text-gray-400"
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
