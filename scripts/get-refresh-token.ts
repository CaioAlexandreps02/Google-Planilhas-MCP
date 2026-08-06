import { google } from "googleapis";
import readline from "node:readline";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = "urn:ietf:wg:oauth:2.0:oob";

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("Defina GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET antes de rodar (ex: no .env.local e usando `dotenv -e .env.local -- npm run get-refresh-token`).");
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: "offline",
  prompt: "consent",
  scope: ["https://www.googleapis.com/auth/spreadsheets"],
});

console.log("\n1) Abra esta URL no navegador e faça login com a conta que tem acesso à planilha:\n");
console.log(authUrl);
console.log("\n2) Autorize o app. O Google vai mostrar um código na tela.");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question("\n3) Cole o código aqui e aperte Enter: ", async (code) => {
  const { tokens } = await oauth2Client.getToken(code.trim());
  console.log("\nSeu refresh_token (guarde com segurança, é ele que dá acesso à conta):\n");
  console.log(tokens.refresh_token);
  console.log("\nColoque esse valor na variável de ambiente GOOGLE_REFRESH_TOKEN.");
  rl.close();
});
