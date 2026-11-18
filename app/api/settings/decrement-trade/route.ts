import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST() {
  try {
    const settings = await prisma.accountSettings.findUnique({
      where: { id: 'default' },
    });

    if (!settings) {
      return NextResponse.json({ error: 'Impostazioni non trovate' }, { status: 404 });
    }

    const newCount = Math.max(0, settings.freeTradesRemaining - 1);
    const updated = await prisma.accountSettings.update({
      where: { id: 'default' },
      data: { freeTradesRemaining: newCount },
    });

    return NextResponse.json({
      success: true,
      freeTradesRemaining: updated.freeTradesRemaining,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
