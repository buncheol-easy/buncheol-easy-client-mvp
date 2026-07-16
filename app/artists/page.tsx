import { redirect } from "next/navigation";
import { ArtistExploreExperience } from "@/components/ArtistExploreExperience";
import { FEATURES } from "@/lib/feature-flags";
import { whiteChromeViewport } from "@/lib/system-chrome";

export const viewport = whiteChromeViewport;

export default function ArtistsPage() {
  if (!FEATURES.favoriteArtists) {
    redirect("/");
  }

  return (
    <main className="system-chrome-white system-chrome-bottom-white h-[100dvh] overflow-hidden bg-white text-[#111111]">
      <ArtistExploreExperience />
    </main>
  );
}
