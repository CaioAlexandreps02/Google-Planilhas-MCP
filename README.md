# sheets-mcp

Servidor MCP pessoal para o Google Sheets. Expõe 3 ferramentas que o Claude pode chamar
diretamente por HTTP, sem precisar de navegador:

- `sheets_get_range` — lê um intervalo de células.
- `sheets_update_range` — escreve valores em um intervalo.
- `sheets_batch_update` — aplica operações avançadas (bordas, cores, validação de dados,
  formatação condicional) usando o formato bruto do `batchUpdate` da API do Google.

## Como funciona

1. As credenciais (Client ID/Secret + refresh token de uma conta Google com acesso à
   planilha) ficam em variáveis de ambiente — nada fica no código.
2. `lib/google.ts` monta um cliente autenticado da Sheets API v4 usando essas variáveis.
3. `app/api/mcp/route.ts` expõe esse cliente como ferramentas MCP via `@vercel/mcp-adapter`.
4. Uma vez publicado na Vercel, o endpoint fica em `https://<seu-projeto>.vercel.app/api/mcp`
   — essa URL é o que se registra como um "remote MCP server" no Claude.

## Passo a passo para deixar funcionando de verdade

### 1. Criar credenciais OAuth no Google Cloud

1. Acesse https://console.cloud.google.com/, crie (ou reaproveite) um projeto.
2. Ative a **Google Sheets API**.
3. Em "Credenciais" → "Criar credenciais" → "ID do cliente OAuth" → tipo **Aplicativo para computador**.
4. Copie o **Client ID** e o **Client Secret**.

### 2. Gerar o refresh token (uma vez só, localmente)

```bash
GOOGLE_CLIENT_ID=xxx GOOGLE_CLIENT_SECRET=yyy npm run get-refresh-token
```

Isso abre um link — logue com a conta Google que tem acesso à planilha "Promoção", autorize,
cole o código que o Google mostrar, e o script imprime o `refresh_token`.

### 3. Configurar variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha os três valores (para rodar localmente),
e depois configure as mesmas três variáveis nas "Environment Variables" do projeto na Vercel
(para produção): `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`.

### 4. Rodar localmente

```bash
npm run dev
```

O endpoint MCP fica em `http://localhost:3000/api/mcp`.

### 5. Publicar na Vercel

Conectar este projeto a um repositório no GitHub e importar na Vercel (ou `vercel deploy`
direto pela CLI). Depois de publicado, a URL `https://<projeto>.vercel.app/api/mcp` é o
endereço que se adiciona como conector MCP remoto no Claude.

## Limitações desta versão (MVP pessoal)

- Não cobre Apps Script (scripts `onEdit`, sidebars) — só edita células/formatação via
  Sheets API. Continuaria precisando do navegador para essa parte.
- Sem multiusuário: um único refresh token, de uma única conta Google, fixo nas env vars.
  Se quiser abrir para outras pessoas usarem depois, aí entra banco de dados (ex: Supabase)
  para guardar um refresh token por pessoa, e um fluxo OAuth próprio no MCP.
