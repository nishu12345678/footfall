"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap, Circle, LayerGroup } from "leaflet";
import "leaflet/dist/leaflet.css";

export type AreaPin = {
  name: string;
  km: number;
  lat?: number;
  lng?: number;
  added?: boolean;
};

/**
 * The shop, the radius it serves, and the localities inside it.
 *
 * Leaflet is loaded inside the effect because it reaches for `window` on
 * import, which would break server rendering. Markers are drawn as circles
 * rather than Leaflet's default pin, whose icon files don't survive
 * bundling without extra configuration.
 */
export function AreaMap({
  lat,
  lng,
  radiusKm,
  label,
  pins = [],
}: {
  lat: number;
  lng: number;
  radiusKm: number;
  label: string;
  pins?: AreaPin[];
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const circleRef = useRef<Circle | null>(null);
  const pinsRef = useRef<LayerGroup | null>(null);

  // Create the map once.
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const L = await import("leaflet");
      if (cancelled || !hostRef.current || mapRef.current) return;

      const map = L.map(hostRef.current, {
        center: [lat, lng],
        zoom: 11,
        zoomControl: false,
        attributionControl: true,
        scrollWheelZoom: false,
      });

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: "© OpenStreetMap",
      }).addTo(map);

      circleRef.current = L.circle([lat, lng], {
        radius: radiusKm * 1000,
        color: "#dd4327",
        weight: 2,
        fillColor: "#dd4327",
        fillOpacity: 0.08,
      }).addTo(map);

      // The shop itself.
      L.circleMarker([lat, lng], {
        radius: 7,
        color: "#14130e",
        weight: 2,
        fillColor: "#dd4327",
        fillOpacity: 1,
      })
        .addTo(map)
        .bindTooltip(label, { direction: "top", offset: [0, -8] });

      pinsRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      map.fitBounds(circleRef.current.getBounds(), { padding: [12, 12] });
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // Built once; radius and pins are updated by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resize the circle when the owner changes the radius.
  useEffect(() => {
    const map = mapRef.current;
    const circle = circleRef.current;
    if (!map || !circle) return;
    circle.setRadius(radiusKm * 1000);
    map.fitBounds(circle.getBounds(), { padding: [12, 12] });
  }, [radiusKm]);

  // Redraw the locality dots.
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const L = await import("leaflet");
      const group = pinsRef.current;
      if (cancelled || !group) return;

      group.clearLayers();
      for (const pin of pins) {
        if (pin.lat === undefined || pin.lng === undefined) continue;
        L.circleMarker([pin.lat, pin.lng], {
          radius: 5,
          color: pin.added ? "#12744e" : "#14130e",
          weight: 1.5,
          fillColor: pin.added ? "#12744e" : "#fffdf7",
          fillOpacity: 1,
        })
          .addTo(group)
          .bindTooltip(`${pin.name} · ${pin.km}km`, {
            direction: "top",
            offset: [0, -6],
          });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pins]);

  return (
    <div className="overflow-hidden rounded-[14px] border border-ink shadow-[3px_3px_0_var(--color-ink)]">
      <div ref={hostRef} className="h-[220px] w-full bg-paper-3" />
      <p className="border-t border-ink bg-paper-3 px-3 py-1.5 font-mono text-[10px] text-ink-soft">
        {radiusKm}km around {label}
      </p>
    </div>
  );
}
