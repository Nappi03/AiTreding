import Parser from 'rss-parser';

export interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  source: string;
  contentSnippet?: string;
}

const parser = new Parser({
  timeout: 8000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AiTrading-Analyst/1.0',
    Accept: 'application/rss+xml, application/xml, text/xml',
  },
});

export async function fetchCompanyBreakingNews(ticker: string, companyName?: string): Promise<NewsItem[]> {
  const newsItems: NewsItem[] = [];
  const searchQuery = companyName ? `${ticker} OR "${companyName}" stock` : `${ticker} stock`;
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(searchQuery)}+when:3d&hl=en-US&gl=US&ceid=US:en`;

  try {
    const feed = await parser.parseURL(url);
    if (feed.items && feed.items.length > 0) {
      for (const item of feed.items.slice(0, 8)) {
        if (item.title) {
          // Google News format usually ends with " - Source Name"
          const parts = item.title.split(' - ');
          const title = parts.length > 1 ? parts.slice(0, -1).join(' - ') : item.title;
          const source = parts.length > 1 ? parts[parts.length - 1] : 'Google News';

          newsItems.push({
            title: title.trim(),
            link: item.link || '',
            pubDate: item.pubDate || new Date().toISOString(),
            source: source.trim(),
            contentSnippet: item.contentSnippet?.slice(0, 200) || '',
          });
        }
      }
    }
  } catch (error: any) {
    console.warn(`Failed to fetch Google RSS news for ${ticker}:`, error?.message);
  }

  return newsItems;
}

export async function fetchGlobalMacroNews(): Promise<NewsItem[]> {
  const feeds = [
    {
      name: 'CNBC Markets',
      url: 'https://search.cnbc.com/rs/search/combinedlist/view.xml?partnerId=wrss01&id=10000664',
    },
    {
      name: 'Reuters Business',
      url: 'https://news.google.com/rss/search?q=economy+inflation+fed+ecb+geopolitics+when:1d&hl=en-US&gl=US&ceid=US:en',
    },
    {
      name: 'Semiconductors & Tech',
      url: 'https://news.google.com/rss/search?q=semiconductors+chips+nvidia+taiwan+tariffs+when:1d&hl=en-US&gl=US&ceid=US:en',
    },
  ];

  const results: NewsItem[] = [];

  for (const f of feeds) {
    try {
      const parsed = await parser.parseURL(f.url);
      if (parsed.items && parsed.items.length > 0) {
        for (const it of parsed.items.slice(0, 4)) {
          if (it.title) {
            results.push({
              title: it.title.trim(),
              link: it.link || '',
              pubDate: it.pubDate || new Date().toISOString(),
              source: f.name,
              contentSnippet: it.contentSnippet?.slice(0, 220) || '',
            });
          }
        }
      }
    } catch (e: any) {
      console.warn(`Feed error on ${f.name}:`, e?.message);
    }
  }

  return results;
}
