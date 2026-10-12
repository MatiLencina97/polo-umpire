import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Umpire Polo Assistant",
  description: "Offline polo rulebook assistant for umpires",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Umpire Polo Assistant",
  },
  icons: {
    icon: [
      { url: "/logo.png", sizes: "1254x1254", type: "image/png" }
    ],
    apple: [{ url: "/logo.png", sizes: "1254x1254", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#0b1730",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
