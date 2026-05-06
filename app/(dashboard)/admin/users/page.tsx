"use client";
import { useState, useMemo } from "react";
import Link from "next/link";
import { Plus, Search, Users, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useData } from "@/lib/data-store";
import type { UserRecord } from "@/lib/mock-auth-data";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

const ROLE_LABELS: Record<string, string> = {
  vendor_admin: "Vendor Admin",
  operator: "Operator",
};

export default function UsersPage() {
  const { companies, users, deleteUser } = useData();
  const { session } = useAuth();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [companyFilter, setCompanyFilter] = useState("all");

  const filtered = useMemo(() => {
    return users.filter(u => {
      const matchSearch =
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase());
      const matchRole = roleFilter === "all" || u.role === roleFilter;
      const matchCompany = companyFilter === "all" || u.companyId === companyFilter;
      return matchSearch && matchRole && matchCompany;
    });
  }, [users, search, roleFilter, companyFilter]);

  const getCompanyName = (companyId: string | null) =>
    companyId ? (companies.find(c => c.id === companyId)?.name ?? "Unknown") : "—";

  const columns: ColumnDef<UserRecord>[] = [
    {
      key: "name",
      header: "User",
      sortable: true,
      sortType: "text",
      sortValue: u => u.name,
      render: u => (
        <div>
          <p className="font-medium text-gray-800">{u.name}</p>
          <p className="text-xs text-gray-500">{u.email}</p>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      sortable: true,
      sortType: "text",
      sortValue: u => u.role,
      render: u => (
        <Badge variant={u.role === "vendor_admin" ? "default" : "secondary"} className="text-xs">
          {ROLE_LABELS[u.role]}
        </Badge>
      ),
    },
    {
      key: "company",
      header: "Company",
      render: u => <span className="text-gray-500 text-sm">{getCompanyName(u.companyId)}</span>,
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      sortType: "text",
      sortValue: u => u.status,
      render: u => (
        <Badge variant={u.status === "active" ? "default" : "secondary"} className="capitalize text-xs">
          {u.status}
        </Badge>
      ),
    },
    {
      key: "createdAt",
      header: "Created",
      sortable: true,
      sortType: "text",
      sortValue: u => u.createdAt,
      render: u => <span className="text-gray-500 text-xs">{u.createdAt}</span>,
    },
  ];

  const handleDelete = (u: UserRecord) => {
    if (u.id === session?.userId) {
      toast.error("You cannot delete your own account.");
      return;
    }
    deleteUser(u.id);
    toast.success(`User "${u.name}" deleted`);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-gray-900">Users</h1>
          <Badge variant="secondary" className="text-xs">{users.length}</Badge>
        </div>
        <Button asChild>
          <Link href="/admin/users/new">
            <Plus className="h-4 w-4" />New User
          </Link>
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input placeholder="Search by name or email…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="All Roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="vendor_admin">Vendor Admin</SelectItem>
            <SelectItem value="operator">Operator</SelectItem>
          </SelectContent>
        </Select>
        <Select value={companyFilter} onValueChange={setCompanyFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="All Companies" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Companies</SelectItem>
            {companies.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-gray-300 py-16 text-center">
          <Users className="h-12 w-12 text-gray-300" strokeWidth={1} />
          <div>
            <p className="font-medium text-gray-600">No users found</p>
            <p className="text-sm text-gray-400">Try adjusting your filters</p>
          </div>
        </div>
      )}

      {filtered.length > 0 && (
        <DataTable
          data={filtered}
          columns={columns}
          getRowKey={u => u.id}
          rowActions={u => (
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/admin/users/${u.id}`}>
                  <Pencil className="h-3.5 w-3.5" />Edit
                </Link>
              </Button>
              <ConfirmDialog
                trigger={
                  <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600">
                    <Trash2 className="h-3.5 w-3.5" />Delete
                  </Button>
                }
                title={`Delete "${u.name}"?`}
                description="This action cannot be undone."
                confirmLabel="Delete"
                onConfirm={() => handleDelete(u)}
              />
            </div>
          )}
          mobileCard={u => (
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-gray-800">{u.name}</p>
                  <p className="text-xs text-gray-500">{u.email}</p>
                  <p className="text-xs text-gray-400 mt-1">{getCompanyName(u.companyId)}</p>
                </div>
                <Badge variant={u.role === "vendor_admin" ? "default" : "secondary"} className="text-xs">
                  {ROLE_LABELS[u.role]}
                </Badge>
              </div>
            </div>
          )}
        />
      )}
    </div>
  );
}
