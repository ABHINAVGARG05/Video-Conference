// src/app/layout.tsx
import { ClerkProvider } from '@clerk/nextjs'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import NavBar from '@/components/layout/NavBar'
import Container from '@/components/layout/Container'
import SocketProvider from '@/provider/SocketProvider'
import { cn } from '@/lib/utils'
import ClerkHeader from "@/components/ClerkHeader";

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={cn(`${geistSans.variable} ${geistMono.variable} antialiased`)}>
          <ClerkHeader /> {/* 👈 Safely rendered as client component */}
          <SocketProvider>
            <main className="flex flex-col min-h-screen bg-secondary">
              <NavBar />
              <Container>{children}</Container>
            </main>
          </SocketProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
