import { google } from "googleapis";
import { getGoogleRefreshToken } from "./kv";

export async function getScriptClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Faltam variáveis de ambiente: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET");
  }

  const refreshToken = (await getGoogleRefreshToken()) ?? process.env.GOOGLE_REFRESH_TOKEN;
  if (!refreshToken) {
    throw new Error("Nenhuma conta Google autorizada ainda. Conecte pelo fluxo OAuth do conector.");
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  return google.script({ version: "v1", auth: oauth2Client });
}
