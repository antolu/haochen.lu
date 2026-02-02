import * as React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./table";
import { Input } from "./input";
import { Badge } from "./badge";
import { ChevronUp, ChevronDown, Search } from "lucide-react";
import { cn } from "../../lib/utils";

interface Column<T> {
  key: keyof T | string;
  title: string;
  render?: (value: unknown, item: T, index: number) => React.ReactNode;
  sortable?: boolean;
  searchable?: boolean;
  width?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  searchPlaceholder?: string;
  onRowClick?: (item: T) => void;
  className?: string;
  emptyMessage?: string;
}

interface SortState {
  column: string;
  direction: "asc" | "desc";
}

export function DataTable<T extends Record<string, unknown>>({
  data,
  columns,
  searchPlaceholder = "Search...",
  onRowClick,
  className,
  emptyMessage = "No data available.",
}: DataTableProps<T>) {
  const [search, setSearch] = React.useState("");
  const [sortState, setSortState] = React.useState<SortState | null>(null);

  // Filter data based on search
  const filteredData = React.useMemo(() => {
    if (!search) return data;

    return data.filter((item) =>
      columns.some((column) => {
        if (!column.searchable) return false;
        const value = String(item[column.key as keyof T] || "").toLowerCase();
        return value.includes(search.toLowerCase());
      }),
    );
  }, [data, search, columns]);

  // Sort data
  const sortedData = React.useMemo(() => {
    if (!sortState) return filteredData;

    return [...filteredData].sort((a, b) => {
      const aValue = a[sortState.column as keyof T];
      const bValue = b[sortState.column as keyof T];

      if (aValue === bValue) return 0;

      const result = aValue < bValue ? -1 : 1;
      return sortState.direction === "asc" ? result : -result;
    });
  }, [filteredData, sortState]);

  const handleSort = (columnKey: string) => {
    setSortState((prev) => ({
      column: columnKey,
      direction:
        prev?.column === columnKey && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Search */}
      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead
                  key={String(column.key)}
                  className={cn(
                    "font-medium",
                    column.sortable &&
                      "cursor-pointer hover:bg-muted/50 select-none",
                    column.width && `w-${column.width}`,
                  )}
                  onClick={() =>
                    column.sortable && handleSort(String(column.key))
                  }
                >
                  <div className="flex items-center gap-2">
                    {column.title}
                    {column.sortable && (
                      <div className="flex flex-col">
                        <ChevronUp
                          className={cn(
                            "h-3 w-3",
                            sortState?.column === String(column.key) &&
                              sortState.direction === "asc"
                              ? "text-foreground"
                              : "text-muted-foreground",
                          )}
                        />
                        <ChevronDown
                          className={cn(
                            "h-3 w-3 -mt-1",
                            sortState?.column === String(column.key) &&
                              sortState.direction === "desc"
                              ? "text-foreground"
                              : "text-muted-foreground",
                          )}
                        />
                      </div>
                    )}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedData.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="text-center py-6 text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              sortedData.map((item, index) => (
                <TableRow
                  key={index}
                  className={cn(
                    onRowClick && "cursor-pointer hover:bg-muted/50",
                  )}
                  onClick={() => onRowClick?.(item)}
                >
                  {columns.map((column) => {
                    const value = item[column.key as keyof T];
                    return (
                      <TableCell key={String(column.key)}>
                        {column.render
                          ? column.render(value, item, index)
                          : String(value || "")}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Summary */}
      <div className="text-sm text-muted-foreground">
        Showing {sortedData.length} of {data.length} results
        {search && (
          <Badge variant="secondary" className="ml-2">
            Filtered
          </Badge>
        )}
      </div>
    </div>
  );
}
