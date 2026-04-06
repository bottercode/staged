import { type NextRequest, NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"
import { randomBytes } from "crypto"
import { storeDesktopCode } from "@/lib/desktop-auth-codes"

// Called by NextAuth as the callbackUrl after successful Google sign-in.
// Generates a short-lived code and redirects to the Staged desktop app via deep link.
export async function GET(request: NextRequest) {
  const token = await getToken({
    req: request,
    raw: true,
    secret: process.env.NEXTAUTH_SECRET,
  })

  if (!token) {
    return NextResponse.redirect(new URL("/auth/signin", request.url))
  }

  const code = randomBytes(32).toString("hex")
  storeDesktopCode(code, token)

  // Deep link back to the Electron app
  return NextResponse.redirect(`staged://auth?code=${code}`)
}
