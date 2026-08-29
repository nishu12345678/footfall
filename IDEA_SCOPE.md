# IDEA_SCOPE.md — Build Week control plane

**Window:** Sat 29 Aug 2026 → Sat 5 Sep 2026
**Submission:** Sat 5 Sep, 11:00 AM IST — live product + public GitHub repo + numbers. Demos 3:00 PM.
**Mode:** Solo. Stack fixed: Claude Code / Codex · GitHub · Convex · Vercel.
**Primary track:** AI Agent as a Service. Cross-track bonus: Revenue.

This file is the control plane. If a decision is not in here, it is not happening this week.
Anything new goes to the Parking Lot, not into the build.

---

## 0. The product

**One sentence:**
Local business owners waste money on agencies and Instagram posts that never turn into footfall, so we run their Google Business Profile with AI — keywords, posts, service pages, review replies, review collection — until they rank in the local map pack. It worked if calls and store visits from their own neighbourhood go up.

**The person:** Owner-operator of a local walk-in business (salon, clinic, shop) serving ~5km around them. Works *in* the shop. Pays or has paid Rs 8–15k/month for "marketing" and got screenshots, not customers.

**The pain:** The Google listing — the thing people actually search — is stale. No posts in months, reviews unanswered. So they never appear in the map results, while the money goes to Instagram.

**Core action:** Owner connects his Google Business Profile once → we run it.

**North star:** more calls and store visits from his own neighbourhood.

**Honest caveat:** ranking moves over weeks, not days. Quote the north star in the demo; show the proxy numbers as evidence. Do not claim a ranking change you cannot prove by Saturday.

---

## 1. Statement hygiene

Three kinds of statements, kept separate all week. Do not let them blur in the demo.

| Type | Meaning | Example |
|---|---|---|
| **STATED** | I said it | "I have Google Business Information API access approved." |
| **VERIFIED** | Proven by a source or a passing call | "Publishing a local post returned 200 at 21:14 on 29 Aug." |
| **INFERRED** | Reasoned, not proven | "Review freshness helps local ranking." |

Unverified as of 29 Aug — must move to VERIFIED tonight:

- INFERRED: the approved access covers **local posts** and **review replies**, not just business info.
- INFERRED: Google OAuth in "testing" mode allows a small number of external test users without a full app verification review. Verify before inviting anyone.
- INFERRED: Meta WhatsApp business-initiated messages need a verified business plus approved templates, and cost money per message.
- INFERRED: review count, freshness and replies are among the strongest levers a small business can move for local rank.

---

## 2. STOP — assumption tests before any build

**No code until these three are done.** Saturday 29 Aug.

### T1 — Will an owner actually hand over access? (30 min, no code)

The whole product is "connect and we run it." If owners will not connect, there is no product.

Send the dentist two WhatsApp messages, in this order:

1. "Can you open your Google Business listing right now? Send me a screenshot."
2. "If I could fix your listing so people actually find you on Google, would you give me access this week?"

| Outcome | Meaning | Action |
|---|---|---|
| Screenshot + yes | Green. Core model holds. | Proceed. He is user #1 on Monday. |
| "It's with my marketing guy" | The freelancer holds the login. Very common. | Still proceed — but add "we help you reclaim access" to the Monday script and test it live. |
| Hesitation about access | Trust is the real blocker, not the tech. | Proceed, but v1 must show visible value **before** asking to connect. See M1 fallback. |
| No reply by 9pm | Not a signal. | Send to the tile shop and the mattress shop. Need one yes tonight. |

**Send the same two messages to all three. Cost: six messages. Value: the entire week's premise.**

### T2 — Does the API actually do what I need? (60 min, HARD TIMEBOX)

Three calls, in this order. Stop the clock at 60 minutes regardless of progress.

1. Read a real business location (Business Information API).
2. **Publish a local post to a real profile.**
3. **Reply to a real review.**

| Result | Plan |
|---|---|
| All three succeed | **PLAN A.** Sunday builds the real connect-and-publish loop. |
| Only #1 works | **PLAN B.** Sunday ships the human-powered version. Access request for posts/reviews goes in tonight; retry Wednesday. |
| Nothing works in 60 min | **PLAN B.** No extensions. Debugging the API on Sunday is how the week dies. |

### T3 — Start Meta's clock (15 min)

Submit the WhatsApp Business Platform and Instagram app applications **today**, before building anything. Approval waits are free if they run in the background. Nothing this week blocks on them.

### Gate

