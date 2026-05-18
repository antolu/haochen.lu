import { useCallback, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Upload } from "lucide-react";
import {
  files as filesApi,
  type FileListResponse,
  type FileRecord,
} from "../../api/client";
import { CollisionModal } from "../../components/admin/CollisionModal";
import { FileList } from "../../components/admin/FileList";
import { Button } from "../../components/ui/button";

export default function AdminFiles() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [sortBy, setSortBy] = useState<
    "name" | "extension" | "created_at" | "file_size"
  >("created_at");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [search, setSearch] = useState("");
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [collision, setCollision] = useState<{
    file: File;
    existingId: string;
  } | null>(null);

  const { data } = useQuery<FileListResponse>({
    queryKey: ["admin-files", sortBy, order, search],
    queryFn: () =>
      filesApi.list({ sort_by: sortBy, order, search: search || undefined }),
  });
  const fileRecords: FileRecord[] = data?.items ?? [];

  function handleSort(col: "name" | "extension" | "created_at" | "file_size") {
    if (sortBy === col) {
      setOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(col);
      setOrder("desc");
    }
  }

  const uploadFile = useCallback(
    async (file: File, replace = false) => {
      setUploading(true);
      try {
        await filesApi.upload(file, replace);
        void queryClient.invalidateQueries({ queryKey: ["admin-files"] });
        setCollision(null);
      } catch (err) {
        if (axios.isAxiosError(err) && err.response?.status === 409) {
          const responseData = err.response.data as Record<string, unknown>;
          const detail = responseData?.detail as
            | { conflict: boolean; existing_id: string }
            | undefined;
          if (detail?.conflict) {
            setCollision({ file, existingId: detail.existing_id });
            return;
          }
        }
        console.error("Upload failed", err);
      } finally {
        setUploading(false);
      }
    },
    [queryClient],
  );

  function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    void uploadFile(fileList[0]);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  }

  return (
    <div
      className="min-h-screen p-6"
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      {dragging && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-blue-500/20 border-4 border-dashed border-blue-500 pointer-events-none">
          <p className="text-2xl font-semibold text-blue-700">Drop to upload</p>
        </div>
      )}

      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between border-b pb-8 mb-8">
          <div className="space-y-2">
            <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Files
            </h1>
            <p className="text-muted-foreground text-lg">
              Drag and drop anywhere on this page to upload
            </p>
          </div>
          <Button
            variant="gradient"
            size="lg"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="rounded-full px-8 shadow-xl shadow-primary/20"
          >
            <Upload className="h-5 w-5 mr-2" />
            {uploading ? "Uploading..." : "Upload file"}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>

        <FileList
          fileRecords={fileRecords}
          sortBy={sortBy}
          order={order}
          onSort={handleSort}
          search={search}
          onSearch={setSearch}
        />
      </div>

      {collision && (
        <CollisionModal
          filename={collision.file.name}
          onRename={(newName) => {
            const renamed = new File([collision.file], newName, {
              type: collision.file.type,
            });
            void uploadFile(renamed);
          }}
          onReplace={() => void uploadFile(collision.file, true)}
          onCancel={() => setCollision(null)}
        />
      )}
    </div>
  );
}
