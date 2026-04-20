import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/contexts/auth-context";
import { ThemeProvider } from "@/contexts/theme-context";
import { AppShell } from "@/components/layout/AppShell";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MyBotIA — Environnement de travail augmente",
  description: "Interface premium de pilotage et d'orchestration metier avec collaborateurs IA",
  icons: {
    icon: [
      { url: "https://res.cloudinary.com/dniurvpzd/image/upload/q_auto/f_auto/v1772032713/Logo_Collaborateur_IA_coujhr.svg", type: "image/svg+xml" },
    ],
    shortcut: "https://res.cloudinary.com/dniurvpzd/image/upload/q_auto/f_auto/v1772032713/Logo_Collaborateur_IA_coujhr.svg",
    apple: "https://res.cloudinary.com/dniurvpzd/image/upload/q_auto/f_auto/v1772032713/Logo_Collaborateur_IA_coujhr.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="h-full overflow-hidden bg-surface-0 text-text-primary">
        <ThemeProvider>
          <AuthProvider>
            <AppShell>{children}</AppShell>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
