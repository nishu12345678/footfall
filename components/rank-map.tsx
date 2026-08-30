"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap, LayerGroup } from "leaflet";
import "leaflet/dist/leaflet.css";

export type GridPoint = {
  lat: number;
  lng: number;
  rank?: number;
};

/** Green when you're top 3, amber to 10, red beyond, grey when absent. */
function colourFor(rank?: number) {
  if (rank === undefined || rank === null) return { fill: "#7c7565", text: "–" };
  if (rank <= 3) return { fill: "#12744e", text: String(rank) };
  if (rank <= 10) return { fill: "#e2a021", text: String(rank) };
  return { fill: "#dd4327", text: String(rank) };
}

/**
 * Where the shop ranks for one search, seen from several points around it.
 *
 * A single rank number is misleading — standing at your own door you always
 * look better than a customer three kilometres away. This shows the falloff.
 */
export function RankMap({
  lat,
  lng,
  points,
  keyword,
}: {
  lat: number;
  lng: number;
  points: GridPoint[];
  keyword: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const L = await import("leaflet");
      if (cancelled || !hostRef.current || mapRef.current) return;

      const map = L.map(hostRef.current, {
        center: [lat, lng],
        zoom: 12,
        zoomControl: false,
        scrollWheelZoom: false,
      });

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: "© OpenStreetMap",
      }).addTo(map);

      layerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const L = await import("leaflet");
      const map = mapRef.current;
      const layer = layerRef.current;
      if (cancelled || !map || !layer) return;

      layer.clearLayers();
      if (points.length === 0) return;

      for (const point of points) {
        const { fill, text } = colourFor(point.rank);
        L.marker([point.lat, point.lng], {
          icon: L.divIcon({
            className: "",
            html:
              `<span style="display:grid;place-items:center;width:26px;height:26px;` +
              `border-radius:999px;border:1.5px solid #14130e;background:${fill};` +
              `color:#fffdf7;font:700 11px/1 ui-sans-serif,system-ui;">${text}</span>`,
            iconSize: [26, 26],
            iconAnchor: [13, 13],
          }),
        })
          .addTo(layer)
          .bindTooltip(
            point.rank ? `Rank ${point.rank} here` : "Not in the top 20 here",
            { direction: "top", offset: [0, -10] },
          );
      }

      map.fitBounds(
        L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number])),
        { padding: [26, 26] },
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [points]);

  const found = points.filter((p) => p.rank !== undefined).length;

  return (
    <div className="overflow-hidden rounded-[14px] border border-ink shadow-[3px_3px_0_var(--color-ink)]">
      <div ref={hostRef} className="h-[240px] w-full bg-paper-3" />
      <p className="border-t border-ink bg-paper-3 px-3 py-1.5 font-mono text-[10px] leading-relaxed text-ink-soft">
        &ldquo;{keyword}&rdquo; · found at {found} of {points.length} points
      </p>
    </div>
  );
}
