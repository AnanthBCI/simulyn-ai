"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, getToken } from "@/lib/api";

export default function NewProjectPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const p = await api.createProject({
        name,
        startDate,
        endDate,
        status: "Active",
      });
      router.push(`/projects/${p.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-semibold">New project</h1>
      <form onSubmit={onSubmit} className="mt-6 space-y-4 rounded-xl border border-site-border bg-site-card p-6">
        <div>
          <label className="text-sm text-site-muted">Name</label>
          <input
            className="mt-1 w-full rounded-md border border-site-border bg-site-bg px-3 py-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm text-site-muted">Start</label>
            <input
              type="date"
              className="mt-1 w-full rounded-md border border-site-border bg-site-bg px-3 py-2"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-sm text-site-muted">End</label>
            <input
              type="date"
              className="mt-1 w-full rounded-md border border-site-border bg-site-bg px-3 py-2"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
            />
          </div>
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-site-accent px-4 py-2 font-medium text-white hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? "Saving…" : "Create project"}
        </button>
      </form>
    </div>
  );
}
