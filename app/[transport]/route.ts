import { createMcpHandler } from "@vercel/mcp-adapter";
import { z } from "zod";
import { getSheetsClient } from "@/lib/google";

const baseHandler = createMcpHandler((server) => {
  server.tool(
    "sheets_get_range",
    "Lê os valores de um intervalo de células de uma planilha do Google Sheets",
    {
      spreadsheetId: z.string().describe("ID da planilha (parte da URL entre /d/ e /edit)"),
      range: z.string().describe("Intervalo no formato A1, ex: 'Agosto!A1:F30'"),
    },
    async ({ spreadsheetId, range }) => {
      const sheets = await getSheetsClient();
      const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
      return {
        content: [{ type: "text", text: JSON.stringify(res.data.values ?? []) }],
      };
    }
  );

  server.tool(
    "sheets_update_range",
    "Escreve valores em um intervalo de células de uma planilha do Google Sheets",
    {
      spreadsheetId: z.string(),
      range: z.string(),
      values: z
        .array(z.array(z.union([z.string(), z.number()])))
        .describe("Matriz de linhas x colunas com os valores a escrever"),
    },
    async ({ spreadsheetId, range, values }) => {
      const sheets = await getSheetsClient();
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: "USER_ENTERED",
        requestBody: { values },
      });
      return { content: [{ type: "text", text: `Intervalo ${range} atualizado.` }] };
    }
  );

  server.tool(
    "sheets_batch_update",
    "Executa operações avançadas (formatação, bordas, validação de dados, formatação condicional) via batchUpdate da Sheets API. Aceita o array 'requests' bruto no formato da API oficial do Google.",
    {
      spreadsheetId: z.string(),
      requests: z.array(z.any()).describe("Array de objetos 'request' no formato da Sheets API batchUpdate"),
    },
    async ({ spreadsheetId, requests }) => {
      const sheets = await getSheetsClient();
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests },
      });
      return { content: [{ type: "text", text: `${requests.length} operação(ões) aplicada(s).` }] };
    }
  );
});

function checkToken(req: Request): boolean {
  const expected = process.env.MCP_SHARED_SECRET;
  if (!expected) return false;

  const url = new URL(req.url);
  const authHeader = req.headers.get("authorization");
  const bearerToken = authHeader?.replace(/^Bearer\s+/i, "").trim();
  const tokenFromQuery = url.searchParams.get("token") ?? undefined;
  const token = bearerToken || tokenFromQuery;

  return token === expected;
}

async function handler(req: Request) {
  if (!checkToken(req)) {
    const origin = new URL(req.url).origin;
    return new Response(JSON.stringify({ error: "invalid_token" }), {
      status: 401,
      headers: {
        "Content-Type": "application/json",
        "WWW-Authenticate": `Bearer error="invalid_token", resource_metadata="${origin}/.well-known/oauth-protected-resource"`,
      },
    });
  }
  return baseHandler(req);
}

export { handler as GET, handler as POST, handler as DELETE };
