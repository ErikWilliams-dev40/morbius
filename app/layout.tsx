import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mobius — Project workspace",
  description: "Move projects from request to prototype, review, and developer handoff.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
