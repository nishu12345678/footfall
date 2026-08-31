import type { Metadata } from "next";
import { COMPANY, ADDRESS_LINE } from "@/lib/company";
import {
  LegalPage,
  Section,
  P,
  UL,
  LI,
  Callout,
  Term,
  A,
} from "@/components/legal";

export const metadata: Metadata = {
  title: "Terms and Conditions — footfall",
  description:
    "The agreement between you and Doubt Buddy Education Technology Private Limited for the use of footfall.",
  alternates: { canonical: "/terms" },
};

export default function Terms() {
  return (
    <LegalPage
      title="Terms and Conditions"
      updated={COMPANY.updated}
      intro="These terms are the agreement between you and the company that operates footfall. By creating an account or connecting your Google Business Profile, you accept them. If you do not accept them, please do not use the service."
    >
      <Section n={1} title="Who you are contracting with">
        <P>
          footfall is owned and operated by <Term>{COMPANY.legalName}</Term>,
          registered in India at {ADDRESS_LINE}, GSTIN {COMPANY.gst}.
        </P>
        <P>
          In these terms, &ldquo;we&rdquo;, &ldquo;us&rdquo; and
          &ldquo;footfall&rdquo; mean that company and the service it provides
          at{" "}
          <A href={COMPANY.site}>footfall.zone</A>. &ldquo;You&rdquo; means the
          person or business using it.
        </P>
      </Section>

      <Section n={2} title="Who may use footfall">
        <P>
          You must be at least 18 and legally able to enter a contract. You must
          be the owner of the business whose listing you connect, or a person
          that owner has authorised to act for them. If you are agreeing on
          behalf of a company, you confirm you have authority to bind it.
        </P>
      </Section>

      <Section n={3} title="Your account">
        <UL>
          <LI>
            You are responsible for what happens on your account. Keep your
            phone, email and Google sign-in secure.
          </LI>
          <LI>
            Give us true and current information. We are not responsible for
            work done on the basis of details you gave us wrongly.
          </LI>
          <LI>
            Tell us immediately at{" "}
            <A href={`mailto:${COMPANY.email}`}>{COMPANY.email}</A> if you think
            someone else has got into your account.
          </LI>
          <LI>One account per business listing, unless we agree otherwise.</LI>
        </UL>
      </Section>

      <Section n={4} title="What footfall does, and what it does not promise">
        <P>
          footfall publishes to your Google Business Profile on your behalf:
          posts, photos, service and category information, and replies to
          reviews. It also researches search terms, tracks your position in
          Google&rsquo;s local results, and reports what changed.
        </P>
        <Callout>
          <p>
            <Term>We do not guarantee any ranking, position, or result.</Term>{" "}
            Google decides what ranks and where, using signals we do not control
            &mdash; the distance between the searcher and your shop above all.
            Anyone who promises you a position on Google is not telling you the
            truth. footfall does the work that is known to help; it cannot
            promise the outcome.
          </p>
        </Callout>
        <P>
          We also do not control Google. If Google changes its APIs, its
          policies or its ranking behaviour, or suspends your listing, features
          of footfall may change or stop working. We will tell you when we know.
        </P>
      </Section>

      <Section n={5} title="Connecting your Google Business Profile">
        <UL>
          <LI>
            You authorise footfall to act on your listing on your behalf, within
            the permission Google&rsquo;s consent screen describes.
          </LI>
          <LI>
            You confirm you have the right to grant that access for the business
            in question.
          </LI>
          <LI>
            You can withdraw the permission at any time, from inside footfall or
            from your Google account. We stop working on the listing as soon as
            you do.
          </LI>
          <LI>
            You remain bound by Google&rsquo;s own terms for your Business
            Profile, including its content and review policies.
          </LI>
        </UL>
        <P>
          What footfall does with the data it receives is set out in our{" "}
          <A href="/privacy">Privacy Policy</A>, which forms part of these
          terms.
        </P>
      </Section>

      <Section n={6} title="Content, and who owns it">
        <UL>
          <LI>
            <Term>Your content stays yours.</Term> Your business details,
            photos, videos, and everything footfall publishes to your listing
            belong to you.
          </LI>
          <LI>
            You grant us a limited licence to store, adapt and publish that
            content for the sole purpose of running the service for you. The
            licence ends when you delete your account.
          </LI>
          <LI>
            You confirm you own or have the right to use every photo and video
            you upload, and that publishing it breaks nobody else&rsquo;s
            rights.
          </LI>
          <LI>
            <Term>footfall drafts; you remain responsible.</Term> Text and
            images are generated by AI. You are responsible for what appears
            under your business name, and you can edit, approve or stop anything
            before or after it publishes.
          </LI>
        </UL>
      </Section>

      <Section n={7} title="Review replies">
        <P>
          footfall drafts replies to reviews and, where you have left automatic
          replies switched on, publishes replies to positive reviews without
          waiting for you. Reviews that are critical, or that raise a complaint
          needing a person, are held for you to read and send yourself.
        </P>
        <P>
          You may turn automatic replies off at any time. Replies are published
          in your business&rsquo;s name and you remain responsible for them, so
          we recommend reading them.
        </P>
      </Section>

      <Section n={8} title="Fees and payment">
        <P>
          Where a paid plan applies, the price, billing period and what is
          included are shown to you before you subscribe. Fees are stated in
          Indian rupees and exclude taxes unless we say otherwise; GST is
          charged where applicable.
        </P>
        <UL>
          <LI>
            Subscriptions renew automatically for the same period until you
            cancel.
          </LI>
          <LI>
            You may cancel at any time. Cancellation takes effect at the end of
            the period you have already paid for.
          </LI>
          <LI>
            Fees already paid are not refundable except where Indian law
            requires it, or where we have failed to provide the service and
            cannot put it right.
          </LI>
          <LI>
            We may change prices with at least 30 days&rsquo; notice. The new
            price applies from your next renewal.
          </LI>
        </UL>
      </Section>

      <Section n={9} title="What you must not do">
        <UL>
          <LI>
            Use footfall for a business you do not own or are not authorised to
            act for.
          </LI>
          <LI>
            Publish anything false, misleading, unlawful, obscene, hateful, or
            infringing someone else&rsquo;s rights.
          </LI>
          <LI>
            Use footfall to post fake reviews, or to interfere with anyone
            else&rsquo;s listing or reviews.
          </LI>
          <LI>
            Reverse engineer, decompile, scrape, or copy the service, or try to
            get at data that is not yours.
          </LI>
          <LI>
            Resell, sublicense or make footfall available to a third party
            without our written agreement.
          </LI>
          <LI>
            Attack, overload or probe the service, or get around its security or
            usage limits.
          </LI>
          <LI>Use footfall to build or train a competing product.</LI>
        </UL>
      </Section>

      <Section n={10} title="Suspension and termination">
        <P>
          We may suspend or close your account if you break these terms, if we
          are required to by law or by Google, if payment fails, or if your use
          puts the service or other users at risk. Where it is reasonable to do
          so, we will warn you first and give you a chance to put it right.
        </P>
        <P>
          You may close your account at any time by writing to{" "}
          <A href={`mailto:${COMPANY.email}`}>{COMPANY.email}</A>. On closure we
          stop all work on your listing and delete your data as described in
          section 8 of the Privacy Policy. What we already published to your
          listing remains on it, because it is yours.
        </P>
      </Section>

      <Section n={11} title="Our intellectual property">
        <P>
          The footfall software, design, brand and everything in the service
          other than your own content belongs to us. Using footfall gives you a
          personal, non-exclusive, non-transferable right to use it for your own
          business while your account is open. Nothing more transfers to you.
        </P>
      </Section>

      <Section n={12} title="Third-party services">
        <P>
          footfall depends on services run by others &mdash; Google above all,
          and the providers listed in the Privacy Policy. We are not responsible
          for their availability, their acts or their omissions, and your use of
          them may be governed by their own terms.
        </P>
      </Section>

      <Section n={13} title="Service availability">
        <P>
          We aim to keep footfall running but do not promise it will be
          uninterrupted or error free. We may take it down for maintenance,
          change features, or withdraw features, and we will give notice where
          we reasonably can.
        </P>
      </Section>

      <Section n={14} title="Disclaimers">
        <P>
          To the fullest extent the law allows, footfall is provided &ldquo;as
          is&rdquo; and &ldquo;as available&rdquo;, without warranties of any
          kind, whether express or implied, including any warranty of
          merchantability, fitness for a particular purpose, or non-infringement
          &mdash; and, for the avoidance of doubt, without any warranty as to
          search ranking, traffic, enquiries or revenue.
        </P>
      </Section>

      <Section n={15} title="Limitation of liability">
        <P>
          To the fullest extent the law allows, we are not liable for indirect,
          incidental, special, punitive or consequential loss, nor for lost
          profits, lost business, lost goodwill or lost data, however caused.
        </P>
        <P>
          Our total liability to you for all claims in any twelve-month period
          is limited to the amount you actually paid us for footfall in that
          period, or two thousand rupees if you paid us nothing.
        </P>
        <P>
          Nothing in these terms excludes liability that cannot be excluded
          under Indian law, including liability for fraud or for death or
          personal injury caused by negligence.
        </P>
      </Section>

      <Section n={16} title="Indemnity">
        <P>
          You agree to indemnify us against claims, losses and reasonable legal
          costs arising from your breach of these terms, from content you
          provided or approved, or from your use of footfall in a way these
          terms do not permit.
        </P>
      </Section>

      <Section n={17} title="Changes to these terms">
        <P>
          We may update these terms. If a change materially affects you we will
          give notice by email or in the product before it takes effect.
          Continuing to use footfall after that date means you accept the new
          terms. If you do not, you may close your account.
        </P>
      </Section>

      <Section n={18} title="Governing law and disputes">
        <P>
          These terms are governed by the laws of India. The courts at{" "}
          {COMPANY.jurisdiction} have exclusive jurisdiction over any dispute.
          Before going to court, please write to us &mdash; most things are
          quicker to settle by email.
        </P>
      </Section>

      <Section n={19} title="General">
        <UL>
          <LI>
            If any part of these terms is found unenforceable, the rest still
            stands.
          </LI>
          <LI>
            Not enforcing a term on one occasion does not waive it for the
            future.
          </LI>
          <LI>
            You may not transfer your rights under these terms without our
            consent. We may transfer ours as part of a merger, acquisition or
            sale of the business.
          </LI>
          <LI>
            We are not liable for failures caused by events beyond our
            reasonable control.
          </LI>
          <LI>
            These terms, together with the Privacy Policy, are the whole
            agreement between us.
          </LI>
        </UL>
      </Section>

      <Section n={20} title="Contact us">
        <UL>
          <LI>{COMPANY.legalName}</LI>
          <LI>{ADDRESS_LINE}</LI>
          <LI>
            <A href={`mailto:${COMPANY.email}`}>{COMPANY.email}</A>
          </LI>
          <LI>
            <A href={`tel:${COMPANY.phoneHref}`}>{COMPANY.phone}</A>
          </LI>
          <LI>
            Founder:{" "}
            <A href={COMPANY.founder.linkedin}>{COMPANY.founder.name}</A>
          </LI>
        </UL>
      </Section>
    </LegalPage>
  );
}
