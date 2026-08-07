import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";

// Registro dinâmico de cliente (DCR). Não persistimos nada — qualquer
// cliente MCP recebe um client_id novo; a validação real acontece no
// /authorize (que exige o login de verdade na conta Google).
//
// IMPORTANTE: redirect_uris é sempre forçado para /auth/spreadsheets,
// independentemente do que o cliente manda. O Google Cloud OAuth só aceita
// essa URI cadastrada. Se o ChatGPT ou outro cliente mandar uma URI própria,
// ignoramos e usamos a nossa.
export async function POST(req: NextRequest) {
  const clientId = crypto.randomBytes(16).toString("hex");
  const origin = new URL(req.url).origin;

  return NextResponse.json({
    client_id: clientId,
    client_id_issued_at: Math.floor(Date.now() / 1000),
    redirect_uris: [`${origin}/auth/spreadsheets`],
    token_endpoint_auth_method: "none",
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
  });
}
