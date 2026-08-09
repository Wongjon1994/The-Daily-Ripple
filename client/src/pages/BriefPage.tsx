import { useParams } from "wouter";
import BriefPageEnhanced from "./BriefPageEnhanced";

export default function BriefPage() {
  const params = useParams<{ slug?: string }>();
  return <BriefPageEnhanced initialSlug={params.slug} />;
}
