import { NextRequest, NextResponse } from "next/server";
import { getOAuthClient } from "@/lib/google-oauth";
import { saveGoogleRefreshToken } from "@/lib/kv";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");

  if (error) {
    return new NextResponse(`Autorização negada ou cancelada: ${error}`, { status: 400 });
  }
  if (!code) {
    return new NextResponse("Código de autorização não encontrado na URL.", { status: 400 });
  }

  const redirectUri = new URL("/auth/spreadsheets", req.nextUrl.origin).toString();
  const oauth2Client = getOAuthClient(redirectUri);

  try {
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      return new NextResponse(
        "Autorizado, mas o Google não retornou um refresh_token. " +
          "Isso costuma acontecer se você já autorizou esse app antes. " +
          "Vá em https://myaccount.google.com/permissions, remova o acesso do app, e tente de novo.",
        { status: 400 }
      );
    }

    await saveGoogleRefreshToken(tokens.refresh_token);

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
