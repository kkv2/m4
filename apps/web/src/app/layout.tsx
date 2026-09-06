import type { Metadata } from "next";
import type { ReactNode } from "react";

import { TRPCProvider } from "~/lib/trpc-client";
import "./globals.css";

export const metadata: Metadata = {
  title: "M4 — Multi Model, Multi Modal.",
  description: "One workspace. Many models. Any modality.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">
        <TRPCProvider>{children}</TRPCProvider>
      </body>
    </html>
  );
}
