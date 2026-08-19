import { notFound } from "next/navigation";
import { getChampionIndex } from "@/lib/lol/ddragon";

/**
 * Validates the slug before anything is sent to the client.
 *
 * The page below has a loading.tsx, so it streams — the 200 status goes out
 * with the shell, and a notFound() thrown inside the page can no longer change
 * it. An unknown champion answered 200 with an empty body. Layouts resolve
 * before the shell is flushed, so throwing here still produces a real 404.
 */
export default async function ChampionLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const index = await getChampionIndex();
  if (!index.bySlug.has(slug)) notFound();

  return children;
}
