export const maxDuration = 300;

import { createMcpHandler } from "@vercel/mcp-adapter";
import { z } from "zod";
import { getSheetsClient } from "@/lib/google";
import { getScriptClient } from "@/lib/google-script";

// Wrapper seguro: qualquer tool que lançar exceção retorna
// um texto de erro amigável em vez de crashar a conexão MCP.
function safe<P>(fn: (p: P) => Promise<{ content: { type: "text"; text: string }[] }>) {
  return async (p: P) => {
    try {
      return await fn(p);
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      console.error("[MCP_TOOL_ERROR]", msg);
      return {
        content: [{ type: "text" as const, text: `Erro: ${msg}` }],
      };
    }
  };
}

// Corta a espera antes da Vercel matar a função sem avisar (o que derruba
// a conexão MCP inteira). Assim, se demorar demais, vira um erro normal.
// Importante: isso só desiste de ESPERAR a resposta - não cancela a operação
// do lado do Google, que pode continuar rodando e terminar depois mesmo assim.
function comTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} demorou mais de ${ms / 1000}s e foi cancelado.`)), ms)
    ),
  ]);
}

const TIMEOUT_SHEETS_MS = 25000;
const TIMEOUT_SCRIPT_META_MS = 45000;
const TIMEOUT_SCRIPT_RUN_MS = 50000;

const baseHandler = createMcpHandler((server) => {
  server.tool(
    "sheets_get_range",
    "Lê os valores de um intervalo de células de uma planilha do Google Sheets",
    {
      spreadsheetId: z.string().describe("ID da planilha (parte da URL entre /d/ e /edit)"),
      range: z.string().describe("Intervalo no formato A1, ex: 'Agosto!A1:F30'"),
    },
    safe(async ({ spreadsheetId, range }) => {
      const sheets = await getSheetsClient();
      const res = await comTimeout(
        sheets.spreadsheets.values.get({ spreadsheetId, range }),
        TIMEOUT_SHEETS_MS,
        "A leitura do intervalo"
      );
      return {
        content: [{ type: "text", text: JSON.stringify(res.data.values ?? []) }],
      };
    })
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
    safe(async ({ spreadsheetId, range, values }) => {
      const sheets = await getSheetsClient();
      await comTimeout(
        sheets.spreadsheets.values.update({
          spreadsheetId,
          range,
          valueInputOption: "USER_ENTERED",
          requestBody: { values },
        }),
        TIMEOUT_SHEETS_MS,
        "A escrita no intervalo"
      );
      return { content: [{ type: "text", text: `Intervalo ${range} atualizado.` }] };
    })
  );

  server.tool(
    "sheets_batch_update",
    "Executa operações avançadas (formatação, bordas, validação de dados, formatação condicional) via batchUpdate da Sheets API.",
    {
      spreadsheetId: z.string(),
      requests: z.array(z.any()).describe("Array de objetos 'request' no formato da Sheets API batchUpdate"),
    },
    safe(async ({ spreadsheetId, requests }) => {
      const sheets = await getSheetsClient();
      await comTimeout(
        sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: { requests },
        }),
        TIMEOUT_SHEETS_MS,
        "O batchUpdate"
      );
      return { content: [{ type: "text", text: `${requests.length} operação(ões) aplicada(s).` }] };
    })
  );

  server.tool(
    "sheets_get_metadata",
    "Lista as abas de uma planilha com nome, sheetId (gid) e dimensões.",
    { spreadsheetId: z.string() },
    safe(async ({ spreadsheetId }) => {
      const sheets = await getSheetsClient();
      const res = await comTimeout(
        sheets.spreadsheets.get({
          spreadsheetId,
          fields: "sheets.properties",
        }),
        TIMEOUT_SHEETS_MS,
        "A leitura dos metadados"
      );
      return { content: [{ type: "text", text: JSON.stringify(res.data.sheets ?? []) }] };
    })
  );

  server.tool(
    "apps_script_get_content",
    "Lê o código-fonte atual de um projeto do Google Apps Script.",
    {
      scriptId: z.string().describe("ID do script (Configurações do projeto no editor do Apps Script)"),
    },
    safe(async ({ scriptId }) => {
      const script = await getScriptClient();
      const res = await comTimeout(script.projects.getContent({ scriptId }), TIMEOUT_SCRIPT_META_MS, "A leitura do script");
      return {
        content: [{ type: "text", text: JSON.stringify(res.data.files ?? []) }],
      };
    })
  );

  server.tool(
    "apps_script_update_content",
    "Substitui o código-fonte completo de um projeto do Google Apps Script.",
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
    safe(async ({ scriptId, files }) => {
      const script = await getScriptClient();
      await comTimeout(
        script.projects.updateContent({
          scriptId,
          requestBody: { files },
        }),
        TIMEOUT_SCRIPT_META_MS,
        "A atualização do script"
      );
      return { content: [{ type: "text", text: `Projeto ${scriptId} atualizado com ${files.length} arquivo(s).` }] };
    })
  );

  server.tool(
    "apps_script_run",
    "Executa uma função remotamente num projeto do Google Apps Script.",
    {
      scriptId: z.string(),
      functionName: z.string().describe("Nome da função a executar, ex: 'configurarListasSuspensas'"),
      parameters: z.array(z.any()).optional().describe("Parâmetros posicionais da função, se ela exigir"),
    },
    safe(async ({ scriptId, functionName, parameters }) => {
      const script = await getScriptClient();
      const res = await comTimeout(
        script.scripts.run({
          scriptId,
          requestBody: {
            function: functionName,
            parameters: parameters ?? [],
            devMode: true,
          },
        }),
        TIMEOUT_SCRIPT_RUN_MS,
        `A função "${functionName}"`
      );
      if (res.data.error) {
        return { content: [{ type: "text", text: `Erro na execução: ${JSON.stringify(res.data.error)}` }] };
      }
      return { content: [{ type: "text", text: JSON.stringify(res.data.response ?? { ok: true }) }] };
    })
  );

  server.tool(
    "apps_script_ensure_api_executable",
    "Cria uma versão + implantação do tipo 'Executável de API' pro projeto.",
    { scriptId: z.string() },
    safe(async ({ scriptId }) => {
      const script = await getScriptClient();
      const version = await comTimeout(
        script.projects.versions.create({
          scriptId,
          requestBody: { description: "Deploy automático via MCP" },
        }),
        TIMEOUT_SCRIPT_META_MS,
        "A criação da versão"
      );
      const versionNumber = version.data.versionNumber;
      const deployment = await comTimeout(
        script.projects.deployments.create({
          scriptId,
          requestBody: {
            versionNumber,
            manifestFileName: "appsscript",
            description: "API Executable via MCP",
          },
        }),
        TIMEOUT_SCRIPT_META_MS,
        "A criação do deployment"
      );
      return {
        content: [
          {
            type: "text",
            text: `Versão ${versionNumber} criada e implantada. deploymentId: ${deployment.data.deploymentId}`,
          },
        ],
      };
    })
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
