import { PrismaClient } from '@prisma/client';

const supabaseDb = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://postgres.newnnkailneojgyqtpxl:47695903Kk!@aws-0-eu-west-1.pooler.supabase.com:5432/postgres"
    }
  }
});

const vercelDb = new PrismaClient({
  datasources: {
    db: {
      url: "postgres://dd26cacd1f1d1e4c4f5f3293547808f26d0d8455d82e1f379039a5aedfdf7e17:sk_L92c_OjN_n9ZGuqjbZ63L@db.prisma.io:5432/postgres?sslmode=require"
    }
  }
});

async function main() {
  const bcConfig = await supabaseDb.businessCentralConfig.findFirst();
  if (bcConfig) {
    await vercelDb.businessCentralConfig.upsert({
      where: { id: bcConfig.id },
      update: bcConfig,
      create: bcConfig,
    });
    console.log("BC Config copied.");
  }
  
  const emailConfig = await supabaseDb.emailConfig.findFirst();
  if (emailConfig) {
    await vercelDb.emailConfig.upsert({
      where: { id: emailConfig.id },
      update: emailConfig,
      create: emailConfig,
    });
    console.log("Email Config copied.");
  }
  
  const cashflowConfig = await supabaseDb.cashflowConfig.findFirst();
  if (cashflowConfig) {
    await vercelDb.cashflowConfig.upsert({
      where: { companyId: cashflowConfig.companyId },
      update: cashflowConfig,
      create: cashflowConfig,
    });
    console.log("Cashflow Config copied.");
  }
}

main().catch(console.error).finally(() => {
  supabaseDb.$disconnect();
  vercelDb.$disconnect();
});