Do not open the editor until T1, T2 and T3 are done and Plan A or Plan B is written in the Daily Log.

---

## 3. Plan A and Plan B

Same promise to the customer. Different machinery. **The owner should not be able to tell.**

| | **Plan A — API works** | **Plan B — API does not** |
|---|---|---|
| Connect | Owner does Google OAuth on the site | Owner submits business name + city in a form |
| Read | We pull business, category, reviews via API | We look up his public listing by hand |
| Generate | AI writes a keyword-targeted post + review replies | Same AI generation, same output |
| Publish | Posted to his profile automatically | He taps approve; **you publish it by hand** in under 5 min |
| What he sees | Profile updated today | Profile updated today |

Plan B is not a lesser product. It is the same product with you as the runtime. Ship Plan B without shame if T2 says so — a live product beats a correct architecture.

---

## 4. Milestones

Every milestone has a binary acceptance test and a fallback. If the acceptance test fails at the day's end time, take the fallback and move on. **Never carry a failed milestone into the next day.**

---

### M0 — Sat 29 Aug · Prove the premise, stand up the skeleton

Time: today, whatever remains.

- [ ] T1 access test — three owners messaged
- [ ] T2 API spike — 60 min timebox
- [ ] T3 Meta applications submitted
- [ ] Write "PLAN A" or "PLAN B" in the Daily Log
- [ ] **Run the pipeline once.** One sentence to Claude Code:
      *"Ship this to Vercel. Set up GitHub and Vercel from scratch and make it auto-deploy. Ask me the repo name and whether it's public."*
      It will pause twice — repo name, public or private. **Public.** The submission requires it.
- [ ] Commit this file as the first commit
- [ ] Convex project created and connected
- [ ] **Deploy a page that says the product name and nothing else**

**Acceptance test:** a public Vercel URL loads on your phone, and the repo is public on GitHub with this file in it. That is all. Not a feature — proof that the pipe from your laptop to the internet works.

**Why this happens on Day 1 and not Day 2:** after this runs once, laptop → GitHub → Vercel is permanent. Every push deploys itself for the rest of the week. Setting it up on Sunday means debugging deployment on your most important build day.

**If behind, cut to:** T1 + T2 + a deployed blank page. The Convex wiring can happen Sunday morning.

---

### M1 — Sun 30 Aug · One ugly, hardcoded, complete flow — live

Time: full day, ~8h. **The most important day of the week.**

Build exactly one loop, end to end, deployed. Ugly is required, not tolerated. Hardcode anything that is not the loop. One business type. One city. One prompt. No settings.

**Plan A loop:**
Owner opens the URL → clicks Connect Google → picks his business → sees a live preview of an AI-written post about his actual services → clicks Publish → **the post is live on his real Google profile** → the page shows "Published. Your profile was stale for X months."

**Plan B loop:**
Owner opens the URL → enters business name and city → sees a live preview of an AI-written post about his actual services → clicks Approve → the page shows "We're publishing this to your profile now" → you publish it by hand within 5 minutes → status flips to Published.

**Acceptance test — the whole week hinges on this one:**

> Someone who is not you, whom you have not briefed, opens the live URL on their phone and gets a post published to their Google profile **without you saying a single word.**
> Test it on a family member at 9pm. If you had to explain anything, it is not done.

**If behind at 9pm Sunday, cut to, in this order:**

1. Drop Publish. Ship connect → AI post preview → a "Publish" button that emails you. You publish by hand.
2. Drop Connect. Ship a form: business name and city → post preview → approve.
3. Drop AI. Ship three hardcoded post templates by business type.

**Non-negotiable regardless of cuts: it is deployed on Vercel and pushed to GitHub by end of Sunday.** Never build a second day on an undeployed first day.

---

### M2 — Mon 31 Aug · Three people use it while you watch

Time: 3:00pm onwards. Mornings are blocked. **These are scheduled appointments, not "reach out."**

| Time | Who | Format |
|---|---|---|
| 3:00–3:30pm | Confirm all three slots by WhatsApp | — |
| 4:00pm | **The dentist** | Video call with screen shared, or in person |
| 5:30pm | **Tile & marble shop** | In person if possible |
| 7:00pm | **Mattress shop** | Shops are open; evening suits them |
| 8:30–9:30pm | Write up, pick the single biggest blocker | — |

**Session rules — the whole value is here:**

- Send the link. Say nothing else. Then **shut up and watch.**
- Do not help. Do not explain. When they get stuck, count to ten before speaking.
- Write down the **exact moment they stop** and what they said out loud.
- Last question every time: *"Would you pay Rs 500 a month for this?"* Then be silent. Their pause is the answer, not their words.

