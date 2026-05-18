import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Clipboard, Trash2, X } from "lucide-react";
import { files as filesApi, type FileRecord } from "../../api/client";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";

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

function SortHead({
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
    <TableHead
      className={`cursor-pointer select-none hover:text-foreground ${className ?? ""}`}
      onClick={() => onSort(col)}
    >
      {label} {sortBy === col ? (order === "asc" ? "↑" : "↓") : ""}
    </TableHead>
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

  function confirmRename(id: string) {
    if (editingName.trim())
      renameMutation.mutate({ id, name: editingName.trim() });
  }

  return (
    <div className="space-y-4">
      <Input
        type="text"
        placeholder="Search by name..."
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        className="max-w-xs"
      />

      <div className="bg-card rounded-xl shadow-sm border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <SortHead
                col="name"
                label="Name"
                sortBy={sortBy}
                order={order}
                onSort={onSort}
              />
              <SortHead
                col="extension"
                label="Ext"
                sortBy={sortBy}
                order={order}
                onSort={onSort}
                className="w-16"
              />
              <SortHead
                col="file_size"
                label="Size"
                sortBy={sortBy}
                order={order}
                onSort={onSort}
                className="w-24"
              />
              <SortHead
                col="created_at"
                label="Uploaded"
                sortBy={sortBy}
                order={order}
                onSort={onSort}
                className="w-36"
              />
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {fileRecords.map((record) => (
              <TableRow key={record.id}>
                <TableCell>
                  {editingId === record.id ? (
                    <div className="flex gap-1 items-center">
                      <input
                        autoFocus
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") confirmRename(record.id);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        className="border border-input rounded-lg px-2 py-1 text-sm font-mono w-64 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => confirmRename(record.id)}
                        disabled={!editingName.trim()}
                        title="Confirm"
                        className="w-7 h-7 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30"
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditingId(null)}
                        title="Cancel"
                        className="w-7 h-7 text-destructive hover:bg-destructive/10"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setEditingId(record.id);
                        setEditingName(record.original_name);
                      }}
                      className="text-primary hover:underline font-mono text-xs text-left"
                    >
                      {record.original_name}
                    </button>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground font-mono text-sm">
                  {getExtension(record.original_name)}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {formatBytes(record.file_size)}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {formatDate(record.created_at)}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1 justify-end">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => copyUrl(record)}
                      title="Copy URL"
                      className="w-7 h-7"
                    >
                      {copiedId === record.id ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Clipboard className="w-4 h-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (confirm(`Delete ${record.original_name}?`))
                          deleteMutation.mutate(record.id);
                      }}
                      title="Delete"
                      className="w-7 h-7 hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {fileRecords.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-8 text-center text-muted-foreground"
                >
                  No files uploaded yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
