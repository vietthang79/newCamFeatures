import { INITIAL_COMPANIES } from "@/lib/mock-auth-data";
import EditCompanyClient from "./edit-company-client";

export function generateStaticParams() {
   return INITIAL_COMPANIES.map((company) => ({ id: company.id }));
}

export default function EditCompanyPage() {
   return <EditCompanyClient />;
}
