import { NextRequest, NextResponse } from "next/server";
import { getOAuthClient, OAUTH_SCOPES } from "@/lib/google-oauth";

export async function GET(req: NextRequest) {
  const redirectUri = new URL("/auth/spreadsheets", req.nextUrl.origin).toString();
  const oauth2Client = getOAuthClient(redirectUri);

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: OAUTH_SCOPES,
  });

  return NextResponse.redirect(authUrl);
}
