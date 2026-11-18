import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getOrGenerateGeopoliticalBrief } from '@/lib/ai-engine';

export async function GET() {
  try {
    const today = new Date().toISOString().split('T')[0];

    let brief = await prisma.geopoliticalBrief.findUnique({
      where: { date: today },
    });

    if (!brief) {
      // Find latest available
      brief = await prisma.geopoliticalBrief.findFirst({
        orderBy: { createdAt: 'desc' },
      });
    }

    if (!brief) {
      return NextResponse.json({
        hasBrief: false,
        message: 'Nessun report geopolitico generato oggi. Clicca su "Genera Report Ora".',
      });
    }

    return NextResponse.json({
      hasBrief: true,
      date: brief.date,
      title: brief.title,
      summary: brief.summary,
      keyRisks: JSON.parse(brief.keyRisks || '[]'),
      marketSentiment: brief.marketSentiment,
      sources: brief.sources ? JSON.parse(brief.sources) : [],
      createdAt: brief.createdAt,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const forceRefresh = Boolean(body.forceRefresh);

    const report = await getOrGenerateGeopoliticalBrief(forceRefresh);
    return NextResponse.json({ success: true, report });
  } catch (error: any) {
    console.error('Error generating geopolitical brief:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
