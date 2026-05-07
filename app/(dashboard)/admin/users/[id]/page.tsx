import { INITIAL_USERS } from "@/lib/mock-auth-data";
import EditUserClient from "./edit-user-client";

export function generateStaticParams() {
   return INITIAL_USERS.map((user) => ({ id: user.id }));
}

export default function EditUserPage() {
   return <EditUserClient />;
}
