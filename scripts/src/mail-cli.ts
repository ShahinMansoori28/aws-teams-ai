import { assertFlociUp } from "./env.js";
import { codeIn, listMail } from "./mail.js";

/** npm run mail [email]: the last 10 emails in Floci's inbox, newest first, with the code pulled out. */
async function main() {
  await assertFlociUp();
  const filter = process.argv[2]?.toLowerCase();
  const mail = (await listMail())
    .filter((m) => !filter || m.to.some((t) => t.toLowerCase() === filter))
    .sort((a, b) => b.time.localeCompare(a.time))
    .slice(0, 10);
  if (!mail.length) return console.log(filter ? `No emails to ${filter}.` : "Inbox is empty.");
  for (const m of mail) {
    const code = codeIn(m.text);
    console.log(`${m.time.slice(0, 19).replace("T", " ")}  ${m.to.join(", ")}  ${m.subject}${code ? `  →  code ${code}` : ""}`);
  }
}

main().catch((e) => { console.error(String(e.message ?? e)); process.exit(1); });
