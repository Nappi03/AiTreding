import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { initScheduler } from '@/lib/scheduler';

export async function GET() {
  try {
    let settings = await prisma.accountSettings.findUnique({
      where: { id: 'default' },
    });

    if (!settings) {
      settings = await prisma.accountSettings.create({
        data: {
          id: 'default',
          availableLiquidityEur: 10000,
          riskPercentage: 1.5,
          revolutPlan: 'Premium',
          freeTradesRemaining: 5,
        },
      });
    }

    return NextResponse.json({
      ...settings,
      hasGeminiApiKey: Boolean(settings.geminiApiKey || process.env.GEMINI_API_KEY),
      hasTelegramBotToken: Boolean(settings.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN),
      hasTelegramChatId: Boolean(settings.telegramChatId || process.env.TELEGRAM_CHAT_ID),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();

    const updated = await prisma.accountSettings.upsert({
      where: { id: 'default' },
      update: {
        availableLiquidityEur: body.availableLiquidityEur !== undefined ? parseFloat(body.availableLiquidityEur) : undefined,
        riskPercentage: body.riskPercentage !== undefined ? parseFloat(body.riskPercentage) : undefined,
        revolutPlan: body.revolutPlan || undefined,
        freeTradesRemaining: body.freeTradesRemaining !== undefined ? parseInt(body.freeTradesRemaining, 10) : undefined,
        telegramBotToken: body.telegramBotToken !== undefined ? body.telegramBotToken : undefined,
        telegramChatId: body.telegramChatId !== undefined ? body.telegramChatId : undefined,
        geminiApiKey: body.geminiApiKey !== undefined ? body.geminiApiKey : undefined,
        morningScanTime: body.morningScanTime || undefined,
        afternoonScanTime: body.afternoonScanTime || undefined,
        autoScanEnabled: body.autoScanEnabled !== undefined ? Boolean(body.autoScanEnabled) : undefined,
      },
      create: {
        id: 'default',
        availableLiquidityEur: parseFloat(body.availableLiquidityEur || '10000'),
        riskPercentage: parseFloat(body.riskPercentage || '1.5'),
        revolutPlan: body.revolutPlan || 'Premium',
        freeTradesRemaining: parseInt(body.freeTradesRemaining || '5', 10),
        telegramBotToken: body.telegramBotToken || '',
        telegramChatId: body.telegramChatId || '',
        geminiApiKey: body.geminiApiKey || '',
        morningScanTime: body.morningScanTime || '08:30',
        afternoonScanTime: body.afternoonScanTime || '15:00',
        autoScanEnabled: body.autoScanEnabled !== undefined ? Boolean(body.autoScanEnabled) : true,
      },
    });

    // Re-initialize cron jobs with new schedules
    initScheduler().catch((e) => console.warn('Scheduler re-init failed:', e));

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
