import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const origin = new URL(req.url).origin;
  return NextResponse.json({
    resource: `${origin}/mcp`,
    authorization_servers: [origin],
  });
}
