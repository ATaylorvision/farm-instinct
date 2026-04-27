"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { api, type Archetype, type AssessmentResult, type ThemeResult } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

/**
 * Print-optimized report. Loads in a new tab, auto-fires the native print
 * dialog. Uses the same parchment / olive / terracotta palette as the rest of
 * the app — just without the nav chrome and tuned for ink-on-paper.
 */
export default function PrintReportPage() {
  const t = useTranslations("results");
  return (
    <Suspense fallback={<p>{t("loading")}</p>}>
      <PrintReportInner />
    </Suspense>
  );
}

function PrintReportInner() {
  const t = useTranslations("results");
  const tr = useTranslations("report");
  const router = useRouter();
  const params = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    const sessionParam = params.get("session");
    const load = async () => {
      try {
        if (sessionParam) {
          setResult(await api.getResult(Number(sessionParam)));
          return;
        }
        const history = await api.history();
        setResult(history[0] ?? null);
      } catch {
        setError(t("noResult"));
      }
    };
    load();
  }, [authLoading, user, params, router, t]);

  useEffect(() => {
    if (!result) return;
    const id = window.setTimeout(() => {
      try {
        window.print();
      } catch {
        /* user can still click the button */
      }
    }, 600);
    return () => window.clearTimeout(id);
  }, [result]);

  if (authLoading || (!result && !error)) {
    return <p className="p-6 text-muted-foreground">{t("loading")}</p>;
  }
  if (!result) {
    return <p className="p-6 text-muted-foreground">{error ?? t("noResult")}</p>;
  }

  return <PrintLayout result={result} tr={tr} userName={user?.full_name ?? user?.email ?? ""} />;
}

function PrintLayout({
  result,
  tr,
  userName,
}: {
  result: AssessmentResult;
  tr: ReturnType<typeof useTranslations>;
  userName: string;
}) {
  const { primary_archetype: primary, secondary_archetype: secondary, all_themes, recommended_roles } = result;
  const sortedTraits = [...all_themes].sort((a, b) => b.score - a.score);
  const strongest = sortedTraits[0];
  const weakest = sortedTraits[sortedTraits.length - 1];
  const completedDate = result.completed_at
    ? new Date(result.completed_at).toLocaleDateString(result.locale, { year: "numeric", month: "long", day: "numeric" })
    : "";

  return (
    <div className="bg-background text-foreground">
      {/* Action bar — only visible on screen, hidden in print */}
      <div className="no-print sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-card px-6 py-3 shadow-sm">
        <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground">{tr("header")}</span>
        <div className="flex gap-2">
          <button
            onClick={() => window.close()}
            className="rounded-md border px-4 py-2 text-sm transition hover:bg-secondary"
          >
            {tr("viewWeb")}
          </button>
          <button
            onClick={() => window.print()}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
          >
            {tr("printButton")}
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-8 py-10 space-y-8 print:px-0 print:py-0">
        {/* Header */}
        <header data-print-block className="border-b pb-6">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">{tr("header")}</p>
          <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
            {userName && (
              <p className="text-base">
                <span className="text-muted-foreground">{tr("forLabel")} </span>
                <span className="font-semibold">{userName}</span>
              </p>
            )}
            {completedDate && (
              <p className="text-sm text-muted-foreground">
                {tr("completedLabel")}: {completedDate}
              </p>
            )}
          </div>
        </header>

        {/* Hero archetype */}
        {primary && (
          <section data-print-block className="space-y-3">
            <div className="flex items-center gap-4">
              <div
                className="flex h-20 w-20 items-center justify-center rounded-xl border-2 text-4xl"
                style={{ backgroundColor: `${primary.color}1a`, borderColor: primary.color }}
              >
                {primary.emoji}
              </div>
              <div>
                <h1 className="font-serif text-4xl font-bold leading-tight" style={{ color: primary.color }}>
                  {primary.name}
                </h1>
                {primary.tagline && <p className="mt-1 text-base italic text-muted-foreground">{primary.tagline}</p>}
              </div>
            </div>
            {primary.description && <p className="text-base leading-relaxed">{primary.description}</p>}
            {secondary && (
              <p className="text-sm text-muted-foreground">
                {tr("secondaryLabel")}{" "}
                <span className="font-semibold" style={{ color: secondary.color }}>
                  {secondary.emoji} {secondary.name}
                </span>
              </p>
            )}
          </section>
        )}

        {primary && primary.hidden_truth && (
          <PrintSection title={tr("hiddenTruthTitle")}>
            <p className="leading-relaxed">{primary.hidden_truth}</p>
          </PrintSection>
        )}

        <PrintSection title={tr("traitProfileTitle")} subtitle={tr("traitProfileSubtitle")}>
          <PrintTraitTable traits={sortedTraits} naturalLabel={tr("naturalStrength")} lowerLabel={tr("lowerInstinct")} />
        </PrintSection>

        {primary && primary.vs_others && (
          <PrintSection title={tr("vsOthersTitle")}>
            <p className="leading-relaxed">{primary.vs_others}</p>
          </PrintSection>
        )}

        {strongest && weakest && (
          <PrintSection title={tr("strongVsWeakTitle")}>
            <div className="grid gap-3 md:grid-cols-2">
              <PrintSideCard label={tr("strongestSide")} trait={strongest} tone="strong" />
              <PrintSideCard label={tr("weakestSide")} trait={weakest} tone="weak" />
            </div>
          </PrintSection>
        )}

        {primary && (primary.best_role || primary.strengths.length > 0) && (
          <PrintSection title={tr("builtForTitle")}>
            {primary.best_role && <p className="leading-relaxed">{primary.best_role}</p>}
            {primary.strengths.length > 0 && (
              <ul className="mt-3 list-disc space-y-1 pl-6 text-sm">
                {primary.strengths.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            )}
          </PrintSection>
        )}

        {primary && (primary.wrong_role || primary.frustrated_by || primary.struggles_with) && (
          <PrintSection title={tr("limitsTitle")}>
            <div className="space-y-3 rounded-md border border-accent/30 bg-accent/5 p-4 text-sm">
              {primary.wrong_role && (
                <p>
                  <span className="font-semibold text-accent">{tr("limitsLine1")} </span>
                  {primary.wrong_role}
                </p>
              )}
              {primary.frustrated_by && (
                <p>
                  <span className="font-semibold text-accent">{tr("limitsLine2")} </span>
                  {primary.frustrated_by}
                </p>
              )}
              {primary.struggles_with && (
                <p>
                  <span className="font-semibold text-accent">{tr("limitsLine3")} </span>
                  {primary.struggles_with}
                </p>
              )}
            </div>
          </PrintSection>
        )}

        <PrintSection title={tr("rolesTitle")} subtitle={tr("rolesSubtitle")}>
          {recommended_roles.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {recommended_roles.map((r) => (
                <span
                  key={r.code}
                  className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-sm"
                >
                  <span>{r.emoji}</span>
                  <span className="font-medium">{r.name}</span>
                </span>
              ))}
            </div>
          ) : (
            <p className="italic text-muted-foreground">{tr("noRoles")}</p>
          )}
        </PrintSection>
      </div>
    </div>
  );
}