**Acceptance test:** three real owners used it while you watched, and you can name the single point where most of them stopped.

**If behind, cut to:** two sessions. Never fewer than two — one owner's opinion is noise. If a session cancels, replace it the same evening with any local owner you can reach, even a walk-in.

---

### M3 — Tue 1 Sep · Put it where they already are

Time: 3:00pm onwards. **These are scheduled tasks with times, not "do some marketing."**

| Time | Task |
|---|---|
| 3:00–4:00pm | Fix only what blocked *everyone* on Monday. Nothing else. |
| 4:00–5:30pm | **15 direct one-to-one WhatsApp invites** to local owners. Personal, named, one line each. Not a forward. |
| 7:00–7:30pm | **Post in your local business owner WhatsApp groups.** Evening — INFERRED best time for shopkeepers. Show the dentist's actual result, not the product. |
| 7:30–8:30pm | Post in the family and trade circle. Reply to every response within the hour. |
| 8:30–9:00pm | Log numbers in the tracker below. |

**Message shape — result first, product second:**

> "Fixed [dentist]'s Google listing yesterday — first update in 8 months, it's live now. Doing it free for 5 more shops this week. Want yours done? Reply and I'll do it tonight."

**Acceptance test:** 15 or more direct invites sent and two or more group posts live, with every reply answered the same evening.

**If behind, cut to:** the 15 direct one-to-one invites only. Direct beats broadcast every time. Skip the group posts before you skip the DMs.

---

### M4 — Wed 2 – Fri 4 Sep · Fix the blocker, ship the next layer, repeat

Time: 3:00pm onwards each day, ~3h. Same shape all three days:

**Each day:** talk to a user (30 min) → fix the biggest blocker (60 min) → ship one layer (60 min) → deploy and log numbers (30 min). **Deploy every single day.**

**Layer order — do not reorder to chase something shinier:**

| Day | Layer | Acceptance test | If behind, cut to |
|---|---|---|---|
| **Wed 2 Sep** | **AI review replies** — draft and publish replies to unanswered reviews | One real review on a real profile has a published reply | Drafts only; owner copies and pastes |
| **Thu 3 Sep** | **Review collection** — link and QR the owner shares after service | One real new review arrives through your link | Link only, no QR |
| **Fri 4 Sep** | **Service pages** — an AI-written page per service and locality, on Vercel | One live page for one real business | One page, one business, hardcoded |

**Parallel track — WhatsApp and Instagram (Wed–Fri, background only):**

Applications went in on Saturday. Check status daily; do not block on them.

- If WhatsApp approval lands by Thursday: ship *inbound only* — auto-reply to enquiries with his real prices. Skip outbound offers; templates and cost approvals will not clear in time.
- If Instagram approval lands: cross-post the Google post to Instagram. One-way, one direction, no more.
- **Hard rule: neither may consume a slot reserved for the layer table above.** They are extra credit. If either starts eating the core build, drop it and say so in the demo.

**Revenue attempt — Thu 3 Sep, 8:00pm (do not skip this):**

Ask three users for Rs 500/month. Send a payment link. One rupee collected outranks any feature. If all three say no, that is a finding worth reporting honestly on Saturday.

**If badly behind by Thursday:** stop shipping layers entirely. Spend Friday getting more real businesses onto the flow you already have. Six businesses on one working feature beats one business on four half-features.

---

### M5 — Sat 5 Sep · Verify, capture, submit

**Morning is reserved for submission. No building. This is a hard rule.**

| Time | Task |
|---|---|
| 8:00–8:45am | **Verify.** Open the live URL on your phone, logged out, on mobile data. Run the full flow as a stranger. Fix only what is outright broken. |
| 8:45–9:15am | **Screenshot every number.** Convex dashboard, each connected profile, published posts, published review replies, new reviews, any payment. Timestamp them. Save to `/evidence` in the repo. |
| 9:15–9:45am | **Repo.** README with what it is, who it is for, the numbers, and how to run it. Confirm the repo is public. Final push. |
| 9:45–10:30am | **Numbers page.** One page or one slide. Proxy numbers as evidence, north star as the claim. State plainly what is not yet proven. |
| 10:30–11:00am | **Submit.** Live URL, public repo, numbers. Buffer built in. |
| 11:00am | Submitted. |
| 11:00am–2:00pm | Rehearse the demo out loud three times. Time it. |
| 3:00pm | Demo. |

