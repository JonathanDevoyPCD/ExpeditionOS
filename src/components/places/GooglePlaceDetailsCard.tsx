"use client";

import { Clock3, ExternalLink, Globe2, LoaderCircle, Phone, Star } from "lucide-react";
import { useEffect, useState } from "react";
import type { GooglePlaceDetails, GooglePlaceLookupInput } from "@/types/googlePlace";

function priceLabel(value?: string) {
  return {
    PRICE_LEVEL_FREE: "Free",
    PRICE_LEVEL_INEXPENSIVE: "$",
    PRICE_LEVEL_MODERATE: "$$",
    PRICE_LEVEL_EXPENSIVE: "$$$",
    PRICE_LEVEL_VERY_EXPENSIVE: "$$$$",
  }[value ?? ""];
}

export default function GooglePlaceDetailsCard({ place }: { place: GooglePlaceLookupInput }) {
  const [details, setDetails] = useState<GooglePlaceDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setDetails(null);
      setUnavailable(false);
    });
    if (place.hasMappedName === false) return () => controller.abort();
    queueMicrotask(() => setLoading(true));
    fetch("/api/places/enrich", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(place),
      signal: controller.signal,
    }).then(async (response) => {
      const result = await response.json() as { place?: GooglePlaceDetails; error?: string };
      if (!response.ok || !result.place) throw new Error(result.error ?? "Google place lookup failed.");
      return result.place;
    }).then(setDetails).catch((error: unknown) => {
      if (!(error instanceof Error) || error.name !== "AbortError") setUnavailable(true);
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [place]);

  if (place.hasMappedName === false) return null;
  if (loading) return <div className="mt-3 flex items-center gap-2 rounded-xl border border-[#4285f4]/15 bg-[#4285f4]/[0.04] px-3 py-2 text-[9px] text-[#d0d6d6]/45"><LoaderCircle className="size-3 animate-spin text-[#4285f4]" /> Checking current Google place details…</div>;
  if (!details) return unavailable ? <p className="mt-3 text-[8px] text-[#d0d6d6]/25">No confident Google Places match found.</p> : null;

  const price = priceLabel(details.priceLevel);
  return (
    <div className="mt-3 rounded-xl border border-[#4285f4]/20 bg-[#4285f4]/[0.045] p-3">
      <div className="flex items-center gap-2">
        <span className="font-sans text-[10px] font-semibold text-white">Google Maps</span>
        <span className={`ml-auto rounded-full px-2 py-0.5 text-[8px] font-bold ${details.openNow === true ? "bg-emerald-300/10 text-emerald-200" : details.openNow === false ? "bg-rose-300/10 text-rose-200" : "bg-white/[0.05] text-[#d0d6d6]/40"}`}>{details.openNow === true ? "OPEN NOW" : details.openNow === false ? "CLOSED NOW" : "HOURS UNKNOWN"}</span>
      </div>
      <p className="mt-2 text-[11px] font-semibold text-white">{details.displayName}</p>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] text-[#d0d6d6]/55">
        {details.rating !== undefined && <span className="flex items-center gap-1"><Star className="size-3 fill-[#fbbc04] text-[#fbbc04]" /> {details.rating.toFixed(1)} <span className="text-[#d0d6d6]/32">({details.userRatingCount?.toLocaleString() ?? 0})</span></span>}
        {details.primaryType && <span>{details.primaryType}</span>}
        {price && <span>{price}</span>}
      </div>
      {details.formattedAddress && <p className="mt-2 text-[9px] leading-4 text-[#d0d6d6]/42">{details.formattedAddress}</p>}
      {details.openingHours.length > 0 && <details className="mt-2 text-[9px] text-[#d0d6d6]/45"><summary className="flex cursor-pointer list-none items-center gap-1.5 font-semibold text-[#8ab4f8]"><Clock3 className="size-3" /> View weekly hours</summary><ul className="mt-2 space-y-1 border-l border-white/[0.07] pl-3">{details.openingHours.map((line) => <li key={line}>{line}</li>)}</ul></details>}
      <div className="mt-3 flex flex-wrap gap-2">
        <a href={details.googleMapsUri} target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded-lg bg-[#4285f4] px-2.5 py-1.5 text-[8px] font-bold text-white"><ExternalLink className="size-3" /> View on Google Maps</a>
        {details.website && <a href={details.website} target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded-lg border border-white/[0.08] px-2.5 py-1.5 text-[8px] text-[#d0d6d6]/55"><Globe2 className="size-3" /> Website</a>}
        {details.phone && <a href={`tel:${details.phone}`} className="flex items-center gap-1 rounded-lg border border-white/[0.08] px-2.5 py-1.5 text-[8px] text-[#d0d6d6]/55"><Phone className="size-3" /> Call</a>}
      </div>
      <p className="mt-2 text-[7px] leading-3 text-[#d0d6d6]/24">Rating and current status supplied by Google Maps. Confirm critical expedition stops directly before departure.</p>
    </div>
  );
}
