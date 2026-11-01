import { sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { helpArticles } from '@/db/schema/app';
import { failure, success } from '@/lib/result';

export async function searchHelpArticles(query: string) {
  const term = query.trim().slice(0, 200);
  if (!term) {
    return success([]);
  }

  try {
    const rows = await db
      .select({
        id: helpArticles.id,
        title: helpArticles.title,
        body: helpArticles.body,
        slug: helpArticles.slug,
        rank: sql<number>`ts_rank(to_tsvector('portuguese', ${helpArticles.title} || ' ' || ${helpArticles.body}), plainto_tsquery('portuguese', ${term}))`,
      })
      .from(helpArticles)
      .where(
        sql`${helpArticles.active} = true AND to_tsvector('portuguese', ${helpArticles.title} || ' ' || ${helpArticles.body}) @@ plainto_tsquery('portuguese', ${term})`,
      )
      .orderBy(sql`rank DESC`)
      .limit(5);

    return success(rows);
  } catch {
    return failure('HELP_SEARCH_UNAVAILABLE', 'A central de ajuda está indisponível.');
  }
}
