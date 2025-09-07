// app/layout.tsx
import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Reflector TradeBet - Stellar Network',
  description: 'Advanced trading and betting platform on Stellar blockchain using Soroban smart contracts',
  keywords: ['stellar', 'soroban', 'trading', 'betting', 'prediction market', 'defi', 'blockchain'],
  authors: [{ name: 'Reflector TradeBet' }],
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0a0e27',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" />
        <meta name="theme-color" content="#0a0e27" />
      </head>
      <body className={`${inter.className} antialiased`}>
        {children}
      </body>
    </html>
  )
}