import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
// Import Mapbox GL CSS globally
import "mapbox-gl/dist/mapbox-gl.css"
import { ThemeProvider } from "@/components/theme-provider" // Import ThemeProvider

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Smart Railway Navigation App",
  description: "Navigate railway stations with ease.",
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>{/* No Google Maps script tag needed anymore */}</head>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
