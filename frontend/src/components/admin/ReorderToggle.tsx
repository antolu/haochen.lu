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
    <div className="flex items-center gap-3 bg-muted/30 px-4 py-2 rounded-xl border border-dashed border-border/60">
      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">
        Reorder
      </span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
