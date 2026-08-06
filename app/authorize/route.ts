import { NextRequest, NextResponse } from "next/server";
import { getOAuthClient } from "@/lib/google-oauth";
import { encodeSignedPayload } from "@/lib/oauth-tokens";

// Ponto de entrada do fluxo: o cliente MCP (Claude, etc.) manda o
// usuário pra cá. A gente "embrulha" o pedido dele num state assinado
// e manda o usuário pra tela de verdade do Google.
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const redirectUri = sp.get("redirect_uri");
  const state = sp.get("state") ?? "";
  const codeChallenge = sp.get("code_challenge") ?? "";
  const codeChallengeMethod = sp.get("code_challenge_method") ?? "plain";

  if (!redirectUri) {
    return new NextResponse("Parâmetro redirect_uri é obrigatório.", { status: 400 });
  }

  const googleState = encodeSignedPayload({
    redirectUri,
    state,
    codeChallenge,
    codeChallengeMethod,
    exp: Date.now() + 10 * 60 * 1000,
  });

  const googleRedirectUri = new URL("/auth/spreadsheets", req.nextUrl.origin).toString();
  const oauth2Client = getOAuthClient(googleRedirectUri);

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/spreadsheets"],
    state: googleState,
  });

  return NextResponse.redirect(authUrl);
}
