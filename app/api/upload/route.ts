import { put } from "@vercel/blob"
import { NextResponse } from "next/server"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const form = await request.formData()
  const file = form.get("file")

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 })
  }

  const blob = await put(file.name, file, {
    access: "public",
    addRandomSuffix: true,
  })

  return NextResponse.json({
    url: blob.url,
    name: file.name,
    size: file.size,
    contentType: file.type || "application/octet-stream",
  })
}
