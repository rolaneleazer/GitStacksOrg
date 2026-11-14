import { CheckCircle2, Mail } from 'lucide-react';
import React, { useState } from 'react';
import { api } from '../lib/api.ts';

export function NewsletterCard({ defaultTopic = 'All Engineering Topics' }: { defaultTopic?: string }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [topic, setTopic] = useState(defaultTopic);
  const [consent, setConsent] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setStatusMessage(null);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!consent) {
      setError('Please confirm subscription consent.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.subscribeNewsletter({
        email: email.trim(),
        name: name.trim(),
        interest_topic: topic,
        consent_given: consent
      });
      setStatusMessage(
        res.alreadySubscribed
          ? 'You are already subscribed to the GitStack Engineering Dispatch.'
          : 'Subscribed. You will receive our bi-weekly AI, MLOps, and Cloud Architecture briefings.'
      );
      setEmail('');
      setName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Subscription failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      aria-label="Engineering Newsletter Subscription"
      className="rounded-xl border border-slate-200 bg-slate-50 p-6 sm:p-8"
    >
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-lg">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#1E40AF]">
            <Mail className="h-4 w-4" />
            <span>GitStack Engineering Dispatch</span>
          </div>
          <h3 className="mt-2 font-display text-xl font-bold tracking-tight text-slate-900">
            Production Architecture Briefings, Twice a Month
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Receive practical system blueprints on enterprise RAG, MLOps drift governance,
            Terraform patterns, and TypeScript architecture—zero marketing spam.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="w-full max-w-md space-y-3" noValidate>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name (optional)"
              aria-label="Your name"
              className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#1E40AF] focus:outline-none"
            />
            <select
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              aria-label="Primary engineering interest"
              className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-[#1E40AF] focus:outline-none"
            >
              <option value="All Engineering Topics">All Engineering Topics</option>
              <option value="AI Integration & RAG">AI Integration &amp; RAG</option>
              <option value="ML Automation & MLOps">ML Automation &amp; MLOps</option>
              <option value="Cloud & FinOps">Cloud &amp; FinOps</option>
              <option value="Custom Software Architecture">Custom Software</option>
            </select>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              aria-label="Work or personal email"
              className="flex-1 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#1E40AF] focus:outline-none"
            />
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-[#1E40AF] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1D4ED8] disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
            >
              {submitting ? 'Joining...' : 'Subscribe'}
            </button>
          </div>
          <label className="flex items-start gap-2 text-xs text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 rounded border-slate-300 text-[#1E40AF]"
            />
            <span>I agree to receive technical updates and can unsubscribe at any time.</span>
          </label>
          {error && <p className="text-xs font-medium text-red-700">{error}</p>}
          {statusMessage && (
            <p className="flex items-center gap-1.5 text-xs font-medium text-[#16A34A]">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{statusMessage}</span>
            </p>
          )}
        </form>
      </div>
    </section>
  );
}
