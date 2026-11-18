export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const { initScheduler } = await import('./lib/scheduler');
      initScheduler().catch((err) => {
        console.warn('Initial scheduler bootstrap warning:', err?.message);
      });
    } catch (e: any) {
      console.warn('Could not register scheduler on boot:', e?.message);
    }
  }
}
