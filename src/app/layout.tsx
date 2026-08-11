import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Expedition OS",
  description: "Plan routes, measure readiness, and turn ambitious adventures into evidence-backed plans.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
