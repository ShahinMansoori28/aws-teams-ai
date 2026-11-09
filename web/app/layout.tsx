import type { ReactNode } from "react";
import "./globals.css";

export const metadata = { title: "Teams AI", description: "Chat with your team and AI, built on AWS" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
