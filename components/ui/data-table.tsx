"use client";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronsUpDown, ChevronUp, ChevronRight } from "lucide-react";
import { ReactNode, useState } from "react";

type SortType = "text" | "number" | "boolean" | "date";
type SortDir = "asc" | "desc";

export interface ColumnDef<T> {
   key: string;
   header: string;
   className?: string;
   render: (row: T) => ReactNode;
   sortable?: boolean;
   sortType?: SortType;
   sortValue?: (row: T) => string | number | boolean | Date | null | undefined;
}

interface SortEntry {
   key: string;
   dir: SortDir;
}

interface DataTableProps<T> {
   data: T[];
   columns: ColumnDef<T>[];
   getRowKey: (row: T) => string;
   onRowClick?: (row: T) => void;
   rowActions?: (row: T) => ReactNode;
   mobileCard?: (row: T) => ReactNode;
   expandable?: (row: T) => ReactNode;
}

function compareValues(
   a: string | number | boolean | Date | null | undefined,
   b: string | number | boolean | Date | null | undefined,
   sortType: SortType,
): number {
   if (a == null && b == null) return 0;
   if (a == null) return 1;
   if (b == null) return -1;

   switch (sortType) {
      case "number":
         return (a as number) - (b as number);
      case "boolean":
         return a === b ? 0 : a ? -1 : 1;
      case "date":
         return new Date(a as Date).getTime() - new Date(b as Date).getTime();
      case "text":
      default:
         return String(a).localeCompare(String(b));
   }
}

function SortIcon({ col, sortList }: { col: ColumnDef<unknown>; sortList: SortEntry[] }) {
   if (!col.sortable) return null;
   const entry = sortList.find((s) => s.key === col.key);
   const priority = sortList.indexOf(entry!) + 1;

   return (
      <span className="ml-1 inline-flex items-center gap-0.5">
         {entry ? (
            entry.dir === "asc" ? (
               <ChevronUp className="h-3 w-3" />
            ) : (
               <ChevronDown className="h-3 w-3" />
            )
         ) : (
            <ChevronsUpDown className="h-3 w-3 opacity-40" />
         )}
         {sortList.length > 1 && entry && (
            <span className="text-[10px] leading-none opacity-60">{priority}</span>
         )}
      </span>
   );
}

export function DataTable<T>({
   data,
   columns,
   getRowKey,
   onRowClick,
   rowActions,
   mobileCard,
   expandable,
}: DataTableProps<T>) {
   const [sortList, setSortList] = useState<SortEntry[]>([]);
   const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

   const handleSort = (col: ColumnDef<T>) => {
      if (!col.sortable) return;
      setSortList((prev) => {
         const existing = prev.find((s) => s.key === col.key);
         if (!existing) return [...prev, { key: col.key, dir: "asc" }];
         if (existing.dir === "asc") return prev.map((s) => s.key === col.key ? { ...s, dir: "desc" } : s);
         return prev.filter((s) => s.key !== col.key);
      });
   };

   const toggleExpand = (key: string) => {
      setExpandedKeys((prev) => {
         const next = new Set(prev);
         next.has(key) ? next.delete(key) : next.add(key);
         return next;
      });
   };

   const sorted =
      sortList.length === 0
         ? data
         : [...data].sort((a, b) => {
              for (const entry of sortList) {
                 const col = columns.find((c) => c.key === entry.key)!;
                 const getValue =
                    col.sortValue ??
                    ((row: T) => (row as Record<string, unknown>)[col.key] as string);
                 const result = compareValues(getValue(a), getValue(b), col.sortType ?? "text");
                 if (result !== 0) return entry.dir === "asc" ? result : -result;
              }
              return 0;
           });

   const totalCols = columns.length + (rowActions ? 1 : 0) + (expandable ? 1 : 0);

   return (
      <>
         {/* Desktop table */}
         <div className="hidden md:block rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
               <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs text-gray-500">
                     {expandable && <th className="w-8 px-4 py-3" />}
                     {columns.map((col) => (
                        <th
                           key={col.key}
                           className={cn(
                              "px-4 py-3 font-medium",
                              col.sortable && "cursor-pointer select-none hover:text-gray-800",
                              col.className,
                           )}
                           onClick={() => handleSort(col)}
                        >
                           <span className="inline-flex items-center">
                              {col.header}
                              <SortIcon col={col as ColumnDef<unknown>} sortList={sortList} />
                           </span>
                        </th>
                     ))}
                     {rowActions && <th className="px-4 py-3 font-medium">Actions</th>}
                  </tr>
               </thead>
               <tbody>
                  {sorted.map((row, i) => {
                     const key = getRowKey(row);
                     const isExpanded = expandedKeys.has(key);
                     return (
                        <>
                           <tr
                              key={key}
                              onClick={() => expandable ? toggleExpand(key) : onRowClick?.(row)}
                              className={cn(
                                 "border-b border-gray-100 transition-colors",
                                 i % 2 === 0 ? "bg-white" : "bg-gray-50/50",
                                 (onRowClick || expandable) && "cursor-pointer hover:bg-gray-50",
                              )}
                           >
                              {expandable && (
                                 <td className="px-4 py-3 text-gray-400">
                                    {isExpanded
                                       ? <ChevronDown className="h-4 w-4" />
                                       : <ChevronRight className="h-4 w-4" />}
                                 </td>
                              )}
                              {columns.map((col) => (
                                 <td key={col.key} className={cn("px-4 py-3", col.className)}>
                                    {col.render(row)}
                                 </td>
                              ))}
                              {rowActions && (
                                 <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                    {rowActions(row)}
                                 </td>
                              )}
                           </tr>
                           {expandable && isExpanded && (
                              <tr key={`${key}-expand`} className="border-b border-gray-100">
                                 <td colSpan={totalCols} className="bg-gray-50 px-4 py-0">
                                    {expandable(row)}
                                 </td>
                              </tr>
                           )}
                        </>
                     );
                  })}
               </tbody>
            </table>
         </div>

         {/* Mobile cards */}
         {mobileCard && (
            <div className="grid gap-3 md:hidden">
               {sorted.map((row) => (
                  <div
                     key={getRowKey(row)}
                     onClick={() => onRowClick?.(row)}
                     className={cn(onRowClick && "cursor-pointer")}
                  >
                     {mobileCard(row)}
                  </div>
               ))}
            </div>
         )}
      </>
   );
}
