import { NextResponse } from "next/server";

// MCP OAuth discovery: Authorization Server Metadata
// Compatível com RFC 8414 + MCP spec
export async function GET() {
  const metadata = {
    issuer: "https://google-planilhas-mcp.vercel.app",
    authorization_endpoint: "https://google-planilhas-mcp.vercel.app/authorize",
    token_endpoint: "https://google-planilhas-mcp.vercel.app/token",
    registration_endpoint: "https://google-planilhas-mcp.vercel.app/register",
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    token_endpoint_auth_methods_supported: ["none"],
    code_challenge_methods_supported: ["S256", "plain"],
    scopes_supported: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/script.projects",
      "https://www.googleapis.com/auth/script.deployments",
    ],
  };

  return NextResponse.json(metadata, {
    headers: { "Content-Type": "application/json" },
  });
}
