import FeedbackAdminDashboard from "@/components/FeedbackAdminDashboard";

export const metadata = {
  title: "Feedback & Quality · Polo Umpire Assistant",
  robots: { index: false, follow: false },
};

export default function FeedbackAdminPage() {
  return <FeedbackAdminDashboard />;
}
