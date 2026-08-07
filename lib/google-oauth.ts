import { google } from "googleapis";

export const OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/script.projects",
];

export function getOAuthClient(redirectUri: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Faltam GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET nas variáveis de ambiente.");
  }
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}
