import { PrismaClient } from '@prisma/client';

const vercelDb = new PrismaClient({
  datasources: {
    db: {
      url: "postgres://dd26cacd1f1d1e4c4f5f3293547808f26d0d8455d82e1f379039a5aedfdf7e17:sk_L92c_OjN_n9ZGuqjbZ63L@db.prisma.io:5432/postgres?sslmode=require"
    }
  }
});

async function main() {
  const invs = await vercelDb.invoice.count();
  const pinvs = await vercelDb.purchaseInvoice.count();
  const custs = await vercelDb.customer.count();
  const vends = await vercelDb.vendor.count();
  console.log({ invoices: invs, purchaseInvoices: pinvs, customers: custs, vendors: vends });
}

main().catch(console.error).finally(() => vercelDb.$disconnect());
