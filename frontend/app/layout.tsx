import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Farm Instinct",
  description: "A strengths assessment built for farmers.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
