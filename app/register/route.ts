import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";

// Registro dinâmico de cliente (DCR). Não persistimos nada — qualquer
// cliente MCP recebe um client_id novo; a validação real acontece no
// /authorize (que exige o login de verdade na conta Google).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const clientId = crypto.randomBytes(16).toString("hex");

  return NextResponse.json({
    client_id: clientId,
    client_id_issued_at: Math.floor(Date.now() / 1000),
    redirect_uris: body.redirect_uris ?? [],
    token_endpoint_auth_method: "none",
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
  });
}
