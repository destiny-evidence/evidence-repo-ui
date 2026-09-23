import { ExternalLink } from "@/components/common/ExternalLink";
import "./PrivacyPage.css";

// A committed constant, not a build-time value: a legal document's stated date
// must not move every time the site is redeployed.
const EFFECTIVE_DATE = "1 October 2026";

const PRIVACY_EMAIL = "privacy@futureevidence.org";

const LEGAL_BASES: [purpose: string, data: string, basis: string][] = [
  [
    "Providing and maintaining accounts/access",
    "Account data",
    "Performance of a contract",
  ],
  [
    "Product improvement and analytics",
    "Usage/analytics data",
    "Legitimate interests",
  ],
  [
    "Responding to feedback and improving features",
    "Feedback form data",
    "Legitimate interests",
  ],
  [
    "Security, fraud prevention, abuse monitoring",
    "Account and usage data",
    "Legitimate interests",
  ],
  [
    "Communicating service updates",
    "Account data (email)",
    "Performance of a contract / legitimate interests",
  ],
  ["Complying with legal obligations", "Account data", "Legal obligation"],
];

function PrivacyEmail() {
  return <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>;
}

interface PrivacyPageProps {
  path?: string;
}

export function PrivacyPage(_props: PrivacyPageProps) {
  return (
    <article class="privacy-page">
      <h1 class="privacy-page__title">Privacy Policy</h1>
      <p class="privacy-page__dates">
        Effective date: {EFFECTIVE_DATE} · Last updated: {EFFECTIVE_DATE}
      </p>

      <p>
        Veritas Health Innovation Ltd (ABN 41 600 366 274) ("we", "us") operates
        evidence repository platforms, collectively the "Services" - that help
        technical advisors discover and use trustworthy evidence. This Privacy
        Policy explains what personal data we collect, why, and the rights users
        have over it.
      </p>
      <p>
        This policy applies to all Veritas Health Innovation services, unless a
        product states otherwise.
      </p>

      <h2>1. Who we are</h2>
      <p>
        Veritas Health Innovation Ltd is the data controller for personal data
        processed through the Services.
      </p>
      <p>You can confidentially contact our Privacy Officer at:</p>
      <address class="privacy-page__address">
        The Privacy Officer
        <br />
        Veritas Health Innovation Ltd
        <br />
        Level 5, 485 Latrobe Street, Melbourne 3000 Australia
        <br />
        Email: <PrivacyEmail />
        <br />
        Website:{" "}
        <ExternalLink
          class="privacy-page__external-link"
          href="https://www.futureevidence.org"
        >
          www.futureevidence.org
        </ExternalLink>
      </address>

      <h2>2. What data we collect</h2>

      <h3>2.1 Account data</h3>
      <p>When someone registers or is provisioned an account, we collect:</p>
      <ul>
        <li>Name and email address</li>
        <li>Login credentials (password stored as a hash, or SSO identifier)</li>
      </ul>

      <h3>2.2 Usage and analytics data</h3>
      <p>
        To understand how the Services are used and improve them, we collect:
      </p>
      <ul>
        <li>Pages and features accessed, search queries, clicks</li>
        <li>Session duration, timestamps, and frequency of use</li>
        <li>Device, browser type and geolocation</li>
        <li>Referring/exit pages</li>
      </ul>
      <p>
        We use this data in aggregate and at an individual level for product
        analytics; see Section 4.
      </p>

      <h3>2.3 Feedback form data</h3>
      <p>
        Where a user chooses to submit feedback on features through an
        in-product form, we collect their name and email address along with the
        feedback content. We use this to follow up on feedback and to inform
        product improvements. We may use third-party form providers, such as
        Google Forms, to collect and store this information.
      </p>

      <h3>2.4 Data we do not currently collect</h3>
      <p>
        The Services do not currently collect special category data (e.g.
        health, ethnicity) about account holders, nor do they knowingly collect
        data about children. If a specific repository begins collecting
        additional categories of data (e.g. uploaded documents containing
        personal data), this policy will be updated and users notified.
      </p>

      <h2>3. How we collect data</h2>
      <ul>
        <li>Directly from the user (account registration, forms)</li>
        <li>
          Automatically through use of the Services (analytics tools, cookies,
          log files)
        </li>
        <li>
          From a partner or funder, where the user's organisation has requested
          an account be provisioned on their behalf
        </li>
      </ul>

      <h2>4. Why we use this data (purposes and legal basis)</h2>
      <div class="privacy-page__table-scroll">
        <table class="privacy-page__table">
          <thead>
            <tr>
              <th scope="col">Purpose</th>
              <th scope="col">Data used</th>
              <th scope="col">Legal basis (GDPR)</th>
            </tr>
          </thead>
          <tbody>
            {LEGAL_BASES.map(([purpose, data, basis]) => (
              <tr key={purpose}>
                <td>{purpose}</td>
                <td>{data}</td>
                <td>{basis}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        Where we rely on legitimate interests, we've considered that this
        processing is proportionate and expected by users of a professional
        platform, and does not override user rights.
      </p>

      <h2>5. Who we share data with</h2>
      <p>We share personal data only as needed to operate the Services:</p>
      <ul>
        <li>Hosting and infrastructure providers</li>
        <li>Analytics providers</li>
        <li>AI providers (for AI summaries)</li>
        <li>Funders and partner organisations</li>
        <li>Legal/regulatory bodies</li>
      </ul>
      <p>
        We do not sell personal data. All third parties processing data on our
        behalf are bound by data processing agreements requiring
        GDPR-equivalent protections.
      </p>

      <h2>6. International data transfers</h2>
      <p>
        Where personal data is transferred outside the UK/EEA, we rely on
        appropriate safeguards such as Standard Contractual Clauses or adequacy
        decisions.
      </p>

      <h2>7. Data retention</h2>
      <p>
        We will only retain your data for as long as we need it to fulfil our
        purposes, including any relating to legal, accounting, or reporting
        requirements.
      </p>

      <h2>8. User rights (GDPR)</h2>
      <p>Users have the right to:</p>
      <ul>
        <li>Access the personal data we hold about them</li>
        <li>Correct inaccurate data</li>
        <li>
          Request deletion ("right to be forgotten"), subject to
          legal/contractual limits
        </li>
        <li>Restrict or object to certain processing</li>
        <li>Receive their data in a portable format</li>
        <li>Withdraw consent, where processing is based on consent</li>
        <li>
          Lodge a complaint with a supervisory authority (e.g. the ICO in the
          UK, or their local EU data protection authority)
        </li>
      </ul>
      <p>
        To exercise these rights, contact <PrivacyEmail />.
      </p>

      <h2>9. Cookies and similar technologies</h2>
      <p>
        We use cookies to operate the Services. Currently, we only use strictly
        necessary session cookies, which enable core functionality such as
        keeping you logged in during your visit. These cookies expire once you
        close your web browser and do not persist on your device.
      </p>
      <p>
        Our analytics are configured to be cookieless. We do not use persistent
        cookies, tracking cookies, or third-party advertising cookies.
      </p>
      <p>
        If this changes in the future, we will update this policy to reflect the
        cookies in use and, where required, seek your consent.
      </p>

      <h2>10. Security</h2>
      <p>
        We apply appropriate technical and organisational measures (e.g.
        encryption in transit, access controls) to protect personal data. No
        system is completely secure; users should use strong, unique passwords
        for their accounts.
      </p>

      <h2>11. Children</h2>
      <p>
        The Services are intended for professional use by technical advisors.
        They are not directed at children, and we do not knowingly collect data
        from anyone under 16.
      </p>

      <h2>12. Changes to this policy</h2>
      <p>
        We may update this policy as the Services evolve. Material changes will
        be notified to users (e.g. by email or in-product notice) before they
        take effect.
      </p>

      <h2>13. Contact</h2>
      <p>
        Questions about this policy or how personal data is handled:{" "}
        <PrivacyEmail />
      </p>
    </article>
  );
}
