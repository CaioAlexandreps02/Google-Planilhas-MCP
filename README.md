# sheets-mcp

Servidor MCP pessoal para Google Sheets + Apps Script. Publicado na Vercel, conecta em
qualquer cliente MCP (Claude, ChatGPT, etc.) via OAuth de verdade — a pessoa clica
"conectar", vai pra tela do Google, autoriza, e volta já funcionando.

**URL do conector:** `https://google-planilhas-mcp.vercel.app/mcp`

## Ferramentas disponíveis

| Ferramenta | O que faz |
|---|---|
| `sheets_get_range` | Lê um intervalo de células (`Aba!A1:F30`) |
| `sheets_update_range` | Escreve valores num intervalo |
| `sheets_batch_update` | Formatação avançada (bordas, cores, validação de dados) via `batchUpdate` bruto da API |
| `apps_script_get_content` | Lê o código-fonte de um projeto de Apps Script |
| `apps_script_update_content` | Substitui o código-fonte completo de um projeto (manda TODOS os arquivos, não só o alterado) |

## ⚠️ Sobre o Apps Script: não tem como descobrir o ID sozinho

As ferramentas `apps_script_*` pedem um `scriptId`. **Não existe forma automática de
descobrir esse ID a partir do ID da planilha.** Já tentamos (via Drive API, listando
"filhos" do arquivo da planilha) e não funciona — scripts vinculados (container-bound)
não aparecem nessa relação de parentesco pela API do Drive, mesmo com o escopo certo.

**Isso significa que, sempre que alguém (ou a IA de alguém) for mexer num Apps Script
vinculado a uma planilha pela primeira vez, precisa pegar o ID manualmente:**

1. Abrir a planilha no Google Sheets.
2. Menu **Extensões → Apps Script**.
3. Ícone de engrenagem ⚙️ (**Configurações do projeto**).
4. Copiar o **"ID do script"**.

Depois de pegar o ID uma vez, **guarde-o** (na conversa, num arquivo local, onde fizer
sentido) — ele não muda, então só precisa fazer isso uma vez por projeto de script.

### Scripts já conhecidos

| Planilha | Spreadsheet ID | Script vinculado | Script ID |
|---|---|---|---|
| Promoção (Kits Embrepoli) | `1lple9VAYyoo4qUou0iZxrA-tHfWqKKCuuDgZLqOmUHo` | Auto-preenchimento Kits | `1Bqxp79hvX9jHteNxLynDLJjyOfMtdLqGXLj630DoXAvqbtDOh7bhGdnf` |

Ao conectar um Apps Script novo (de outra planilha), adicione uma linha nessa tabela.

## Como funciona (arquitetura)

- **Autenticação do conector:** servidor OAuth 2.1 próprio (`/authorize`, `/token`,
  `/register`, `/.well-known/oauth-authorization-server`), que por baixo dos panos
  redireciona pro login de verdade do Google. Depois que o Google autoriza, a gente
  guarda o `refresh_token` da conta Google no **Vercel KV** e emite um token de acesso
  MCP (que é só o `MCP_SHARED_SECRET`) pro cliente.
- Também dá pra conectar sem OAuth interativo, direto com o token na URL:
  `https://google-planilhas-mcp.vercel.app/mcp?token=SEU_MCP_SHARED_SECRET`
- `lib/google.ts`, `lib/google-script.ts` — montam clientes autenticados (Sheets API v4 e
  Apps Script API v1) usando o refresh token guardado no KV.
- `app/[transport]/route.ts` — expõe tudo isso como ferramentas MCP via `@vercel/mcp-adapter`.

## Variáveis de ambiente (Vercel)

| Variável | De onde vem |
|---|---|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Credenciais OAuth do Google Cloud (tipo "Aplicativo da Web") |
| `MCP_SHARED_SECRET` | Você define (string aleatória longa) — protege o `/mcp` e assina os codes internos do fluxo OAuth |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` (etc.) | Auto-preenchidas ao conectar a integração Vercel KV |

## APIs que precisam estar ativadas no Google Cloud

- Google Sheets API
- Google Apps Script API

## Escopos OAuth necessários (Tela de permissão OAuth)

- `.../auth/spreadsheets`
- `.../auth/script.projects`

## Redirect URI cadastrada nas credenciais OAuth

`https://google-planilhas-mcp.vercel.app/auth/spreadsheets` — usada tanto pelo fluxo
manual antigo (`/api/auth/start`) quanto pelo fluxo OAuth novo (`/authorize`). Se
precisar trocar de domínio, atualize essa URI nas credenciais do Google Cloud também.

## Limitações atuais

- Sem multiusuário: um único refresh token (uma única conta Google) fica guardado no KV.
  Pra abrir pra outras pessoas usarem, cada uma precisaria de um token separado — o
  design atual não separa isso.
- `apps_script_update_content` substitui **todos** os arquivos do projeto de uma vez;
  não dá pra editar um arquivo isolado sem mandar os outros junto.
