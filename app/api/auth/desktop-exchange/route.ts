import { type NextRequest, NextResponse } from "next/server"
import { consumeDesktopCode } from "@/lib/desktop-auth-codes"

// Called by the Electron app with the short-lived code.
// Responds with Set-Cookie so the persist:webapp session gets the NextAuth token.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code")
  if (!code) {
    return new NextResponse("Missing code", { status: 400 })
  }

  const token = consumeDesktopCode(code)
  if (!token) {
    return new NextResponse("Invalid or expired code", { status: 401 })
  }

  const url = new URL(request.url)
  const useSecureCookies = url.protocol === "https:"
  const cookieName = useSecureCookies
    ? "__Secure-next-auth.session-token"
    : "next-auth.session-token"

  const response = NextResponse.json({ ok: true })
  response.cookies.set({
    name: cookieName,
    value: token,
    httpOnly: true,
    secure: useSecureCookies,
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  })

  return response
}
