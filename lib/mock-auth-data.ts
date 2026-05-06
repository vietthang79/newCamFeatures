export type Role = "vendor_admin" | "operator";
export type Status = "active" | "inactive";

export interface CompanyRecord {
   id: string;
   name: string;
   slug: string;
   status: Status;
   createdAt: string;
}

export interface UserRecord {
   id: string;
   email: string;
   password: string;
   name: string;
   role: Role;
   companyId: string | null;
   status: Status;
   createdAt: string;
}

export const INITIAL_COMPANIES: CompanyRecord[] = [
   {
      id: "co1",
      name: "UK Parking Control",
      slug: "uk-parking-control",
      status: "active",
      createdAt: "2024-01-01",
   },
   {
      id: "co2",
      name: "CityPark Ltd",
      slug: "citypark-ltd",
      status: "active",
      createdAt: "2024-01-15",
   },
   {
      id: "co3",
      name: "SecureSpace Group",
      slug: "securespace-group",
      status: "active",
      createdAt: "2024-02-01",
   },
   {
      id: "co4",
      name: "Metro Parking",
      slug: "metro-parking",
      status: "inactive",
      createdAt: "2024-02-15",
   },
];

export const INITIAL_USERS: UserRecord[] = [
   {
      id: "u1",
      email: "admin@intellipark.io",
      password: "admin123",
      name: "Admin User",
      role: "vendor_admin",
      companyId: null,
      status: "active",
      createdAt: "2024-01-01",
   },
   {
      id: "u2",
      email: "john@ukparkingcontrol.com",
      password: "password123",
      name: "John Smith",
      role: "operator",
      companyId: "co1",
      status: "active",
      createdAt: "2024-01-15",
   },
   {
      id: "u3",
      email: "jane@citypark.com",
      password: "password123",
      name: "Jane Cooper",
      role: "operator",
      companyId: "co2",
      status: "active",
      createdAt: "2024-02-01",
   },
   {
      id: "u4",
      email: "mike@securespace.com",
      password: "password123",
      name: "Mike Johnson",
      role: "operator",
      companyId: "co3",
      status: "active",
      createdAt: "2024-02-15",
   },
   {
      id: "u5",
      email: "sarah@metroparking.com",
      password: "password123",
      name: "Sarah Wilson",
      role: "operator",
      companyId: "co4",
      status: "active",
      createdAt: "2024-03-01",
   },
      {
      id: "u6",
      email: "thang.nguyen@ukparkingcontrol.com",
      password: "password123",
      name: "Thang Nguyen",
      role: "operator",
      companyId: "co1",
      status: "active",
      createdAt: "2026-03-01",
   },
];

export function generateSlug(name: string): string {
   return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
}
