"use client";
import { useState, useMemo } from "react";
import Link from "next/link";
import { Plus, Search, Building2, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useData } from "@/lib/data-store";
import { useAuth } from "@/lib/auth-context";
import type { CompanyRecord } from "@/lib/mock-auth-data";
import { toast } from "sonner";

const columns: ColumnDef<CompanyRecord>[] = [
  {
    key: "name",
    header: "Company",
    sortable: true,
    sortType: "text",
    sortValue: c => c.name,
    render: c => (
      <div>
        <p className="font-medium text-gray-800">{c.name}</p>
        <p className="text-xs text-gray-500 font-mono">{c.slug}</p>
      </div>
    ),
  },
  {
    key: "status",
    header: "Status",
    sortable: true,
    sortType: "text",
    sortValue: c => c.status,
    render: c => (
      <Badge variant={c.status === "active" ? "default" : "secondary"} className="capitalize">
        {c.status}
      </Badge>
    ),
  },
  {
    key: "createdAt",
    header: "Created",
    sortable: true,
    sortType: "text",
    sortValue: c => c.createdAt,
    render: c => <span className="text-gray-500 text-xs">{c.createdAt}</span>,
  },
];

export default function CompaniesPage() {
  const { companies, users, deleteCompany } = useData();
  const { selectedCompanyId, setSelectedCompanyId } = useAuth();
  const [search, setSearch] = useState("");

  const filtered = useMemo(
    () => companies.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.slug.includes(search.toLowerCase())),
    [companies, search],
  );

  const handleDelete = (c: CompanyRecord) => {
    const count = users.filter(u => u.companyId === c.id).length;
    if (count > 0) {
      toast.error(`Cannot delete: ${count} user(s) are assigned to this company.`);
      return;
    }
    if (selectedCompanyId === c.id) {
      const next = companies.find(co => co.id !== c.id)?.id ?? null;
      setSelectedCompanyId(next);
    }
    deleteCompany(c.id);
    toast.success(`Company "${c.name}" deleted`);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-gray-900">Companies</h1>
          <Badge variant="secondary" className="text-xs">{companies.length}</Badge>
        </div>
        <Button asChild>
          <Link href="/admin/companies/new">
            <Plus className="h-4 w-4" /> New Company
          </Link>
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input placeholder="Search companies…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-gray-300 py-16 text-center">
          <Building2 className="h-12 w-12 text-gray-300" strokeWidth={1} />
          <div>
            <p className="font-medium text-gray-600">No companies found</p>
            <p className="text-sm text-gray-400">Create your first company to get started</p>
          </div>
          <Button asChild variant="outline">
            <Link href="/admin/companies/new"><Plus className="h-4 w-4" />New Company</Link>
          </Button>
        </div>
      )}

      {filtered.length > 0 && (
        <DataTable
          data={filtered}
          columns={columns}
          getRowKey={c => c.id}
          rowActions={c => (
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/admin/companies/${c.id}`}>
                  <Pencil className="h-3.5 w-3.5" />Edit
                </Link>
              </Button>
              <ConfirmDialog
                trigger={
                  <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600">
                    <Trash2 className="h-3.5 w-3.5" />Delete
                  </Button>
                }
                title={`Delete "${c.name}"?`}
                description="This action cannot be undone."
                confirmLabel="Delete"
                onConfirm={() => handleDelete(c)}
              />
            </div>
          )}
          mobileCard={c => (
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-gray-800">{c.name}</p>
                  <p className="text-xs font-mono text-gray-500 mt-0.5">{c.slug}</p>
                </div>
                <Badge variant={c.status === "active" ? "default" : "secondary"} className="capitalize">{c.status}</Badge>
              </div>
            </div>
          )}
        />
      )}
    </div>
  );
}
