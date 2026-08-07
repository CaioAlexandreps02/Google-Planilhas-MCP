import { createMcpHandler } from "@vercel/mcp-adapter";
import { z } from "zod";
import { getSheetsClient } from "@/lib/google";
import { getScriptClient } from "@/lib/google-script";

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

  server.tool(
    "sheets_get_metadata",
    "Lista as abas de uma planilha com nome, sheetId (gid) e dimensões — útil pra montar requests de batch_update que exigem sheetId numérico.",
    { spreadsheetId: z.string() },
    async ({ spreadsheetId }) => {
      const sheets = await getSheetsClient();
      const res = await sheets.spreadsheets.get({
        spreadsheetId,
        fields: "sheets.properties",
      });
      return { content: [{ type: "text", text: JSON.stringify(res.data.sheets ?? []) }] };
    }
  );

  server.tool(
    "apps_script_get_content",
    "Lê o código-fonte atual de um projeto do Google Apps Script (todos os arquivos .gs/.html).",
    {
      scriptId: z.string().describe("ID do script (Configurações do projeto no editor do Apps Script)"),
    },
    async ({ scriptId }) => {
      const script = await getScriptClient();
      const res = await script.projects.getContent({ scriptId });
      return {
        content: [{ type: "text", text: JSON.stringify(res.data.files ?? []) }],
      };
    }
  );

  server.tool(
    "apps_script_update_content",
    "Substitui o código-fonte completo de um projeto do Google Apps Script. Precisa mandar TODOS os arquivos do projeto (não só o que mudou), no formato [{name, type, source}].",
    {
      scriptId: z.string(),
      files: z
        .array(
          z.object({
            name: z.string().describe("Nome do arquivo, sem extensão (ex: 'Código' ou 'Sidebar')"),
            type: z.enum(["SERVER_JS", "HTML", "JSON"]).describe("SERVER_JS para .gs, HTML para .html, JSON para o appsscript.json"),
            source: z.string().describe("Conteúdo completo do arquivo"),
          })
        )
        .describe("Lista de todos os arquivos do projeto"),
    },
    async ({ scriptId, files }) => {
      const script = await getScriptClient();
      await script.projects.updateContent({
        scriptId,
        requestBody: { files },
      });
      return { content: [{ type: "text", text: `Projeto ${scriptId} atualizado com ${files.length} arquivo(s).` }] };
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