**Acceptance test:** submitted before 11:00 AM IST with all three artifacts, and every number on the page has a timestamped screenshot behind it.

**If behind:** submit whatever works at 10:45. A partly working live product submitted on time beats a better one submitted late. **Late is zero.**

---

## 5. Saturday numbers — fill daily, never reconstruct

Log at the end of each day. Numbers reconstructed on Saturday are guesses, and it shows.

| Metric | Sun | Mon | Tue | Wed | Thu | Fri | Sat |
|---|---|---|---|---|---|---|---|
| Businesses signed up | | | | | | | |
| **Google profiles connected** | | | | | | | |
| **Posts published live** | | | | | | | |
| Review replies published | | | | | | | |
| New reviews collected | | | | | | | |
| Service pages live | | | | | | | |
| People who used it unaided | | | | | | | |
| **Rupees collected** | | | | | | | |

**Headline for the demo:** businesses connected and posts published live. Those are undeniable.

**Say out loud in the demo:** "Ranking takes weeks. Here is what we shipped in six days, and here is the profile that had not been touched in eight months."

---

## 6. What v1 does NOT do

Say no to all of this. If you build one of them, you cut something from the layer table to pay for it.

- No dashboard, no charts, no analytics screens
- No audit-and-advice output — **we publish, we do not recommend**
- No multi-user accounts, teams, or roles
- No billing system (a payment link is not a billing system — a link is fine)
- No onboarding wizard, no tour, no tooltips
- No Instagram content calendar
- No outbound WhatsApp campaigns (templates and costs will not clear this week)
- No custom branding, no logo work, no landing page polish before M1 ships
- No competitor's feature you see on Wednesday

**Non-goals for the product overall:** not a social scheduler, not a CRM, not a website builder, not a full agency replacement. That last one is the pitch, not the week.

---

## 7. Parking lot

Every idea that arrives mid-build goes here immediately and is not discussed again until Sunday 6 Sep. Writing it down is how you stop thinking about it.

| Date | Idea | Who asked | Revisit |
|---|---|---|---|
| | | | |
| | | | |
| | | | |

---

## 8. Daily log

| Day | Plan A or B | What shipped | Biggest blocker found | Deployed? |
|---|---|---|---|---|
| Sat 29 | | | | |
| Sun 30 | | | | |
| Mon 31 | | | | |
| Tue 1 | | | | |
| Wed 2 | | | | |
| Thu 3 | | | | |
| Fri 4 | | | | |
| Sat 5 | | | | |

---

## 8.5 Pipeline reference

Laptop → GitHub → Vercel → user. Set up once on Saturday, then it runs itself all week.

**Every push after setup:**

```
git add . && git commit -m "what changed" && git push
```

Or say: *"I like where we're at. Commit and push."*

**When something breaks — one line, do not open a dashboard:**

| Problem | Say this |
|---|---|
| Build failed | "My Vercel build just failed. Use the Vercel API to pull the latest deployment's build log, find the actual error, and fix it. When you're confident the fix will build, push it." |
| Push rejected | "My push was rejected. Pull the latest and push my work." |
| Env var missing | "The build log says an env var is missing. Add it to Vercel via the API." |
| Live site 500s | "My live site is showing an error. Pull the Vercel runtime logs and fix whatever broke." |
| Deploy stuck | "My deploy has been pending 10 minutes. Check status via the API and redeploy if needed." |

**The rule this enforces:** M4 says deploy every day. That is only cheap because M0 set the pipeline up. If you find yourself doing anything manual to deploy after Saturday, the pipeline is not finished — fix it before you build anything else.

---

## 9. Rules for the week

1. **Deployed every day.** An undeployed day did not happen.
2. **One ugly complete loop beats four elegant half-features.**
3. **Watch, do not explain.** If you have to explain it, it is broken.
4. **A stranger using it beats ten more hours of polish. Someone paying beats both.**
5. **Failed acceptance test at the day's end time → take the fallback, move on.** No carry-over.
6. **New idea → Parking Lot. Not the build.**
7. **Saturday morning is submission, not building.**

---

## 10. Next single action

> **Right now: send two WhatsApp messages to the dentist.**
>
> 1. "Can you open your Google Business listing right now? Send me a screenshot."
> 2. "If I could fix your listing so people actually find you on Google, would you give me access this week?"
>
> Then send the same two to the tile shop and the mattress shop.
> Then start the 60-minute API spike while you wait for replies.
>
> Do not open the editor until T1, T2 and T3 are done.
