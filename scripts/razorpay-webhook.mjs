#!/usr/bin/env node
/**
 * Fires a signed, fake Razorpay webhook at the local backend.
 *
 * Razorpay can't reach 127.0.0.1, so the webhook path — the one that has to
 * be right, because it grants access even if the customer's phone dies
 * after paying — never runs locally on its own. This does what Razorpay
 * would: builds a payment.captured event for an order, signs the raw body
 * with the webhook secret, and POSTs it to /razorpay/webhook.
 *
 *   npm run webhook:fake -- --order order_XXXX
 *
 * Get an order id from `npx convex data subscriptions` after opening
 * /app/billing and closing Checkout without paying; that leaves a row in
 * "created". Run it twice and the period must not double. Add
 * --bad-signature and the backend must answer 400 and write nothing.
 *
 * The secret comes from --secret, RAZORPAY_WEBHOOK_SECRET, or .env.convex,
 * and the target from --url, NEXT_PUBLIC_CONVEX_SITE_URL, or .env.local.
 */

import { createHmac } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

function readEnvFile(file) {
  if (!existsSync(file)) return {};
  const out = {};
  for (const raw of readFileSync(file, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function parseArgs(argv) {
  const args = { flags: new Set() };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith("--")) {
      args[key] = next;
      i += 1;
    } else {
      args.flags.add(key);
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const convexEnv = readEnvFile(".env.convex");
const localEnv = readEnvFile(".env.local");

const secret =
  args.secret ??
  process.env.RAZORPAY_WEBHOOK_SECRET ??
  convexEnv.RAZORPAY_WEBHOOK_SECRET;
const site = (
  args.url ??
  process.env.NEXT_PUBLIC_CONVEX_SITE_URL ??
  localEnv.NEXT_PUBLIC_CONVEX_SITE_URL ??
  "http://127.0.0.1:3211"
).replace(/\/+$/, "");
const order = args.order;
const event = args.event ?? "payment.captured";
const payment = args.payment ?? `pay_fake_${Date.now()}`;

if (!order || !secret) {
  console.error(
    [
      "usage: npm run webhook:fake -- --order order_XXXX [--payment pay_XXXX]",
      "         [--event payment.captured] [--url http://127.0.0.1:3211]",
      "         [--secret ...] [--bad-signature]",
      "",
      !order ? "  --order is required (npx convex data subscriptions)" : "",
      !secret
        ? "  no webhook secret: pass --secret or set RAZORPAY_WEBHOOK_SECRET"
        : "",
    ]
      .filter(Boolean)
      .join("\n"),
  );
  process.exit(1);
}

const body = JSON.stringify({
  entity: "event",
  event,
  payload: {
    payment: {
      entity: {
        id: payment,
        entity: "payment",
        order_id: order,
        status: "captured",
        currency: "INR",
        method: "upi",
      },
    },
  },
  created_at: Math.floor(Date.now() / 1000),
});

let signature = createHmac("sha256", secret).update(body).digest("hex");
if (args.flags.has("bad-signature")) {
  signature = signature.replace(/^./, (c) => (c === "0" ? "1" : "0"));
}

const url = `${site}/razorpay/webhook`;
console.log(`POST ${url}`);
console.log(`event=${event} order=${order} payment=${payment}`);

let res;
try {
  res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-razorpay-signature": signature,
      "x-razorpay-event-id": `evt_fake_${Date.now()}`,
    },
    body,
  });
} catch (error) {
  console.error(
    `could not reach ${url}: ${error instanceof Error ? error.message : error}`,
  );
  console.error("is `npx convex dev` running?");
  process.exit(2);
}

console.log(`${res.status} ${await res.text()}`);
process.exit(res.ok ? 0 : 2);
