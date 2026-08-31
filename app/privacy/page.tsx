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
  title: "Privacy Policy — footfall",
  description:
    "How footfall collects, uses, stores and deletes your information, including the Google Business Profile data you connect.",
  alternates: { canonical: "/privacy" },
};

export default function Privacy() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated={COMPANY.updated}
      intro="This policy explains what footfall collects, why, who else sees it, how long we keep it, and how you get it deleted. Section 4 covers the Google Business Profile data specifically, because that is the part most people want to read first."
    >
      <Section n={1} title="Who we are">
        <P>
          footfall is operated by <Term>{COMPANY.legalName}</Term>, a company
          incorporated in India.
        </P>
        <UL>
          <LI>Registered address: {ADDRESS_LINE}</LI>
          <LI>GSTIN: {COMPANY.gst}</LI>
          <LI>
            Email: <A href={`mailto:${COMPANY.email}`}>{COMPANY.email}</A>
          </LI>
          <LI>
            Phone: <A href={`tel:${COMPANY.phoneHref}`}>{COMPANY.phone}</A>
          </LI>
        </UL>
        <P>
          &ldquo;We&rdquo;, &ldquo;us&rdquo; and &ldquo;our&rdquo; mean that
          company. &ldquo;You&rdquo; means the person using footfall, normally
          the owner of a local business or someone they have authorised.
        </P>
      </Section>

      <Section n={2} title="What footfall does, in one paragraph">
        <P>
          footfall connects to your Google Business Profile and works on it for
          you: it researches the terms people near you actually search, writes
          and publishes posts, publishes photos, keeps your services and
          categories accurate, drafts replies to your reviews, and reports what
          changed. To do any of that, it needs permission to read and write your
          listing. That permission is yours to give and yours to take back at
          any time.
        </P>
      </Section>

      <Section n={3} title="Information we collect from you">
        <P>We collect only what the product needs to run.</P>
        <UL>
          <LI>
            <Term>Account details.</Term> Your mobile number, or your email
            address, or your Google account name, email address and profile
            picture &mdash; depending on which of the three ways you choose to
            sign in. We use this to know who you are and to let you back in.
          </LI>
          <LI>
            <Term>Business details.</Term> What you tell us during setup: the
            business name, address, service area, trade, the services you offer
            and their prices, and anything you type into the product.
          </LI>
          <LI>
            <Term>Files you upload.</Term> Photos and videos you add so footfall
            can publish them to your listing.
          </LI>
          <LI>
            <Term>Usage and device data.</Term> Ordinary server logs: IP
            address, browser type, pages opened, timestamps, and errors. We use
            these to keep the service up and to find bugs.
          </LI>
        </UL>
        <P>
          We do not collect payment card details. If and when footfall charges
          for a subscription, the payment is handled by a licensed payment
          processor and the card number never reaches our servers.
        </P>
      </Section>

      <Section n={4} title="Google user data we access, and what we do with it">
        <P>
          When you connect your listing, Google shows you a consent screen and
          asks whether footfall may manage your Google Business Profile. If you
          agree, Google gives us an access token for the scope{" "}
          <Term>https://www.googleapis.com/auth/business.manage</Term>. We
          request that one scope and no others for your listing.
        </P>
        <P>Through it, footfall reads:</P>
        <UL>
          <LI>
            your business name, address, phone number, website, opening hours,
            primary and additional categories, service areas and service list;
          </LI>
          <LI>the posts, photos and videos already on the listing;</LI>
          <LI>
            your customer reviews &mdash; the star rating, the text, the
            reviewer&rsquo;s display name and picture as Google supplies them,
            and any existing reply;
          </LI>
          <LI>
            performance figures Google reports for the listing: profile views,
            searches, calls, direction requests and website clicks.
          </LI>
        </UL>
        <P>And through it, footfall writes, on your behalf:</P>
        <UL>
          <LI>new posts, with their text and image;</LI>
          <LI>new photos and videos, taken from the ones you uploaded;</LI>
          <LI>your service list and category information;</LI>
          <LI>replies to your reviews.</LI>
        </UL>
        <Callout>
          <p>
            Every one of those writes is an action footfall takes as you, on the
            listing you own. Nothing is published to any other business&rsquo;s
            listing, and nothing is published anywhere outside your Google
            Business Profile.
          </p>
        </Callout>
        <P>
          If you sign in to footfall with Google, that is a separate and much
          smaller permission: it gives us your name, email address, profile
          picture and Google account ID, purely so we know which account is
          yours. Signing in with Google does not by itself give us access to any
          listing.
        </P>
      </Section>

      <Section n={5} title="Limited Use of Google user data">
        <Callout>
          <p>
            footfall&rsquo;s use and transfer of information received from
            Google APIs to any other app will adhere to the{" "}
            <A href="https://developers.google.com/terms/api-services-user-data-policy">
              Google API Services User Data Policy
            </A>
            , including the Limited Use requirements.
          </p>
        </Callout>
        <P>In plain terms, that commitment means:</P>
        <UL>
          <LI>
            We use your Google data only to provide and improve the features you
            can see in footfall &mdash; the posts, photos, services, review
            replies and reporting described above.
          </LI>
          <LI>
            We do not sell your Google data. We do not use it for advertising,
            and we do not pass it to data brokers, ad networks or resellers.
          </LI>
          <LI>
            We do not use your Google data to train, fine-tune or otherwise
            develop generalised artificial intelligence or machine learning
            models. Where we send your content to an AI provider to draft a post
            or a reply (see section 7), we use accounts configured so that the
            provider does not train on it either.
          </LI>
          <LI>
            No human at our company reads your Google data except where you have
            explicitly asked us for support, where it is necessary for security
            or to comply with the law, or where the data has been aggregated and
            made anonymous for internal operations.
          </LI>
        </UL>
      </Section>

      <Section n={6} title="How we use what we collect">
        <UL>
          <LI>To run the features described in section 2.</LI>
          <LI>
            To decide what to publish and when &mdash; for example, to research
            keywords for your trade and area, and to schedule posts and photos.
          </LI>
          <LI>
            To show you what changed: rankings, views, calls, direction requests
            and reviews over time.
          </LI>
          <LI>
            To contact you about the service &mdash; sign-in codes, and notices
            about something that needs your attention, such as a review we have
            held back for you to read.
          </LI>
          <LI>
            To keep the service secure, prevent abuse, fix faults, and meet our
            legal obligations.
          </LI>
        </UL>
        <P>
          We do not send you marketing messages unless you have asked for them,
          and you can stop them at any time.
        </P>
      </Section>

      <Section n={7} title="Who else sees your information">
        <P>
          We do not sell your information to anyone. We share it only with the
          service providers footfall is built on, and only so far as each of
          them needs it to do its job:
        </P>
        <UL>
          <LI>
            <Term>Google LLC</Term> &mdash; the Business Profile itself.
            Everything footfall publishes goes here.
          </LI>
          <LI>
            <Term>Convex</Term> &mdash; our database and backend, where your
            account and business data are stored.
          </LI>
          <LI>
            <Term>Vercel</Term> &mdash; hosting for the website and application.
          </LI>
          <LI>
            <Term>OpenAI</Term> &mdash; drafts the text of posts and review
            replies and generates images. It receives your business details and
            the review text being replied to. It does not receive your contact
            details, and it does not train on this content.
          </LI>
          <LI>
            <Term>SerpApi, DataForSEO and Firecrawl</Term> &mdash; search data
            providers. They receive search terms and your locality, not your
            personal details.
          </LI>
          <LI>
            <Term>MSG91 and Resend</Term> &mdash; deliver your sign-in code by
            SMS and email respectively.
          </LI>
        </UL>
        <P>
          We may also disclose information where the law requires it, to enforce
          our terms, to protect someone&rsquo;s safety, or as part of a merger
          or acquisition &mdash; in which case we would tell you first and the
          buyer would be bound by this policy.
        </P>
      </Section>

      <Section n={8} title="How long we keep it">
        <UL>
          <LI>
            <Term>While your account is open:</Term> for as long as you keep
            using footfall.
          </LI>
          <LI>
            <Term>After you disconnect Google:</Term> we stop calling Google
            immediately and delete the stored access and refresh tokens.
          </LI>
          <LI>
            <Term>After you delete your account:</Term> we delete your business
            data, uploaded files and Google-derived data within 30 days.
          </LI>
          <LI>
            <Term>Server logs:</Term> up to 90 days.
          </LI>
          <LI>
            <Term>Records we must keep by law</Term> &mdash; tax and accounting
            records, for example &mdash; for as long as Indian law requires,
            regardless of the above.
          </LI>
        </UL>
        <P>
          Anything footfall already published to your Google Business Profile
          stays on your listing, because it belongs to you. Deleting your
          footfall account does not remove posts, photos or replies from Google
          &mdash; you can delete those yourself from your listing.
        </P>
      </Section>

      <Section n={9} title="Disconnecting Google and deleting your data">
        <P>You can cut off our access at any time, in two ways:</P>
        <UL>
          <LI>
            <Term>At Google:</Term> go to{" "}
            <A href="https://myaccount.google.com/permissions">
              myaccount.google.com/permissions
            </A>
            , find footfall, and choose &ldquo;Remove access&rdquo;. This works
            even if you cannot get into footfall.
          </LI>
          <LI>
            <Term>By email:</Term> write to{" "}
            <A href={`mailto:${COMPANY.email}`}>{COMPANY.email}</A> from the
            address on your account and ask us to delete it. We will confirm
            within 7 days and complete the deletion within 30.
          </LI>
        </UL>
      </Section>

      <Section n={10} title="Your rights">
        <P>
          Under India&rsquo;s Digital Personal Data Protection Act, 2023 &mdash;
          and under the GDPR if you are in the UK or the EU &mdash; you may ask
          us to:
        </P>
        <UL>
          <LI>tell you what personal data we hold about you;</LI>
          <LI>give you a copy of it in a portable form;</LI>
          <LI>correct anything that is wrong or out of date;</LI>
          <LI>delete it;</LI>
          <LI>withdraw a consent you previously gave;</LI>
          <LI>nominate someone to exercise these rights if you cannot.</LI>
        </UL>
        <P>
          Write to <A href={`mailto:${COMPANY.email}`}>{COMPANY.email}</A>. We
          answer within 30 days. If you are not satisfied, you may complain to
          the Data Protection Board of India.
        </P>
      </Section>

      <Section n={11} title="How we protect your information">
        <P>
          Traffic to and from footfall is encrypted with HTTPS. Google access
          tokens are held server-side and are never exposed to the browser.
          Access to production systems is limited to people who need it.
        </P>
        <P>
          No system is perfectly secure, and we will not pretend otherwise. If a
          breach affects your personal data, we will notify you and the Data
          Protection Board of India as the law requires, and tell you what
          happened and what to do about it.
        </P>
      </Section>

      <Section n={12} title="Where your information is stored">
        <P>
          footfall&rsquo;s providers operate data centres in India, the United
          States and the European Union, so your information may be processed
          outside India. Where that happens we rely on the provider&rsquo;s
          contractual safeguards, including standard contractual clauses where
          they apply.
        </P>
      </Section>

      <Section n={13} title="Cookies">
        <P>
          We use a small number of cookies, all of them necessary: one to keep
          you signed in, and one to remember your preferences. We do not use
          advertising cookies and we do not run third-party trackers on the
          product. You can clear cookies in your browser, but you will be signed
          out.
        </P>
      </Section>

      <Section n={14} title="Children">
        <P>
          footfall is a tool for businesses and is not intended for anyone under
          18. We do not knowingly collect data from children. If you believe a
          child has given us information, write to us and we will delete it.
        </P>
      </Section>

      <Section n={15} title="Changes to this policy">
        <P>
          If we change how we handle your data we will update this page and
          change the date at the top. If the change is significant &mdash; a new
          purpose for your Google data, for instance &mdash; we will tell you
          and, where the law requires it, ask for your consent again before the
          new use begins.
        </P>
      </Section>

      <Section n={16} title="Contact us">
        <P>
          For anything about this policy, or to exercise a right under section
          10, contact our Grievance Officer:
        </P>
        <UL>
          <LI>{COMPANY.grievanceOfficer}, Grievance Officer</LI>
          <LI>{COMPANY.legalName}</LI>
          <LI>{ADDRESS_LINE}</LI>
          <LI>
            <A href={`mailto:${COMPANY.email}`}>{COMPANY.email}</A>
          </LI>
          <LI>
            <A href={`tel:${COMPANY.phoneHref}`}>{COMPANY.phone}</A>
          </LI>
        </UL>
        <P>
          We acknowledge every complaint within 7 days and aim to resolve it
          within 30.
        </P>
      </Section>
    </LegalPage>
  );
}
