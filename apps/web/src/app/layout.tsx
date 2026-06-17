import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], display: 'swap' });

export const metadata: Metadata = {
  title: 'Nexus Sentinel — Prompt Firewall',
  description:
    'A self-hosted prompt firewall for any LLM. Screen prompts for PII, secrets, prompt injection, and denied topics — allow, redact, or block.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.className}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
