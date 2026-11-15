import { ArrowRight, CheckCircle2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { api } from '../lib/api.ts';
import type { ClientInquiry, ServiceCategory } from '../shared/types.ts';

interface InquiryFormProps {
  defaultService?: ServiceCategory | 'Full-Stack Transformation';
  compact?: boolean;
}

export function InquiryForm({
  defaultService = 'AI Integration',
  compact = false
}: InquiryFormProps) {
  const [fullName, setFullName] = useState('');
  const [company, setCompany] = useState('');
  const [workEmail, setWorkEmail] = useState('');
  const [serviceInterest, setServiceInterest] = useState<string>(defaultService);
  const [budgetRange, setBudgetRange] = useState('$50k – $120k');
  const [timeline, setTimeline] = useState('Within 30 days');
  const [projectBrief, setProjectBrief] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<ClientInquiry | null>(null);

  useEffect(() => {
    setServiceInterest(defaultService);
  }, [defaultService]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fullName.trim() || !company.trim() || !workEmail.trim()) {
      setError('Please enter your name, company, and corporate email.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(workEmail.trim())) {
      setError('Please provide a valid work email address.');
      return;
    }
    if (projectBrief.trim().length < 20) {
      setError('Please include at least 20 characters summarizing your project scope.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.submitInquiry({
        full_name: fullName.trim(),
        company: company.trim(),
        work_email: workEmail.trim(),
        service_interest: serviceInterest,
        budget_range: budgetRange,
        timeline,
        project_brief: projectBrief.trim()
      });
      setSubmitted(res.inquiry);
      setFullName('');
      setCompany('');
      setWorkEmail('');
      setProjectBrief('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send inquiry right now.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-8">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-[#16A34A]" />
          <div>
            <h3 className="font-display text-xl font-bold text-slate-900">
              Architecture Inquiry Received
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Thank you, {submitted.full_name}. A GitStack principal architect for{' '}
              <span className="font-medium text-slate-900">{submitted.service_interest}</span> will
              respond to <span className="font-medium text-slate-900">{submitted.work_email}</span>{' '}
              within one business day.
            </p>
            <div className="mt-4 inline-flex items-center gap-3 border-t border-slate-200 pt-4 text-xs text-slate-500">
              <span>Reference:</span>
              <span className="font-mono font-semibold text-slate-900 tabular-nums">
                {submitted.reference_code}
              </span>
            </div>
            <div className="mt-6">
              <button
                type="button"
                onClick={() => setSubmitted(null)}
                className="min-h-[44px] inline-flex items-center text-xs font-semibold text-[var(--gs-primary)] hover:underline"
              >
                Submit another inquiry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={`rounded-xl border border-slate-200 bg-white ${compact ? 'p-5 sm:p-6' : 'p-5 sm:p-8'}`}
      noValidate
    >
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="inq-name" className="block text-xs font-semibold text-slate-700">
            Full Name
          </label>
          <input
            id="inq-name"
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Alex Rivera"
            className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[var(--gs-primary)] focus:bg-white focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="inq-company" className="block text-xs font-semibold text-slate-700">
            Company / Organization
          </label>
          <input
            id="inq-company"
            type="text"
            required
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="Acme Logistics Inc."
            className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[var(--gs-primary)] focus:bg-white focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="inq-email" className="block text-xs font-semibold text-slate-700">
            Work Email
          </label>
          <input
            id="inq-email"
            type="email"
            required
            value={workEmail}
            onChange={(e) => setWorkEmail(e.target.value)}
            placeholder="alex@company.com"
            className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[var(--gs-primary)] focus:bg-white focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="inq-service" className="block text-xs font-semibold text-slate-700">
            Primary Capability Needed
          </label>
          <select
            id="inq-service"
            value={serviceInterest}
            onChange={(e) => setServiceInterest(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-[var(--gs-primary)] focus:bg-white focus:outline-none"
          >
            <option value="AI Integration">AI Integration &amp; Enterprise RAG</option>
            <option value="ML Automation">Machine Learning Automation &amp; MLOps</option>
            <option value="Custom Software">Custom Software Development</option>
            <option value="Cloud Infrastructure">Cloud Infrastructure Management</option>
            <option value="Technical Consulting">Technical Architecture Consulting</option>
            <option value="Full-Stack Transformation">Full-Stack AI &amp; Cloud Modernization</option>
          </select>
        </div>
        <div>
          <label htmlFor="inq-budget" className="block text-xs font-semibold text-slate-700">
            Estimated Engagement Budget
          </label>
          <select
            id="inq-budget"
            value={budgetRange}
            onChange={(e) => setBudgetRange(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-[var(--gs-primary)] focus:bg-white focus:outline-none"
          >
            <option value="$15k – $35k">$15k – $35k (Discovery / Pilot)</option>
            <option value="$35k – $75k">$35k – $75k (Production Build)</option>
            <option value="$50k – $120k">$50k – $120k (Multi-System Integration)</option>
            <option value="$120k+">$120k+ (Enterprise Retainer / Program)</option>
          </select>
        </div>
        <div>
          <label htmlFor="inq-timeline" className="block text-xs font-semibold text-slate-700">
            Target Kickoff Window
          </label>
          <select
            id="inq-timeline"
            value={timeline}
            onChange={(e) => setTimeline(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-[var(--gs-primary)] focus:bg-white focus:outline-none"
          >
            <option value="Immediate (1–2 weeks)">Immediate (1–2 weeks)</option>
            <option value="Within 30 days">Within 30 days</option>
            <option value="Next Quarter">Next Quarter</option>
            <option value="Exploratory Architecture Review">Exploratory Architecture Review</option>
          </select>
        </div>
      </div>

      <div className="mt-5">
        <label htmlFor="inq-brief" className="block text-xs font-semibold text-slate-700">
          Technical Context &amp; Objectives
        </label>
        <textarea
          id="inq-brief"
          rows={4}
          required
          value={projectBrief}
          onChange={(e) => setProjectBrief(e.target.value)}
          placeholder="Describe your current stack, target workflows for AI/ML automation or cloud migration, and security or compliance constraints..."
          className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[var(--gs-primary)] focus:bg-white focus:outline-none"
        />
      </div>

      {error && (
        <div
          role="alert"
          className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-medium text-red-700"
        >
          {error}
        </div>
      )}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-500">
          Protected under NDA upon request. Direct response from a principal engineer.
        </p>
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex w-full sm:w-auto min-h-[44px] items-center justify-center gap-2 rounded-lg bg-[var(--gs-primary)] hover:bg-[var(--gs-primary-hover)] px-6 py-3 text-sm font-semibold text-white disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
        >
          <span>{submitting ? 'Submitting...' : 'Request Architecture Review'}</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </form>
  );
}
