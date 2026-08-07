import { NextRequest, NextResponse } from "next/server";
import { getOAuthClient, OAUTH_SCOPES } from "@/lib/google-oauth";
import { encodeSignedPayload } from "@/lib/oauth-tokens";

// Ponto de entrada do fluxo: o cliente MCP (Claude, ChatGPT, etc.) manda o
// usuário pra cá. A gente "embrulha" o pedido dele num state assinado
// e manda o usuário pra tela de verdade do Google.
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const redirectUri = sp.get("redirect_uri");
  const state = sp.get("state") ?? "";
  const codeChallenge = sp.get("code_challenge") ?? "";
  const codeChallengeMethod = sp.get("code_challenge_method") ?? "plain";

  // Se o cliente não mandou redirect_uri, usa o nosso callback padrão.
  // Isso resolve o caso do ChatGPT que pode não enviar o parâmetro.
  const finalRedirectUri = redirectUri
    ?? new URL("/auth/spreadsheets", req.nextUrl.origin).toString();

  const googleState = encodeSignedPayload({
    redirectUri: finalRedirectUri,
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
    scope: OAUTH_SCOPES,
    state: googleState,
  });

  return NextResponse.redirect(authUrl);
}
