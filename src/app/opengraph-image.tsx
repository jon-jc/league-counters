import { ImageResponse } from "next/og";

export const alt = "League Counters — LoL tier list and counter picks";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * The card people actually see when a link is shared.
 *
 * Champion pages override this with their own key art; this is the fallback for
 * the home page, tier list and compare. Rendered at request time and cached,
 * rather than checked in as a binary, so the wording stays in step with the site.
 */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(135deg, #05070d 0%, #0d1424 55%, #1a1230 100%)",
          padding: 72,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "linear-gradient(135deg, #5B8CFF 0%, #C084FC 100%)",
              color: "#05070d",
              fontSize: 26,
              fontWeight: 700,
            }}
          >
            L
          </div>
          <div style={{ display: "flex", fontSize: 26, color: "#93a1b8", letterSpacing: 1 }}>
            LEAGUE COUNTERS
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div
            style={{
              display: "flex",
              fontSize: 78,
              fontWeight: 700,
              color: "#e8edf6",
              lineHeight: 1.05,
              letterSpacing: -2,
            }}
          >
            Know the counter
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 78,
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: -2,
              color: "#7aa2ff",
            }}
          >
            before you lock in.
          </div>
          <div style={{ display: "flex", fontSize: 30, color: "#93a1b8", marginTop: 8 }}>
            Tier lists and lane matchups from real ranked games, per region.
          </div>
        </div>

        <div style={{ display: "flex", gap: 14 }}>
          {["S+", "S", "A", "B", "C", "D"].map((tier, index) => (
            <div
              key={tier}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 62,
                height: 44,
                borderRadius: 10,
                fontSize: 24,
                fontWeight: 700,
                color: ["#ff5f9e", "#ffb020", "#7aa2ff", "#34d399", "#94a3b8", "#78899f"][index],
                border: `2px solid ${["#ff5f9e", "#ffb020", "#7aa2ff", "#34d399", "#94a3b8", "#78899f"][index]}55`,
                background: `${["#ff5f9e", "#ffb020", "#7aa2ff", "#34d399", "#94a3b8", "#78899f"][index]}18`,
              }}
            >
              {tier}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
