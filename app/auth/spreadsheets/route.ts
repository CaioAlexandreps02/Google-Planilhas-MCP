import { NextRequest, NextResponse } from "next/server";
import { getOAuthClient } from "@/lib/google-oauth";
import { saveGoogleRefreshToken } from "@/lib/kv";
import { decodeSignedPayload, encodeSignedPayload } from "@/lib/oauth-tokens";

type OriginalRequest = {
  redirectUri: string;
  state: string;
  codeChallenge: string;
  codeChallengeMethod: string;
};

// Essa é a única URI de redirecionamento cadastrada no Google Cloud, então
// ela atende dois fluxos: o manual antigo (visita direta, sem "state" nosso)
// e o automático novo (vindo do /authorize, com um "state" assinado por nós).
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const stateParam = req.nextUrl.searchParams.get("state");
  const error = req.nextUrl.searchParams.get("error");

  if (error) {
    return new NextResponse(`Autorização negada ou cancelada: ${error}`, { status: 400 });
  }
  if (!code) {
    return new NextResponse("Código de autorização não encontrado na URL.", { status: 400 });
  }

  const redirectUri = new URL("/auth/spreadsheets", req.nextUrl.origin).toString();
  const oauth2Client = getOAuthClient(redirectUri);

  let original: OriginalRequest | null = null;
  if (stateParam) {
    try {
      original = decodeSignedPayload<OriginalRequest>(stateParam);
    } catch {
      // state não é nosso (ou expirou) — trata como fluxo manual mesmo.
      original = null;
    }
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      return new NextResponse(
        "O Google não retornou um refresh_token (provavelmente você já autorizou esse app antes). " +
          "Remova o acesso em https://myaccount.google.com/permissions e tente de novo.",
        { status: 400 }
      );
    }

    await saveGoogleRefreshToken(tokens.refresh_token);

    if (original) {
      const ourCode = encodeSignedPayload({
        codeChallenge: original.codeChallenge,
        codeChallengeMethod: original.codeChallengeMethod,
        exp: Date.now() + 5 * 60 * 1000,
      });

      const redirectBack = new URL(original.redirectUri);
      redirectBack.searchParams.set("code", ourCode);
      if (original.state) redirectBack.searchParams.set("state", original.state);

      return NextResponse.redirect(redirectBack.toString());
    }

    const html = `
      <html>
        <body style="font-family: sans-serif; padding: 40px; max-width: 700px;">
          <h2>Autorizado com sucesso ✅</h2>
          <p>A conta foi conectada e já está pronta pra uso — não precisa fazer mais nada.</p>
          <p style="color: #666; font-size: 14px;">Pode fechar esta página.</p>
        </body>
      </html>
    `;
    return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  } catch (err) {
    return new NextResponse(`Erro ao trocar o código por tokens: ${(err as Error).message}`, { status: 500 });
  }
}
