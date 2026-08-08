import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KuruFeetha — Maldives, in brief",
  description: "Bilingual, editor-reviewed news from across the Maldives in 60 words or fewer.",
  icons: {
    icon: [{ url: "/kurufeetha-icon.svg", type: "image/svg+xml" }],
    shortcut: "/kurufeetha-icon.svg",
  },
  openGraph: {
    title: "KuruFeetha — Maldives, in brief",
    description: "Bilingual, editor-reviewed news from across the Maldives in 60 words or fewer.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "KuruFeetha — Maldives, in brief" }],
  },
  twitter: { card: "summary_large_image", images: ["/og.png"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
