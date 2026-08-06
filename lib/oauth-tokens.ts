import crypto from "node:crypto";

function getSigningSecret(): string {
  const secret = process.env.MCP_SHARED_SECRET;
  if (!secret) throw new Error("MCP_SHARED_SECRET não configurado.");
  return secret;
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", getSigningSecret()).update(payload).digest("base64url");
}

export function encodeSignedPayload(data: object): string {
  const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function decodeSignedPayload<T = unknown>(token: string): T {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) throw new Error("Formato inválido.");

  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new Error("Assinatura inválida.");
  }

  const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf-8"));
  if (typeof data.exp === "number" && Date.now() > data.exp) {
    throw new Error("Expirado.");
  }
  return data as T;
}

export function verifyPkce(challenge: string, method: string | undefined, verifier: string | undefined): boolean {
  if (!challenge) return true;
  if (!verifier) return false;
  if (method === "S256") {
    const hash = crypto.createHash("sha256").update(verifier).digest("base64url");
    return hash === challenge;
  }
  return verifier === challenge;
}
