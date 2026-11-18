const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding initial AiTrading database...');

  // Default Account Settings
  await prisma.accountSettings.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      availableLiquidityEur: 10000.0,
      riskPercentage: 1.5,
      revolutPlan: 'Premium',
      freeTradesRemaining: 5,
      freeTradesResetDay: 1,
      morningScanTime: '08:30',
      afternoonScanTime: '15:00',
      autoScanEnabled: true,
      telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
      telegramChatId: process.env.TELEGRAM_CHAT_ID || '',
      geminiApiKey: process.env.GEMINI_API_KEY || '',
    },
  });

  // Default Curated Watchlist (Top traded tech & macro stocks available on Revolut)
  const defaultWatchlist = [
    { ticker: 'NVDA', name: 'NVIDIA Corporation', sector: 'Semiconductors' },
    { ticker: 'AAPL', name: 'Apple Inc.', sector: 'Consumer Electronics' },
    { ticker: 'MSFT', name: 'Microsoft Corporation', sector: 'Software & Cloud' },
    { ticker: 'TSLA', name: 'Tesla, Inc.', sector: 'EV & Clean Energy' },
    { ticker: 'AMZN', name: 'Amazon.com, Inc.', sector: 'E-Commerce & Cloud' },
    { ticker: 'META', name: 'Meta Platforms, Inc.', sector: 'Social Media & AI' },
    { ticker: 'GOOGL', name: 'Alphabet Inc.', sector: 'Search & Cloud' },
    { ticker: 'AMD', name: 'Advanced Micro Devices', sector: 'Semiconductors' },
    { ticker: 'PLTR', name: 'Palantir Technologies', sector: 'AI & Defense Software' },
    { ticker: 'ASML', name: 'ASML Holding N.V.', sector: 'Semiconductor Equipment' },
  ];

  for (const item of defaultWatchlist) {
    await prisma.watchlist.upsert({
      where: { ticker: item.ticker },
      update: {},
      create: item,
    });
  }

  // Sample Portfolio Position
  const existingPositions = await prisma.portfolioPosition.count();
  if (existingPositions === 0) {
    await prisma.portfolioPosition.create({
      data: {
        ticker: 'NVDA',
        name: 'NVIDIA Corporation',
        sharesOwned: 12.5,
        averageCostUSD: 118.40,
        stopLossPriceUSD: 110.00,
        takeProfitPriceUSD: 155.00,
        notes: 'Posizione aperta per ciclo AI Blackwell',
      },
    });
  }

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
