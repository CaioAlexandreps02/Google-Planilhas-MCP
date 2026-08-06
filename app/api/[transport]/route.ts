import { createMcpHandler } from "@vercel/mcp-adapter";
import { z } from "zod";
import { getSheetsClient } from "@/lib/google";

const handler = createMcpHandler((server) => {
  server.tool(
    "sheets_get_range",
    "Lê os valores de um intervalo de células de uma planilha do Google Sheets",
    {
      spreadsheetId: z.string().describe("ID da planilha (parte da URL entre /d/ e /edit)"),
      range: z.string().describe("Intervalo no formato A1, ex: 'Agosto!A1:F30'"),
    },
    async ({ spreadsheetId, range }) => {
      const sheets = getSheetsClient();
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
      const sheets = getSheetsClient();
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
      const sheets = getSheetsClient();
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests },
      });
      return { content: [{ type: "text", text: `${requests.length} operação(ões) aplicada(s).` }] };
    }
  );
}, {}, { basePath: "/api" });

export { handler as GET, handler as POST, handler as DELETE };
