import { syncBusinessCentral } from '../lib/bcSync';

process.env.DATABASE_URL = "postgres://dd26cacd1f1d1e4c4f5f3293547808f26d0d8455d82e1f379039a5aedfdf7e17:sk_L92c_OjN_n9ZGuqjbZ63L@db.prisma.io:5432/postgres?sslmode=require";

async function main() {
  console.log("Starting sync...");
  await syncBusinessCentral();
  console.log("Sync finished!");
}

main().catch(console.error);
