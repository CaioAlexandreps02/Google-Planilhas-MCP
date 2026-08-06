import { kv } from "@vercel/kv";

const REFRESH_TOKEN_KEY = "google:refresh_token";

export async function saveGoogleRefreshToken(token: string) {
  await kv.set(REFRESH_TOKEN_KEY, token);
}

export async function getGoogleRefreshToken(): Promise<string | null> {
  return (await kv.get<string>(REFRESH_TOKEN_KEY)) ?? null;
}
