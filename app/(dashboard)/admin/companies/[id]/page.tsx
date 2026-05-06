"use client";
import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useData } from "@/lib/data-store";
import { generateSlug, type Status } from "@/lib/mock-auth-data";
import { toast } from "sonner";

export default function EditCompanyPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { companies, users, updateCompany } = useData();
  const company = companies.find(c => c.id === id);

  const [name, setName] = useState(company?.name ?? "");
  const [status, setStatus] = useState<Status>(company?.status ?? "active");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!company) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <p className="text-gray-500">Company not found.</p>
        <Button asChild variant="outline"><Link href="/admin/companies">Back to Companies</Link></Button>
      </div>
    );
  }

  const slug = generateSlug(name);
  const companyUsers = users.filter(u => u.companyId === id);

  const handleSave = async () => {
    if (!name.trim()) { setError("Company name is required."); return; }
    setSaving(true);
    await new Promise(r => setTimeout(r, 400));
    updateCompany(id, { name: name.trim(), status });
    toast.success("Company updated");
    router.push("/admin/companies");
  };

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/companies"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <h1 className="text-xl font-bold text-gray-900">Edit Company</h1>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-5">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">Company Name <span className="text-red-500">*</span></label>
          <Input
            value={name}
            onChange={e => { setName(e.target.value); setError(""); }}
          />
          {name && (
            <p className="text-xs text-gray-400">Slug: <span className="font-mono text-gray-500">{slug}</span></p>
          )}
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">Status</label>
          <Select value={status} onValueChange={v => setStatus(v as Status)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="border-t border-gray-200 pt-4 space-y-1.5">
          <p className="text-sm text-gray-500">
            <span className="font-medium text-gray-700">{companyUsers.length}</span> user(s) assigned to this company
          </p>
        </div>

        <div className="flex gap-3 pt-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save Changes"}
          </Button>
          <Button variant="outline" asChild disabled={saving}>
            <Link href="/admin/companies">Cancel</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
