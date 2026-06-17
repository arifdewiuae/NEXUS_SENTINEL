import type { Metadata } from 'next';
import { JetBrains_Mono } from 'next/font/google';
import { CrtOverlay } from '@/components/CrtOverlay';
import { MatrixRain } from '@/components/MatrixRain';
import './globals.css';

const mono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jbmono',
});

export const metadata: Metadata = {
  title: 'NEXUS://SENTINEL — Prompt Firewall',
  description:
    'A self-hosted prompt firewall for any LLM. Screen prompts for PII, secrets, prompt injection, and denied topics — allow, redact, or block.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={mono.variable}>
      <body className="min-h-screen antialiased">
        <MatrixRain />
        <div className="relative z-10">{children}</div>
        <CrtOverlay />
      </body>
    </html>
  );
}
