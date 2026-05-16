"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, getToken } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { DateField } from "@/components/ui/DateField";
import { Spinner } from "@/components/ui/primitives";
import { usePageTitle } from "@/hooks/usePageTitle";

type FieldErrors = Partial<
  Record<"name" | "startDate" | "endDate", string>
>;

const NAME_MAX = 120;

export default function NewProjectPage() {
  usePageTitle("New project");
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (!name.trim()) next.name = "Project name is required.";
    else if (name.trim().length > NAME_MAX)
      next.name = `Name is too long (max ${NAME_MAX}).`;
    if (!startDate) next.startDate = "Pick a start date.";
    if (!endDate) next.endDate = "Pick an end date.";
    if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
      next.endDate = "End date must be on or after start date.";
    }
    return next;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    setFormError(null);
    const fieldErrors = validate();
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) return;

    setLoading(true);
    try {
      const p = await api.createProject({
        name: name.trim(),
        startDate,
        endDate,
        status: "Active",
      });
      toast.success(`Project "${p.name}" created.`);
      router.push(`/projects/${p.id}`);
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Failed";
      setFormError(raw.length > 200 ? "Couldn't create the project. Please try again." : raw);
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg">
      <Breadcrumbs
        items={[
          { label: "Projects", href: "/projects" },
          { label: "New project" },
        ]}
      />
      <h1 className="mt-3 text-2xl font-semibold text-white">New project</h1>
      <p className="mt-1 text-sm text-site-muted">
        Just the basics — you can add tasks (or import an Excel schedule) on the next page.
      </p>
      <form
        onSubmit={onSubmit}
        noValidate
        className="mt-6 space-y-4 rounded-xl border border-site-border bg-site-card p-6 shadow-card"
      >
        <Field
          label="Name"
          error={errors.name}
          errorId="np-name-err"
          hint={
            !errors.name
              ? `${name.trim().length}/${NAME_MAX} characters`
              : undefined
          }
          input={
            <input
              className={inputClass(!!errors.name)}
              value={name}
              maxLength={NAME_MAX + 20}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setErrors((p) => ({ ...p, name: undefined }));
              }}
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? "np-name-err" : undefined}
              required
              placeholder="e.g. Tech Park Phase 2 — Tower B fitout"
              autoFocus
            />
          }
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Start"
            error={errors.startDate}
            errorId="np-start-err"
            input={
              <DateField
                value={startDate}
                onChange={(v) => {
                  setStartDate(v);
                  setErrors((p) => ({
                    ...p,
                    startDate: undefined,
                    endDate: undefined,
                  }));
                }}
                placeholder="Start date"
                invalid={!!errors.startDate}
                required
                describedBy={errors.startDate ? "np-start-err" : undefined}
                ariaLabel="Project start date"
              />
            }
          />
          <Field
            label="End"
            error={errors.endDate}
            errorId="np-end-err"
            input={
              <DateField
                value={endDate}
                min={startDate || undefined}
                onChange={(v) => {
                  setEndDate(v);
                  if (errors.endDate)
                    setErrors((p) => ({ ...p, endDate: undefined }));
                }}
                placeholder="End date"
                invalid={!!errors.endDate}
                required
                describedBy={errors.endDate ? "np-end-err" : undefined}
                ariaLabel="Project end date"
              />
            }
          />
        </div>

        {formError && (
          <p
            role="alert"
            className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300"
          >
            {formError}
          </p>
        )}

        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-md bg-site-accent px-4 py-2 font-medium text-white transition hover:bg-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-site-card disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading && <Spinner size="sm" />}
            {loading ? "Saving…" : "Create project"}
          </button>
          <Link
            href="/projects"
            className="rounded-md border border-site-border bg-site-card px-4 py-2 text-sm text-slate-300 transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-accent/40"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  input,
  error,
  errorId,
  hint,
}: {
  label: string;
  input: React.ReactNode;
  error?: string;
  errorId?: string;
  hint?: string;
}) {
  return (
    <div>
      <label className="text-sm font-medium text-slate-300">{label}</label>
      <div className="mt-1">{input}</div>
      {error ? (
        <p id={errorId} className="mt-1 text-xs text-red-400">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-site-muted">{hint}</p>
      ) : null}
    </div>
  );
}

function inputClass(hasError: boolean): string {
  const base =
    "w-full rounded-md border bg-site-bg px-3 py-2 text-white outline-none transition focus:ring-2";
  return hasError
    ? `${base} border-red-500/60 focus:border-red-500 focus:ring-red-500/30`
    : `${base} border-site-border focus:border-site-accent focus:ring-site-accent/20`;
}
