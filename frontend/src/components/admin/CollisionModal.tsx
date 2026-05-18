import { useState } from "react";

interface Props {
  filename: string;
  onRename: (newName: string) => void;
  onReplace: () => void;
  onCancel: () => void;
}

export function CollisionModal({
  filename,
  onRename,
  onReplace,
  onCancel,
}: Props) {
  const [newName, setNewName] = useState(filename);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
        <h2 className="text-lg font-semibold mb-2">File already exists</h2>
        <p className="text-sm text-gray-600 mb-4">
          A file named <span className="font-mono font-medium">{filename}</span>{" "}
          already exists. Choose an action:
        </p>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Rename to
          </label>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onReplace()}
            className="px-4 py-2 text-sm text-white bg-red-600 rounded hover:bg-red-700"
          >
            Replace existing
          </button>
          <button
            onClick={() => onRename(newName)}
            disabled={!newName || newName === filename}
            className="px-4 py-2 text-sm text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            Upload as renamed
          </button>
        </div>
      </div>
    </div>
  );
}