function PrintSection({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section data-print-block className="space-y-2">
      <h2 className="font-serif text-xl font-semibold border-b pb-1">{title}</h2>
      {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      <div>{children}</div>
    </section>
  );
}

function PrintTraitTable({
  traits,
  naturalLabel,
  lowerLabel,
}: {
  traits: ThemeResult[];
  naturalLabel: string;
  lowerLabel: string;
}) {
  return (
    <table className="w-full border-collapse text-sm">
      <tbody>
        {traits.map((trait, i) => {
          const score10 = trait.score * 10;
          const isTop = i === 0;
          const isBottom = i === traits.length - 1;
          return (
            <tr key={trait.code} className="border-b">
              <td className="py-2 pr-3 font-medium align-middle">{trait.name}</td>
              <td className="py-2 pr-3 align-middle w-1/2">
                <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className={`h-full rounded-full ${
                      isTop ? "bg-primary" : isBottom ? "bg-accent" : "bg-primary/60"
                    }`}
                    style={{ width: `${Math.max(2, score10 * 10)}%` }}
                  />
                </div>
              </td>
              <td className="py-2 pr-3 text-right font-mono text-xs align-middle whitespace-nowrap text-muted-foreground">
                {score10.toFixed(1)} / 10
              </td>
              <td className="py-2 text-xs uppercase tracking-wide text-right align-middle whitespace-nowrap">
                {isTop && <span className="font-semibold text-primary">{naturalLabel}</span>}
                {isBottom && <span className="font-semibold text-accent">{lowerLabel}</span>}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function PrintSideCard({ label, trait, tone }: { label: string; trait: ThemeResult; tone: "strong" | "weak" }) {
  const accent = tone === "strong" ? "border-primary/40 bg-primary/5" : "border-accent/40 bg-accent/5";
  const labelClass = tone === "strong" ? "text-primary" : "text-accent";
  return (
    <div className={`rounded-md border p-4 ${accent}`}>
      <p className={`text-xs font-semibold uppercase tracking-wide ${labelClass}`}>{label}</p>
      <h3 className="mt-1 font-serif text-lg font-semibold">{trait.name}</h3>
      {trait.description && <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{trait.description}</p>}
      <p className="mt-2 font-mono text-xs text-muted-foreground">{(trait.score * 10).toFixed(1)} / 10</p>
    </div>
  );
}
