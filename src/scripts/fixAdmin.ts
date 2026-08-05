import { PrismaClient } from '@prisma/client';

const vercelDb = new PrismaClient({
  datasources: {
    db: {
      url: "postgres://dd26cacd1f1d1e4c4f5f3293547808f26d0d8455d82e1f379039a5aedfdf7e17:sk_L92c_OjN_n9ZGuqjbZ63L@db.prisma.io:5432/postgres?sslmode=require"
    }
  }
});

async function main() {
  await vercelDb.user.update({
    where: { username: 'admin' },
    data: {
      permissions: JSON.stringify(['dashboard', 'riesgos', 'recobros', 'movimientos_abiertos', 'pagos_proveedor', 'cashflow', 'configuracion'])
    }
  });
  console.log("Admin permissions updated.");
}

main().catch(console.error).finally(() => vercelDb.$disconnect());
