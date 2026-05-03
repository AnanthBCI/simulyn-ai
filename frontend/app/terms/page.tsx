import Link from "next/link";

export const metadata = {
  title: "Terms of service — Simulyn AI",
  description:
    "Simulyn AI terms of service. Placeholder — swap for legal-reviewed copy before paid customers.",
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <Link
        href="/"
        className="text-xs text-site-accent hover:underline"
      >
        &larr; Back to Simulyn AI
      </Link>
      <h1 className="mt-6 text-3xl font-bold text-white">Terms of service</h1>
      <p className="mt-2 text-xs text-site-muted">
        Last updated: {new Date().toISOString().slice(0, 10)}
      </p>

      <div className="mt-6 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
        <strong>Placeholder.</strong> Before taking payment from customers,
        replace this content with a legally-reviewed terms of service.
        Template generators: Termly, iubenda, GetTerms.
      </div>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-slate-300">
        <section>
          <h2 className="text-lg font-semibold text-white">Your account</h2>
          <p className="mt-2">
            You&apos;re responsible for what happens under your account, for
            keeping your password secret, and for ensuring you have the right
            to upload any project or schedule data you bring into Simulyn AI.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-white">AI-generated content</h2>
          <p className="mt-2">
            Simulyn AI uses a large language model to generate narrative
            summaries and recommendations. These are <em>decision support</em>,
            not guarantees. You are always the final decision maker on your
            project. We are not liable for actions taken based on AI output.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-white">Uptime and fitness for purpose</h2>
          <p className="mt-2">
            The service is provided &ldquo;as is&rdquo; during trial and pilot
            phases. Paid plans will move to an SLA as part of the Enterprise
            agreement.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-white">Termination</h2>
          <p className="mt-2">
            You may cancel at any time from Organizations → Delete
            organization. We may suspend accounts that violate these terms or
            that are used in a way that risks harm to the service or other
            customers.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-white">Contact</h2>
          <p className="mt-2">
            Questions about these terms:{" "}
            <a
              href="mailto:hello@simulyn.ai"
              className="text-site-accent hover:underline"
            >
              hello@simulyn.ai
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
