export async function sendWorkspaceInviteEmail(params: {
  toEmail: string
  workspaceName: string
  role: "admin" | "member"
}) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL
  const appUrl = process.env.NEXTAUTH_URL || "http://localhost:3000"

  if (!apiKey || !from) {
    return {
      sent: false,
      reason: "missing_email_provider_config",
    } as const
  }

  const inviteUrl = `${appUrl}/auth/signin`

  const html = `
    <div style="font-family: Inter, Arial, sans-serif; line-height: 1.5; color: #111827;">
      <h2 style="margin: 0 0 12px;">You're invited to ${params.workspaceName}</h2>
      <p style="margin: 0 0 12px;">You were invited as <strong>${params.role}</strong>.</p>
      <p style="margin: 0 0 20px;">Sign in with this email address to join the workspace.</p>
      <a href="${inviteUrl}" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;">Open Workspace</a>
      <p style="margin-top: 20px; color: #6b7280; font-size: 12px;">If you did not expect this invite, you can ignore this email.</p>
    </div>
  `

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [params.toEmail],
      subject: `You're invited to ${params.workspaceName}`,
      html,
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => "")
    return {
      sent: false,
      reason: `provider_error:${res.status}:${body}`,
    } as const
  }

  return { sent: true } as const
}
