"use client";
import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  Camera as CameraIcon,
  MoreHorizontal,
  Trash2,
  Eye,
  Building2,
} from "lucide-react";
import { MOCK_CAMERAS, MOCK_COMPANIES, type Camera } from "@/lib/mock-data";
import { formatTimeAgo } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/cameras/status-badge";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

type StatusFilter = "all" | "online" | "warning" | "offline" | "pending";

const columns: ColumnDef<Camera>[] = [
  {
    key: "name",
    header: "Name",
    sortable: true,
    sortType: "text",
    sortValue: (c) => c.name,
    render: (c) => (
      <div>
        <p className="font-medium text-gray-800">{c.name}</p>
        <p className="text-xs text-gray-500">{c.model}</p>
      </div>
    ),
  },
  {
    key: "ip",
    header: "IP Address",
    render: (c) => (
      <span className="font-mono text-xs text-gray-600">
        {c.ip}:{c.port}
      </span>
    ),
  },
  {
    key: "location",
    header: "Location",
    sortable: true,
    sortType: "text",
    sortValue: (c) => c.location ?? "",
    render: (c) => <span className="text-gray-500">{c.location || "—"}</span>,
  },
  {
    key: "status",
    header: "Status",
    sortable: true,
    sortType: "text",
    sortValue: (c) => c.status,
    render: (c) => <StatusBadge status={c.status} />,
  },
  {
    key: "last_frame_at",
    header: "Last Frame",
    sortable: true,
    sortType: "date",
    sortValue: (c) => c.last_frame_at,
    render: (c) => (
      <span className="text-gray-500 text-xs">
        {formatTimeAgo(c.last_frame_at)}
      </span>
    ),
  },
];

export default function CamerasPage() {
  const router = useRouter();
  const { effectiveCompanyId, session } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const companyCameras = useMemo(() => {
    if (!effectiveCompanyId) return [];
    const co = MOCK_COMPANIES.find(c => c.id === effectiveCompanyId);
    return co?.cameras ?? [];
  }, [effectiveCompanyId]);

  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set())
  const cameras = useMemo(() => companyCameras.filter(c => !deletedIds.has(c.id)), [companyCameras, deletedIds])

  const filtered = useMemo(
    () =>
      cameras.filter((c) => {
        const matchSearch =
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.ip.includes(search);
        const matchStatus =
          statusFilter === "all" || c.status === statusFilter;
        return matchSearch && matchStatus;
      }),
    [cameras, search, statusFilter],
  );

  const handleDelete = (id: string, name: string) => {
    setDeletedIds(prev => new Set([...prev, id]));
    toast.success(`Camera "${name}" deleted`);
  };

  const currentCompany = MOCK_COMPANIES.find(c => c.id === effectiveCompanyId);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-gray-900">Cameras</h1>
          <Badge variant="secondary" className="text-xs">
            {cameras.length}
          </Badge>
          {currentCompany && (
            <div className="flex items-center gap-1.5 rounded-md bg-gray-100 px-2 py-1">
              <Building2 className="h-3 w-3 text-pri-text" />
              <span className="text-xs text-gray-600">{currentCompany.name}</span>
            </div>
          )}
        </div>
        {session?.role === 'vendor_admin' && (
          <Button asChild>
            <Link href="/cameras/new">
              <Plus className="h-4 w-4" />
              Add Camera
            </Link>
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search by name or IP…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as StatusFilter)}
        >
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="online">Online</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
            <SelectItem value="offline">Offline</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-gray-300 py-16 text-center">
          <CameraIcon className="h-12 w-12 text-gray-300" strokeWidth={1} />
          <div>
            <p className="font-medium text-gray-600">No cameras found</p>
            <p className="text-sm text-gray-400">
              {cameras.length === 0
                ? "No cameras assigned to this company yet"
                : "Try adjusting your search or filters"}
            </p>
          </div>
        </div>
      )}

      {filtered.length > 0 && (
        <DataTable
          data={filtered}
          columns={columns}
          getRowKey={(c) => c.id}
          onRowClick={(c) => router.push(`/cameras/${c.id}/overview`)}
          rowActions={(c) => (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/cameras/${c.id}/overview`}>
                  <Eye className="h-3.5 w-3.5" />
                  View
                </Link>
              </Button>
              {session?.role === 'vendor_admin' && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="More actions">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => handleDelete(c.id, c.name)}
                      className="text-red-500 focus:text-red-600"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          )}
          mobileCard={(c) => (
            <div className="rounded-lg border border-gray-200 bg-white p-4 hover:border-gray-300 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-gray-800">{c.name}</p>
                  <p className="text-xs font-mono text-gray-500 mt-0.5">
                    {c.ip}:{c.port}
                  </p>
                </div>
                <StatusBadge status={c.status} />
              </div>
              <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                <span>{c.location || "No location"}</span>
                <span>Last frame: {formatTimeAgo(c.last_frame_at)}</span>
              </div>
            </div>
          )}
        />
      )}
    </div>
  );
}
