"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useData } from "@/lib/data-store";
import { type Role, type Status } from "@/lib/mock-auth-data";
import { toast } from "sonner";

export default function NewUserPage() {
  const router = useRouter();
  const { companies, users, addUser } = useData();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [role, setRole] = useState<Role>("operator");
  const [companyId, setCompanyId] = useState<string>("none");
  const [status, setStatus] = useState<Status>("active");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Name is required.";
    if (!email.trim()) e.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "Invalid email format.";
    else if (users.some(u => u.email === email.trim())) e.email = "Email already in use.";
    if (!password) e.password = "Password is required.";
    else if (password.length < 6) e.password = "Password must be at least 6 characters.";
    if (role === "operator" && companyId === "none") e.company = "Operators must be assigned to a company.";
    return e;
  };

  const handleSave = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true);
    await new Promise(r => setTimeout(r, 400));
    addUser({
      name: name.trim(), email: email.trim(), password,
      role, companyId: companyId === "none" ? null : companyId, status,
    });
    toast.success("User created successfully");
    router.push("/admin/users");
  };

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/users"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <h1 className="text-xl font-bold text-gray-900">New User</h1>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-5">
        <Field label="Full Name" required error={errors.name}>
          <Input placeholder="e.g. Jane Smith" value={name} onChange={e => { setName(e.target.value); setErrors(p => ({ ...p, name: "" })); }} />
        </Field>

        <Field label="Email" required error={errors.email}>
          <Input type="email" placeholder="user@example.com" value={email} onChange={e => { setEmail(e.target.value); setErrors(p => ({ ...p, email: "" })); }} />
        </Field>

        <Field label="Password" required error={errors.password}>
          <div className="relative">
            <Input
              type={showPass ? "text" : "password"} placeholder="Min. 6 characters"
              value={password} onChange={e => { setPassword(e.target.value); setErrors(p => ({ ...p, password: "" })); }}
              className="pr-10"
            />
            <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer">
              {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </Field>

        <Field label="Role" required>
          <Select value={role} onValueChange={v => { setRole(v as Role); setErrors(p => ({ ...p, company: "" })); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="operator">Operator</SelectItem>
              <SelectItem value="vendor_admin">Vendor Admin</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Field label="Company" error={errors.company} hint={role === "vendor_admin" ? "Not required for Vendor Admins" : undefined}>
          <Select value={companyId} onValueChange={v => { setCompanyId(v); setErrors(p => ({ ...p, company: "" })); }} disabled={role === "vendor_admin"}>
            <SelectTrigger><SelectValue placeholder="Select company…" /></SelectTrigger>
            <SelectContent>
              {role === "vendor_admin" && <SelectItem value="none">No company</SelectItem>}
              {companies.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Status">
          <Select value={status} onValueChange={v => setStatus(v as Status)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <div className="flex gap-3 pt-2">
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Create User"}</Button>
          <Button variant="outline" asChild disabled={saving}><Link href="/admin/users">Cancel</Link></Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, required, error, hint, children }: { label: string; required?: boolean; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
