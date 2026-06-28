import { FeedbackWidget } from "@/components/feedback-widget";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 min-h-screen">
      {children}
      <FeedbackWidget />
    </div>
  );
}
