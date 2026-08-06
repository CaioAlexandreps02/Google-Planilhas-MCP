import { NextRequest, NextResponse } from "next/server";
import { getOAuthClient } from "@/lib/google-oauth";
import { decodeSignedPayload, encodeSignedPayload } from "@/lib/oauth-tokens";
import { saveGoogleRefreshToken } from "@/lib/kv";

type OriginalRequest = {
  redirectUri: string;
  state: string;
  codeChallenge: string;
  codeChallengeMethod: string;
};

// O Google volta pra cá depois que você autoriza. A gente troca o
// código do Google por um refresh_token, guarda no KV, e manda o
// usuário de volta pro cliente MCP original com o NOSSO código.
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const stateParam = req.nextUrl.searchParams.get("state");
  const error = req.nextUrl.searchParams.get("error");

  if (error) return new NextResponse(`Autorização negada: ${error}`, { status: 400 });
  if (!code || !stateParam) return new NextResponse("Parâmetros ausentes na volta do Google.", { status: 400 });

  let original: OriginalRequest;
  try {
    original = decodeSignedPayload<OriginalRequest>(stateParam);
  } catch {
    return new NextResponse("Sessão de autorização inválida ou expirada. Tente conectar de novo.", { status: 400 });
  }

  const googleRedirectUri = new URL("/oauth/google/callback", req.nextUrl.origin).toString();
  const oauth2Client = getOAuthClient(googleRedirectUri);

  try {
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      return new NextResponse(
        "O Google não retornou um refresh_token (provavelmente você já autorizou esse app antes). " +
          "Remova o acesso em https://myaccount.google.com/permissions e tente conectar de novo.",
        { status: 400 }
      );
    }

    await saveGoogleRefreshToken(tokens.refresh_token);

    const ourCode = encodeSignedPayload({
      redirectUri: original.redirectUri,
      codeChallenge: original.codeChallenge,
      codeChallengeMethod: original.codeChallengeMethod,
      exp: Date.now() + 5 * 60 * 1000,
    });

    const redirectBack = new URL(original.redirectUri);
    redirectBack.searchParams.set("code", ourCode);
    if (original.state) redirectBack.searchParams.set("state", original.state);

    return NextResponse.redirect(redirectBack.toString());
  } catch (err) {
    return new NextResponse(`Erro ao trocar o código com o Google: ${(err as Error).message}`, { status: 500 });
  }
}
