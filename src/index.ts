import { connectToWhatsApp } from './whatsapp.js';

async function main() {
    connectToWhatsApp();
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
