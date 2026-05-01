import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Todo Desk",
  description: "A full-stack todo list built with FastAPI, Next.js, and shadcn UI.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
