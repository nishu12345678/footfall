import { describe, expect, it } from "vitest";
import { PRICING } from "./content";

/**
 * The yearly card shows two different savings at once:
 *
 *   badge  yearly vs twelve months of monthly   (this file)
 *   pill   yearly offer vs yearly list price    (a different number)
 *
 * They have been confused before — a hardcoded "Save ₹14,000" sat
 * unlabelled next to "save ₹10,000" with nothing to say why the same
 * card claimed both. These tests pin WHICH prices the badge compares, so
 * a future edit cannot quietly change the baseline and inflate it.
 */

const monthly = PRICING.plans.find((p) => p.period === "month")!;
const yearly = PRICING.plans.find((p) => p.period === "year")!;

describe("yearlySaving", () => {
  it("compares offer price to offer price, not list price", () => {
    const { amount } = PRICING.yearlySaving();
    const offerVsOffer = monthly.price * 12 - yearly.price;
    const listVsOffer = monthly.listPrice * 12 - yearly.price;

    expect(amount).toBeLessThanOrEqual(offerVsOffer);
    // The list-price comparison would inflate the badge by crediting us
    // for a discount nobody is charged. It must never be that number.
    expect(amount).toBeLessThan(listVsOffer);
  });

  it("never overstates the real saving", () => {
    const { amount } = PRICING.yearlySaving();
    expect(amount).toBeLessThanOrEqual(monthly.price * 12 - yearly.price);
  });

  it("still holds after the launch offer ends", () => {
    /* When the offer ends, `price` becomes `listPrice` on both plans.
       The badge must keep working with no code change — it should
       recompute, not go blank, negative, or stale. This simulates that
       future by running the same arithmetic on the list prices. */
    const after = Math.floor((monthly.listPrice * 12 - yearly.listPrice) / 100) * 100;

    expect(after).toBeGreaterThan(0); // yearly must still be worth buying
    expect(after % 100).toBe(0);
    expect(after).toBeLessThan(PRICING.yearlySaving().amount); // and honestly smaller
  });

  it("rounds down to a whole ₹100", () => {
    expect(PRICING.yearlySaving().amount % 100).toBe(0);
  });

  it("shows working that adds up, using the same prices as the cards", () => {
    const { working } = PRICING.yearlySaving();
    expect(working).toContain(`₹${monthly.price.toLocaleString("en-IN")}`);
    expect(working).toContain(`₹${(monthly.price * 12).toLocaleString("en-IN")}`);
    expect(working).toContain(`₹${yearly.price.toLocaleString("en-IN")}`);
    expect(working).toContain(
      `₹${(monthly.price * 12 - yearly.price).toLocaleString("en-IN")}`,
    );
  });

  it("is worth showing at all — a yearly plan that saved nothing should not boast", () => {
    expect(PRICING.yearlySaving().amount).toBeGreaterThan(0);
  });
});

describe("plan display prices", () => {
  it("every plan is discounted from its list price", () => {
    for (const p of PRICING.plans) {
      expect(p.price, `${p.id} price`).toBeLessThan(p.listPrice);
    }
  });

  it("exactly one plan is featured", () => {
    expect(PRICING.plans.filter((p) => p.featured)).toHaveLength(1);
  });

  it("the yearly per-month figure matches its price", () => {
    // Shown as "Works out to ₹833 a month" — it must not drift from the
    // price above it.
    expect(Math.round(yearly.price / 12)).toBe(yearly.perMonth);
  });
});
