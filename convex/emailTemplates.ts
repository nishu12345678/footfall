/**
 * Every email the product sends, in one place, as plain functions.
 *
 * Short, plain Indian English, sentence case, one clear next step. The
 * text version is the real one; the HTML is the same words in a light
 * wrapper so it reads well in Gmail on a phone.
 */

export type Rendered = { subject: string; text: string; html: string };

type Params = Record<string, unknown> & {
  name?: string;
  orgName?: string;
};

const SITE = () => process.env.SITE_URL ?? "https://footfall.zone";

const inr = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN")}`;
const day = (ms: number) =>
  new Date(ms).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

function escape(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Text -> HTML. Paragraphs split on blank lines; bare URLs become links. */
function wrap(subject: string, text: string, cta?: { label: string; href: string }) {
  const paras = text
    .split(/\n{2,}/)
    .map((p) => escape(p.trim()).replace(/\n/g, "<br>"))
    .map((p) =>
      p.replace(
        /(https?:\/\/[^\s<]+)/g,
        '<a href="$1" style="color:#2b4eff">$1</a>',
      ),
    )
    .map((p) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.55">${p}</p>`)
    .join("");

  const button = cta
    ? `<p style="margin:24px 0 8px"><a href="${escape(cta.href)}" style="display:inline-block;background:#131311;color:#faf9f7;text-decoration:none;padding:12px 20px;border-radius:12px;font-weight:600;font-size:15px">${escape(cta.label)}</a></p>`
    : "";

  return `<!doctype html><html><body style="margin:0;background:#faf9f7;color:#131311;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif"><div style="max-width:560px;margin:0 auto;padding:32px 24px"><p style="margin:0 0 24px;font-size:13px;font-weight:700;letter-spacing:.04em;color:#2b4eff">footfall</p><h1 style="margin:0 0 20px;font-size:22px;line-height:1.3">${escape(subject)}</h1>${paras}${button}<p style="margin:32px 0 0;font-size:12px;color:#8a867c">footfall · the AI that runs your Google listing</p></div></body></html>`;
}

function greet(p: Params) {
  return p.name ? `Hi ${p.name},` : "Hi,";
}

type Template = (p: Params) => { subject: string; text: string; cta?: { label: string; href: string } };

const TEMPLATES: Record<string, Template> = {
  welcome: (p) => ({
    subject: "Welcome to footfall",
    text: [
      greet(p),
      "",
      "You're signed in. The next step is to connect your Google Business Profile — one Google login, about 40 seconds — and we'll read your listing and show you exactly what's holding it back. Nothing is published and nothing changes until you say so.",
      "",
      `Start here: ${SITE()}/app/connect`,
    ].join("\n"),
    cta: { label: "Connect your Google listing", href: `${SITE()}/app/connect` },
  }),

  setup_complete: (p) => ({
    subject: `${p.orgName ?? "Your listing"} is set up`,
    text: [
      greet(p),
      "",
      `Setup for ${p.orgName ?? "your listing"} is finished and the agent is on. From here we draft posts for you to approve, reply to reviews, and track where you rank for the searches that matter.`,
      "",
      "You'll get an email whenever something needs your eyes — a batch of posts to approve, or a low-star review we've drafted a reply for.",
      "",
      `Your dashboard: ${SITE()}/app`,
    ].join("\n"),
    cta: { label: "Open footfall", href: `${SITE()}/app` },
  }),

  receipt: (p) => ({
    subject: `Payment received — ${inr(Number(p.amountPaise))} for the ${String(p.plan)} plan`,
    text: [
      greet(p),
      "",
      `Thanks — your payment of ${inr(Number(p.amountPaise))} for the ${String(p.plan)} plan has gone through.`,
      "",
      `Plan runs from ${day(Number(p.startsAt))} to ${day(Number(p.expiresAt))}.`,
      `Payment ID: ${String(p.paymentId)}`,
      `Order ID: ${String(p.orderId)}`,
      "",
      "There is no auto-debit. We'll email you a week before it ends so you can renew if you want to.",
      "",
      `Your receipts are always at ${SITE()}/app/billing`,
    ].join("\n"),
    cta: { label: "See your plan", href: `${SITE()}/app/billing` },
  }),

  payment_failed: (p) => ({
    subject: "Your payment didn't go through",
    text: [
      greet(p),
      "",
      `The payment for the ${String(p.plan)} plan didn't complete${p.reason ? ` — ${String(p.reason)}` : ""}. Nothing has been charged.`,
      "",
      "If money left your account, the bank will return it within 5-7 working days; Razorpay never keeps a failed payment.",
      "",
      `You can try again any time: ${SITE()}/app/billing`,
    ].join("\n"),
    cta: { label: "Try again", href: `${SITE()}/app/billing` },
  }),

  payment_confirming: (p) => ({
    subject: "We're confirming your payment",
    text: [
      greet(p),
      "",
      `Razorpay has your payment for the ${String(p.plan)} plan but hasn't confirmed it to us yet. This usually settles within a few minutes; we'll email you the receipt the moment it does.`,
      "",
      `If it still shows as pending after an hour, open ${SITE()}/app/billing and tap "Check payment status", or reply to this email with payment ID ${String(p.paymentId)}.`,
    ].join("\n"),
    cta: { label: "Check payment status", href: `${SITE()}/app/billing` },
  }),

  refund_processed: (p) => ({
    subject: `Refund of ${inr(Number(p.amountPaise))} is on its way`,
    text: [
      greet(p),
      "",
      `We've refunded ${inr(Number(p.amountPaise))} to the payment method you used${p.full ? ", and your plan has ended" : ""}. Banks take 5-7 working days to show it.`,
      "",
      `Refund ID: ${String(p.refundId)}`,
      `Payment ID: ${String(p.paymentId)}`,
    ].join("\n"),
  }),

  plan_expiring: (p) => ({
    subject: `Your footfall plan ends in ${String(p.days)} day${Number(p.days) === 1 ? "" : "s"}`,
    text: [
      greet(p),
      "",
      `Your ${String(p.plan)} plan ends on ${day(Number(p.expiresAt))}. There's no auto-debit, so nothing happens unless you renew.`,
      "",
      "After that date posts stop going up, reviews stop being answered and the rank tracking pauses. Renewing keeps everything running without a gap.",
      "",
      `Renew here: ${SITE()}/app/billing`,
    ].join("\n"),
    cta: { label: "Renew now", href: `${SITE()}/app/billing` },
  }),

  plan_expired: (p) => ({
    subject: "Your footfall plan has ended",
    text: [
      greet(p),
      "",
      `Your ${String(p.plan)} plan ended on ${day(Number(p.expiresAt))}. The agent has paused: no posts, no review replies, no rank checks until it's renewed.`,
      "",
      "Your listing, your posts and your report are all still here. Renew and it picks up where it left off.",
      "",
      `${SITE()}/app/billing`,
    ].join("\n"),
    cta: { label: "Renew", href: `${SITE()}/app/billing` },
  }),

  posts_awaiting_approval: (p) => ({
    subject: `${String(p.count)} post${Number(p.count) === 1 ? "" : "s"} ready for you to approve`,
    text: [
      greet(p),
      "",
      `We've drafted ${String(p.count)} post${Number(p.count) === 1 ? "" : "s"} for ${p.orgName ?? "your listing"}. Nothing goes on your Google listing until you approve it — read them, change anything you like, then approve and schedule.`,
      "",
      `Review them here: ${SITE()}/app/posts`,
    ].join("\n"),
    cta: { label: "Review posts", href: `${SITE()}/app/posts` },
  }),

  post_failed: (p) => ({
    subject: "Google refused a post",
    text: [
      greet(p),
      "",
      `A scheduled post for ${p.orgName ?? "your listing"} was refused by Google${p.error ? `: ${String(p.error)}` : "."}`,
      "",
      "It's back under \"Waiting for you\" on the Posts screen. Edit it if the reason is clear, then approve it again.",
      "",
      `${SITE()}/app/posts`,
    ].join("\n"),
    cta: { label: "Open posts", href: `${SITE()}/app/posts` },
  }),

  reviews_need_approval: (p) => ({
    subject: `${String(p.count)} review${Number(p.count) === 1 ? "" : "s"} need${Number(p.count) === 1 ? "s" : ""} your eyes`,
    text: [
      greet(p),
      "",
      `A low-star review came in for ${p.orgName ?? "your listing"}. We've written a reply, but anything under your name on a complaint only goes out when you say so.`,
      "",
      `Read it and approve, edit or discard: ${SITE()}/app/reviews`,
    ].join("\n"),
    cta: { label: "Read the reply", href: `${SITE()}/app/reviews` },
  }),

  google_disconnected: (p) => ({
    subject: "Google Business Profile disconnected",
    text: [
      greet(p),
      "",
      `Your Google Business Profile has been disconnected from footfall and the agent is paused. We've asked Google to revoke our access, so we can no longer read or change the listing.`,
      "",
      "If this wasn't you, sign in and check your account. To start again, reconnect here:",
      `${SITE()}/app/connect`,
    ].join("\n"),
    cta: { label: "Reconnect", href: `${SITE()}/app/connect` },
  }),

  signed_out_everywhere: (p) => ({
    subject: "You were signed out on every device",
    text: [
      greet(p),
      "",
      "Every footfall session on every device has been signed out, as requested. Anyone still signed in will have to sign in again.",
      "",
      "If this wasn't you, sign in and disconnect Google from Settings.",
    ].join("\n"),
  }),
};

export function render(template: string, params: Params): Rendered {
  const fn = TEMPLATES[template];
  if (!fn) throw new Error(`Unknown email template: ${template}`);
  const { subject, text, cta } = fn(params);
  return { subject, text, html: wrap(subject, text, cta) };
}

export const TEMPLATE_NAMES = Object.keys(TEMPLATES);
