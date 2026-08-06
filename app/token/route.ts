import { NextRequest, NextResponse } from "next/server";
import { decodeSignedPayload, verifyPkce } from "@/lib/oauth-tokens";

type CodePayload = {
  codeChallenge: string;
  codeChallengeMethod: string;
};

// O cliente MCP troca o código que devolvemos por um access_token.
// Como só existe uma conta Google por trás disso, o "access_token"
// que emitimos é o mesmo MCP_SHARED_SECRET que o /mcp já valida.
export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") ?? "";
  let params: Record<string, string>;

  if (contentType.includes("application/json")) {
    params = await req.json().catch(() => ({}));
  } else {
    const text = await req.text();
    params = Object.fromEntries(new URLSearchParams(text));
  }

  const secret = process.env.MCP_SHARED_SECRET;
  if (!secret) return NextResponse.json({ error: "server_error" }, { status: 500 });

  const grantType = params.grant_type;

  if (grantType === "authorization_code") {
    const code = params.code;
    if (!code) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

    let payload: CodePayload;
    try {
      payload = decodeSignedPayload<CodePayload>(code);
    } catch {
      return NextResponse.json({ error: "invalid_grant" }, { status: 400 });
    }

    if (!verifyPkce(payload.codeChallenge, payload.codeChallengeMethod, params.code_verifier)) {
      return NextResponse.json({ error: "invalid_grant", error_description: "PKCE inválido." }, { status: 400 });
    }

    return NextResponse.json({
      access_token: secret,
      token_type: "Bearer",
      expires_in: 31536000,
      refresh_token: secret,
    });
  }

  if (grantType === "refresh_token") {
    return NextResponse.json({
      access_token: secret,
      token_type: "Bearer",
      expires_in: 31536000,
    });
  }

  return NextResponse.json({ error: "unsupported_grant_type" }, { status: 400 });
}
