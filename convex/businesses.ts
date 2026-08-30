import { v } from "convex/values";
import { action, internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";

/** The signed-in owner's business, or null if they haven't connected yet. */
export const mine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    return await ctx.db
      .query("businesses")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
  },
});

/**
 * Step 2 — the owner confirms what Google already told us.
 * Everything here arrives pre-filled; they're reviewing, not typing.
 */
export const updateLocation = mutation({
  args: {
    orgName: v.string(),
    locationName: v.optional(v.string()),
    streetAddress: v.optional(v.string()),
    city: v.optional(v.string()),
    pinCode: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    website: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in first.");

    const business = await ctx.db
      .query("businesses")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!business) throw new Error("Connect your Google profile first.");

    await ctx.db.patch(business._id, {
      ...args,
      // Only ever move forward; going back to edit shouldn't undo progress.
      onboardingStep: Math.max(business.onboardingStep, 3),
    });

    return { ok: true };
  },
});

/*
 * How far a customer will travel, by trade.
 *
 * Distance is one of Google's three local ranking factors, and how far it
 * reaches depends entirely on what the shop sells. Someone picks the
 * dentist at the end of their road; nobody picks marble that way — they
 * drive across the district and compare. Measuring both over the same
 * radius reports one of them wrongly, so we ask what this trade looks like
 * before we measure anything.
 */
const FALLBACK_SCAN_KM: [RegExp, number][] = [
  [
    /dentist|dental|clinic|doctor|physician|hospital|pharmac|salon|spa|barber|parlour|gym|tuition|coaching|bakery|cafe|restaurant|grocer|kirana|laundry|tailor/i,
    4,
  ],
  [
    /school|college|vet|optic|diagnostic|pathology|repair|electrician|plumber|hardware|stationery|mobile/i,
    7,
  ],
  [
    /tile|marble|granite|sanitary|furniture|showroom|builder|interior|automobile|car|bike|jewell|electronics|appliance|wholesale|supplier|distributor/i,
    12,
  ],
];

export const saveRadius = internalMutation({
  args: {
    businessId: v.id("businesses"),
    scanRadiusKm: v.number(),
    radiusReason: v.string(),
  },
  handler: async (ctx, { businessId, ...rest }) => {
    await ctx.db.patch(businessId, rest);
  },
});

/**
 * Works out the distance this particular shop is judged over, and says why.
 * Cheap, runs once, and falls back to the table above if the model is
 * unavailable or answers with something unreasonable.
 */
export const tuneRadius = action({
  args: { force: v.optional(v.boolean()) },
  handler: async (
    ctx,
    { force = false },
  ): Promise<{ scanRadiusKm: number; reason: string } | null> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in first.");

    const business = await ctx.runQuery(internal.google.businessForUser, {
      userId,
    });
    if (!business) return null;
    if (!force && business.scanRadiusKm) {
      return {
        scanRadiusKm: business.scanRadiusKm,
        reason: business.radiusReason ?? "",
      };
    }

    const trade = business.primaryCategory ?? business.orgName;

    let km: number | null = null;
    let reason = "";

    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      try {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            temperature: 0.2,
            response_format: { type: "json_object" },
            messages: [
              {
                role: "user",
                content: [
                  `A ${trade} in ${business.city ?? "an Indian city"}, India.`,
                  "",
                  "How far will an ordinary customer travel to reach a shop",
                  "of this kind, in kilometres? Think about what the trade is",
                  "worth the trip for. People pick a dentist or a salon within",
                  "a few kilometres of home. People drive across a city to",
                  "compare marble, furniture or cars.",
                  "",
                  "Give a single number between 2 and 15, and one short",
                  "sentence a shop owner would recognise as true of their",
                  "trade. Do not mention SEO, Google or ranking.",
                  "",
                  'Reply with JSON: {"km": 4, "reason": "..."}',
                ].join("\n"),
              },
            ],
          }),
        });

        if (res.ok) {
          const body = await res.json();
          const parsed = JSON.parse(
            body.choices?.[0]?.message?.content ?? "{}",
          );
          const n = Number(parsed.km);
          if (Number.isFinite(n) && n >= 2 && n <= 15) {
            km = Math.round(n);
            reason = String(parsed.reason ?? "").slice(0, 200);
          }
        }
      } catch (error) {
        console.log("[radius] model call failed", error);
      }
    }

    if (km === null) {
      km = FALLBACK_SCAN_KM.find(([re]) => re.test(trade))?.[1] ?? 5;
      reason = `Typical travel distance for a ${trade.toLowerCase()}.`;
    }

    // Never measure further than the shop says it serves.
    km = Math.min(km, business.serviceRadiusKm ?? 30);

    await ctx.runMutation(internal.businesses.saveRadius, {
      businessId: business._id,
      scanRadiusKm: km,
      radiusReason: reason,
    });

    return { scanRadiusKm: km, reason };
  },
});
