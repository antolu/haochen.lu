import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Button } from "../ui/button";

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
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>File already exists</DialogTitle>
          <DialogDescription>
            A file named{" "}
            <span className="font-mono font-medium">{filename}</span> already
            exists. Choose an action:
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="rename-input">Rename to</Label>
          <Input
            id="rename-input"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onReplace}>
            Replace existing
          </Button>
          <Button
            onClick={() => onRename(newName)}
            disabled={!newName || newName === filename}
          >
            Upload as renamed
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
