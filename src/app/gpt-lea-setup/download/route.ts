import { promises as fs } from "fs";
import { NextResponse } from "next/server";

const ZIP_PATH = "/opt/mybotia/projects/gpt-lea/exports/gpt-lea-knowledge.zip";
const FILENAME = "gpt-lea-knowledge.zip";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const buf = await fs.readFile(ZIP_PATH);
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${FILENAME}"`,
        "Content-Length": String(buf.length),
        "Cache-Control": "public, max-age=120",
      },
    });
  } catch {
    return NextResponse.json({ error: "knowledge_pack_not_found" }, { status: 404 });
  }
}
