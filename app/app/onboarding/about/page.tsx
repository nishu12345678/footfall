"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { Steps } from "@/components/steps";

type Tab = "offerings" | "specialties";

const COPY = {
  offerings: {
    tab: "Offerings",
    heading: "what do you sell?",
    sub: "Add what customers come to you for. We use these in your posts and your keywords.",
    placeholder: "e.g. Floor Tiles",
  },
  specialties: {
    tab: "About Business",
    heading: "what are you best known for?",
    sub: "The thing regulars would tell a friend. This is what we lean on when we write about you.",
    placeholder: "e.g. Premium Marble Collection",
  },
} as const;

export default function AboutPage() {
  const data = useQuery(api.about.list);
  const add = useMutation(api.about.add);
  const remove = useMutation(api.about.remove);
  const complete = useMutation(api.about.complete);
  const suggest = useAction(api.about.suggest);

  const [tab, setTab] = useState<Tab>("offerings");
  const [draft, setDraft] = useState("");
  const [suggestions, setSuggestions] = useState<Record<Tab, string[]>>({
    offerings: [],
    specialties: [],
  });
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (data === undefined) {
    return (
      <main className="grid min-h-screen place-items-center px-6">
        <p className="font-mono text-[12px] text-muted">loading…</p>
      </main>
    );
  }

  if (data === null) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6">
        <h1 className="text-[1.8rem]">connect google first</h1>
        <a href="/app/connect" className="btn btn-primary mt-6 w-full">
          connect google
        </a>
      </main>
    );
  }

  const copy = COPY[tab];
  const chosen = tab === "offerings" ? data.offerings : data.specialties;
  const ideas = suggestions[tab];

  async function addLabel(label: string, source: string) {
    setError(null);
    try {
      await add({ kind: tab, label, source });
      setSuggestions((s) => ({
        ...s,
        [tab]: s[tab].filter((i) => i.toLowerCase() !== label.toLowerCase()),
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function getSuggestions() {
    setThinking(true);
    setError(null);
    try {
      const items = await suggest({ kind: tab });
      setSuggestions((s) => ({ ...s, [tab]: items }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setThinking(false);
    }
  }

  async function next() {
    if (tab === "offerings") {
      setTab("specialties");
      setDraft("");
      return;
    }
    await complete({});
    window.location.href = "/app/onboarding/gbp";
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-6 py-10">
      <Steps current={3} />

      <div className="mt-7 grid grid-cols-2 border-b border-rule">
        {(["offerings", "specialties"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setTab(t);
              setDraft("");
            }}
            className={`-mb-px border-b-2 pb-2.5 font-display text-[14px] font-semibold transition-colors ${
              tab === t
                ? "border-pin text-pin"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {COPY[t].tab}
          </button>
        ))}
      </div>

      <div className="mt-7 flex-1">
        <h1 className="text-[1.75rem]">{copy.heading}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
          {copy.sub}
        </p>

        <form
          className="mt-6 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!draft.trim()) return;
            void addLabel(draft, "user");
            setDraft("");
          }}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={copy.placeholder}
            className="min-w-0 flex-1 rounded-[12px] border border-ink bg-paper-2 px-3.5 py-3 text-[15px] outline-none placeholder:text-muted/50"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className="btn btn-primary btn-sm flex-none disabled:opacity-40"
          >
            add
          </button>
        </form>

        {chosen.length > 0 ? (
          <>
            <p className="eyebrow mt-7">selected</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {chosen.map((row) => (
                <li key={row._id}>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-pin bg-pin-soft py-1.5 pl-3 pr-1.5 text-[13px]">
                    {row.label}
                    <button
                      type="button"
                      onClick={() => void remove({ kind: tab, id: row._id })}
                      aria-label={`remove ${row.label}`}
                      className="grid h-4 w-4 place-items-center rounded-full text-pin hover:bg-pin hover:text-paper-2"
                    >
                      ×
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : null}

        <div className="mt-8 rounded-[14px] border border-ink bg-paper-2 p-4 shadow-[3px_3px_0_var(--color-ink)]">
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-1.5 font-display text-[14px] font-bold">
              <span aria-hidden className="text-pin">
                ✦
              </span>
              AI suggested
            </p>
            <button
              type="button"
              onClick={() => void getSuggestions()}
              disabled={thinking}
              className="font-mono text-[11px] underline underline-offset-4 hover:text-pin disabled:opacity-50"
            >
              {thinking
                ? "thinking…"
                : ideas.length
                  ? "suggest more"
                  : "suggest for me"}
            </button>
          </div>

          {ideas.length ? (
            <ul className="mt-3 flex flex-wrap gap-2">
              {ideas.map((idea) => (
                <li key={idea}>
                  <button
                    type="button"
                    onClick={() => void addLabel(idea, "ai")}
                    className="inline-flex items-center gap-1.5 rounded-full border border-rule bg-paper py-1.5 pl-2.5 pr-3 text-[13px] transition-colors hover:border-ink"
                  >
                    <span aria-hidden className="text-pin">
                      +
                    </span>
                    {idea}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-[13px] leading-relaxed text-muted">
              We&rsquo;ll read your listing
              {data.business.website ? " and your website" : ""} and suggest
              what to add.
            </p>
          )}
        </div>

        {error ? (
          <p
            role="alert"
            className="mt-5 rounded-[12px] border border-pin bg-pin-soft px-4 py-3 text-[14px] leading-snug"
          >
            {error}
          </p>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => void next()}
        disabled={chosen.length === 0}
        className="btn btn-primary mt-8 w-full disabled:cursor-not-allowed disabled:opacity-40"
      >
        {tab === "offerings" ? "save info & next" : "save & next"}
      </button>
    </main>
  );
}
