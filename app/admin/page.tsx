import type { Metadata } from "next";
import { AdminPaymentsDashboard } from "@/components/AdminPaymentsDashboard";

export const metadata: Metadata = {
  title: "관리자 결제 확인 | 분철.",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return <AdminPaymentsDashboard />;
}
