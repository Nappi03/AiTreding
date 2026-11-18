import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendRevolutActionCardTelegram } from '@/lib/telegram-service';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    let analysis = body.analysis;

    if (!analysis && body.analysisId) {
      const record = await prisma.aiAnalysis.findUnique({
        where: { id: body.analysisId },
      });
      if (record) {
        analysis = {
          ticker: record.ticker,
          verdict: record.verdict,
          convictionScore: record.convictionScore,
          thesisSummary: record.thesisSummary,
          revolutExecutionPlan: JSON.parse(record.revolutExecutionPlan),
        };
      }
    }

    if (!analysis) {
      return NextResponse.json({ error: 'Dati analisi mancanti' }, { status: 400 });
    }

    const result = await sendRevolutActionCardTelegram(analysis);

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
