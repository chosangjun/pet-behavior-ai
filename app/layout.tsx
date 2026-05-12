import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MomentPet",
  description: "반려동물 사진 기반 행동 가능성 분석 앱",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
