import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'ParagonMythraOS Dashboard',
  description: 'Real-time control panel for Paragon escape rooms'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-100 min-h-screen">
        <div className="max-w-7xl mx-auto px-6 py-10">
          <header className="mb-10">
            <h1 className="text-3xl font-semibold text-paragon-accent">ParagonMythraOS Control Center</h1>
            <p className="text-slate-400 mt-2">
              Live status of devices, puzzles, and system services.
            </p>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
