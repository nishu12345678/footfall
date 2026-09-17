import { Steps } from "@/components/steps";
import { BackButton } from "@/components/back-button";

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
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col px-6 py-8 sm:py-12">
      <BackButton fallback="/app/report" className="-ml-2 mb-4" />
      <Steps current={1} />

      <div className="mt-10 flex flex-1 flex-col justify-center">
        <h1 className="text-[clamp(1.9rem,7vw,2.5rem)]">
          Connect your Google listing
        </h1>
        <p className="mt-4 text-[16px] leading-relaxed text-ink-soft">
          This is the profile people see when they search for you nearby. Once
          it&rsquo;s connected we can post to it, reply to your reviews, and fix
          what&rsquo;s wrong on it — without you doing anything else.
        </p>

        <ul className="mt-8 space-y-3.5 border-t border-rule pt-6">
          {[
            "You sign in to Google yourself — we never see your password",
            "You can remove our access from your Google account any time",
            "Takes about 40 seconds",
          ].map((line) => (
            <li
              key={line}
              className="flex items-start gap-2.5 text-[14px] leading-snug text-ink-soft"
            >
              <span aria-hidden className="mt-0.5 flex-none text-open-deep">
                ✓
              </span>
              {line}
            </li>
          ))}
        </ul>

        {error ? (
          <p
            role="alert"
            className="mt-6 rounded-[12px] bg-pin-soft px-4 py-3 text-[14px] leading-snug"
          >
            {error}
          </p>
        ) : null}

        <a href="/api/google/start" className="btn btn-primary mt-10 w-full">
          <span aria-hidden>◎</span> Connect Google Business Profile
        </a>

        <p className="mt-5 text-center text-[12px] leading-relaxed text-muted">
          You&rsquo;ll be asked to allow us to manage your business listings.
          That permission is what lets us do the work.
        </p>
      </div>
    </main>
  );
}
