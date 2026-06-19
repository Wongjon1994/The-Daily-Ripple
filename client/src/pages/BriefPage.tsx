import { useParams, useSearch } from "wouter";
import BriefPageEnhanced from "./BriefPageEnhanced";

export default function BriefPage() {
  const params = useParams<{ slug?: string }>();
  const search = useSearch();
  // Optional ?story=N (1-based) deep-links to a specific story in the deck.
  const storyParam = new URLSearchParams(search).get("story");
  const n = storyParam ? parseInt(storyParam, 10) : NaN;
  const initialSectionIndex = Number.isFinite(n) && n > 0 ? n - 1 : 0;

  return (
    <BriefPageEnhanced initialSlug={params.slug} initialSectionIndex={initialSectionIndex} />
  );
}
