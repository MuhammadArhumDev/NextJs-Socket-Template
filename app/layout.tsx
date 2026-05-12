import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Socket.IO — Real-Time Counter",
  description: "Live demonstration of Socket.IO integrated with Next.js App Router",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
