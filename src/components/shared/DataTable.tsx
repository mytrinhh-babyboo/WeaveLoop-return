import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ErrorState, EmptyState, TableRowsSkeleton } from "./StateViews";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  header: string;
  align?: "left" | "right" | "center";
  width?: string;
  render: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[] | undefined;
  isLoading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  onRowClick?: (row: T) => void;
  emptyTitle: string;
  emptyDescription?: string;
  rowKey: (row: T) => string;
  initialSort?: { key: string; dir: "asc" | "desc" };
}

/** Enterprise operational data table with sort, loading, empty and error states. */
export function DataTable<T>({
  columns,
  rows,
  isLoading,
  error,
  onRetry,
  onRowClick,
  emptyTitle,
  emptyDescription,
  rowKey,
  initialSort,
}: DataTableProps<T>) {
  const [sort, setSort] = useState(initialSort);

  if (error) {
    return <ErrorState error={error} onRetry={onRetry} />;
  }
  if (isLoading || rows === undefined) {
    return <TableRowsSkeleton />;
  }

  let sorted = rows;
  if (sort) {
    const col = columns.find((c) => c.key === sort.key && c.sortValue);
    if (col?.sortValue) {
      sorted = [...rows].sort((a, b) => {
        const av = col.sortValue!(a);
        const bv = col.sortValue!(b);
        const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
        return sort.dir === "asc" ? cmp : -cmp;
      });
    }
  }

  if (sorted.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  const toggleSort = (col: Column<T>) => {
    if (!col.sortValue) return;
    setSort((prev) =>
      prev?.key === col.key ? { key: col.key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key: col.key, dir: "asc" },
    );
  };

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {columns.map((col) => (
              <TableHead
                key={col.key}
                style={col.width ? { width: col.width } : undefined}
                className={cn(col.align === "right" && "text-right", col.align === "center" && "text-center")}
              >
                {col.sortValue ? (
                  <button
                    type="button"
                    onClick={() => toggleSort(col)}
                    className="inline-flex items-center gap-1 font-medium hover:text-foreground"
                  >
                    {col.header}
                    {sort?.key === col.key ? (
                      sort.dir === "asc" ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronsUpDown className="h-3 w-3 text-muted-foreground/50" />
                    )}
                  </button>
                ) : (
                  col.header
                )}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((row) => (
            <TableRow
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn(onRowClick && "cursor-pointer")}
            >
              {columns.map((col) => (
                <TableCell
                  key={col.key}
                  className={cn(col.align === "right" && "text-right", col.align === "center" && "text-center")}
                >
                  {col.render(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
