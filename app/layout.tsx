import { Geist_Mono, Inter } from "next/font/google"
import { getServerSession } from "next-auth"

import "./globals.css"
import { AuthSessionProvider } from "@/components/auth/session-provider"
import { ThemeProvider } from "@/components/theme-provider"
import { TRPCProvider } from "@/components/providers"
import { authOptions } from "@/lib/auth"
import { UserProvider } from "@/lib/user-context"
import { cn } from "@/lib/utils"

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export const metadata = {
  title: "Staged",
  description: "The workspace where work moves forward",
  metadataBase: new URL("https://staged.codula.in"),
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
  openGraph: {
    title: "Staged — The workspace where work moves forward",
    description:
      "Channels, tasks, docs, and AI — everything your team needs, in one place.",
    url: "https://staged.codula.in",
    siteName: "Staged",
    images: ["/logo.png"],
  },
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const session = await getServerSession(authOptions)

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "antialiased",
        fontMono.variable,
        "font-sans",
        inter.variable
      )}
    >
      <body>
        <AuthSessionProvider session={session}>
          <ThemeProvider>
            <TRPCProvider>
              <UserProvider>{children}</UserProvider>
            </TRPCProvider>
          </ThemeProvider>
        </AuthSessionProvider>
      </body>
    </html>
  )
}
