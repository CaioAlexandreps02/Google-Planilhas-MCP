import { NextResponse } from "next/server";

// MCP OAuth discovery: Protected Resource Metadata
// https://modelcontextprotocol.io/specification/2025-03-26/basic/authorization#discovery
export async function GET() {
  const metadata = {
    resource: "https://google-planilhas-mcp.vercel.app",
    authorization_servers: [
      {
        issuer: "https://google-planilhas-mcp.vercel.app",
        authorization_endpoint: "https://google-planilhas-mcp.vercel.app/authorize",
        token_endpoint: "https://google-planilhas-mcp.vercel.app/token",
        registration_endpoint: "https://google-planilhas-mcp.vercel.app/register",
        response_types_supported: ["code"],
        grant_types_supported: ["authorization_code", "refresh_token"],
        token_endpoint_auth_methods_supported: ["none"],
        code_challenge_methods_supported: ["S256", "plain"],
      },
    ],
    bearer_methods_supported: ["header", "query"],
  };

  return NextResponse.json(metadata, {
    headers: { "Content-Type": "application/json" },
  });
}
