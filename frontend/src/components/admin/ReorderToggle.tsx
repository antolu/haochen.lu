import { cn } from "../../lib/utils";
import { Switch } from "../ui/switch";

interface ReorderToggleProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export function ReorderToggle({
  checked,
  onCheckedChange,
}: ReorderToggleProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 px-5 py-2 rounded-2xl border transition-colors",
        checked
          ? "bg-primary border-primary text-primary-foreground"
          : "bg-muted/40 border-border text-muted-foreground",
      )}
    >
      <span className="text-xs font-bold uppercase tracking-wider">
        Reorder
      </span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
