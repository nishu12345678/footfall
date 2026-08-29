import { Steps } from "@/components/steps";

/**
 * Step 1 of onboarding — the one thing the owner has to do themselves.
 * No interactivity beyond a link, so this stays a server component.
 */
export default async function ConnectPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-6 py-10">
      <Steps current={1} />

      <div className="mt-10 flex flex-1 flex-col justify-center">
        <h1 className="text-[clamp(1.9rem,7vw,2.5rem)]">
          connect your google listing
        </h1>
        <p className="mt-4 text-[16px] leading-relaxed text-ink-soft">
          This is the profile people see when they search for you nearby. Once
          it&rsquo;s connected we can post to it, reply to your reviews, and fix
          what&rsquo;s wrong on it — without you doing anything else.
        </p>

        <ul className="mt-6 space-y-2.5 border-t border-rule pt-5">
          {[
            "you sign in to Google yourself — we never see your password",
            "you can remove our access from your Google account any time",
            "takes about 40 seconds",
          ].map((line) => (
            <li
              key={line}
              className="flex items-start gap-2.5 text-[14px] leading-snug text-ink-soft"
            >
              <span aria-hidden className="mt-0.5 flex-none text-open">
                ✓
              </span>
              {line}
            </li>
          ))}
        </ul>

        {error ? (
          <p
            role="alert"
            className="mt-6 rounded-[12px] border border-pin bg-pin-soft px-4 py-3 text-[14px] leading-snug"
          >
            {error}
          </p>
        ) : null}

        <a href="/api/google/start" className="btn btn-primary mt-8 w-full">
          <span aria-hidden>◎</span> connect google business profile
        </a>

        <p className="mt-4 text-center font-mono text-[11px] leading-relaxed text-muted">
          you&rsquo;ll be asked to allow us to manage your business listings.
          that permission is what lets us do the work.
        </p>
      </div>
    </main>
  );
}
