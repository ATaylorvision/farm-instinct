"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/routing";
import { api, type Archetype, type AssessmentResult, type ThemeResult, type RecommendedRole } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export default function ResultsPage() {
  const t = useTranslations("results");
  return (
    <Suspense fallback={<p className="text-muted-foreground">{t("loading")}</p>}>
      <ResultsInner />
    </Suspense>
  );
}

function ResultsInner() {
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

  if (authLoading || (!result && !error)) {
    return <p className="text-muted-foreground">{t("loading")}</p>;
  }

  if (!result) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">{error ?? t("noResult")}</p>
        <Button asChild>
          <Link href="/assessment">{t("startNew")}</Link>
        </Button>
      </div>
    );
  }

  return <Report result={result} t={t} tr={tr} userName={user?.full_name ?? user?.email ?? ""} />;
}

// ---------------------------------------------------------------------------
// Report — uses the app's parchment/olive/terracotta palette
// ---------------------------------------------------------------------------

function Report({
  result,
  t,
  tr,
  userName,
}: {
  result: AssessmentResult;
  t: ReturnType<typeof useTranslations>;
  tr: ReturnType<typeof useTranslations>;
  userName: string;
}) {
  const { primary_archetype: primary, secondary_archetype: secondary, all_themes, recommended_roles } = result;
  const sortedTraits = useMemo(() => [...all_themes].sort((a, b) => b.score - a.score), [all_themes]);
  const strongest = sortedTraits[0];
  const weakest = sortedTraits[sortedTraits.length - 1];

  const completedDate = result.completed_at
    ? new Date(result.completed_at).toLocaleDateString(result.locale, { year: "numeric", month: "long", day: "numeric" })
    : "";

  const printHref = `/results/print${result.session_id ? `?session=${result.session_id}` : ""}`;

  return (
    <div className="space-y-10">
      {/* Action bar (hidden when printing) */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground">{tr("header")}</span>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/assessment">{tr("retake")}</Link>
          </Button>
          <Button asChild>
            <a href={printHref} target="_blank" rel="noopener noreferrer">
              {tr("printButton")}
            </a>
          </Button>
        </div>
      </div>

      {/* 1. Hero Reveal */}
      {primary && (
        <HeroReveal
          primary={primary}
          secondary={secondary}
          userName={userName}
          completedDate={completedDate}
          tr={tr}
        />
      )}

      {/* 2. Hidden Truth */}
      {primary && primary.hidden_truth && (
        <Section title={tr("hiddenTruthTitle")}>
          <p className="text-base leading-relaxed md:text-lg">{primary.hidden_truth}</p>
        </Section>
      )}

      {/* 3. Trait Profile */}
      <Section title={tr("traitProfileTitle")} subtitle={tr("traitProfileSubtitle")}>
        <Card>
          <CardContent className="space-y-4 p-6">
            {sortedTraits.map((trait, i) => {
              const score10 = trait.score * 10;
              const isTop = i === 0;
              const isBottom = i === sortedTraits.length - 1;
              return (
                <div key={trait.code} className="grid grid-cols-[1fr_auto] items-center gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="font-medium">{trait.name}</span>
                      <span className="font-mono text-xs text-muted-foreground">{score10.toFixed(1)} / 10</span>
                    </div>
                    <Progress value={score10 * 10} className="h-2" />
                  </div>
                  <div className="w-32 text-right text-[10px] uppercase tracking-wide">
                    {isTop && (
                      <span className="rounded-full bg-primary/10 px-2 py-1 font-semibold text-primary">
                        {tr("naturalStrength")}
                      </span>
                    )}
                    {isBottom && (
                      <span className="rounded-full bg-accent/10 px-2 py-1 font-semibold text-accent">
                        {tr("lowerInstinct")}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </Section>

      {/* 4. Vs Others */}
      {primary && primary.vs_others && (
        <Section title={tr("vsOthersTitle")}>
          <p className="text-base leading-relaxed md:text-lg">{primary.vs_others}</p>
        </Section>
      )}

      {/* 5. Strongest vs Weakest */}
      {strongest && weakest && (
        <Section title={tr("strongVsWeakTitle")}>
          <div className="grid gap-4 md:grid-cols-2">
            <SideCard label={tr("strongestSide")} trait={strongest} tone="strong" />
            <SideCard label={tr("weakestSide")} trait={weakest} tone="weak" />
          </div>
        </Section>
      )}

      {/* 6. What You Were Built For */}
      {primary && (primary.best_role || primary.strengths.length > 0) && (
        <Section title={tr("builtForTitle")}>
          <Card>
            <CardContent className="space-y-4 p-6">
              {primary.best_role && <p className="text-base leading-relaxed">{primary.best_role}</p>}
              {primary.strengths.length > 0 && (
                <div className="grid gap-2 sm:grid-cols-2">
                  {primary.strengths.map((s, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 rounded-md border border-border bg-secondary/40 px-4 py-3 text-sm"
                    >
                      <span className="mt-0.5 font-bold text-accent">▸</span>
                      <span>{s}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </Section>
      )}

      {/* 7. Know Your Limits */}
      {primary && (primary.wrong_role || primary.frustrated_by || primary.struggles_with) && (
        <Section title={tr("limitsTitle")}>
          <Card className="border-accent/30 bg-accent/5">
            <CardContent className="space-y-4 p-6">
              {primary.wrong_role && <LimitLine label={tr("limitsLine1")} value={primary.wrong_role} />}
              {primary.frustrated_by && <LimitLine label={tr("limitsLine2")} value={primary.frustrated_by} />}
              {primary.struggles_with && <LimitLine label={tr("limitsLine3")} value={primary.struggles_with} />}
            </CardContent>
          </Card>
        </Section>
      )}

      {/* 8. Recommended Roles */}
      <Section title={tr("rolesTitle")} subtitle={tr("rolesSubtitle")}>
        {recommended_roles.length > 0 ? (
          <div className="flex flex-wrap gap-3">
            {recommended_roles.map((r) => (
              <RolePill key={r.code} role={r} />
            ))}
          </div>
        ) : (
          <p className="italic text-muted-foreground">{tr("noRoles")}</p>
        )}
      </Section>

      {/* 9. Print / Retake CTAs */}
      <div className="no-print flex flex-wrap items-center justify-center gap-3 border-t pt-10">
        <Button asChild>
          <a href={printHref} target="_blank" rel="noopener noreferrer">
            {tr("printButton")}
          </a>
        </Button>
        <Button asChild variant="outline">
          <Link href="/assessment">{tr("retake")}</Link>
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section data-print-block className="space-y-4">
      <div className="space-y-1">
        <h2 className="font-serif text-2xl font-semibold md:text-3xl">{title}</h2>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function HeroReveal({
  primary,
  secondary,
  userName,
  completedDate,
  tr,
}: {
  primary: Archetype;
  secondary: Archetype | null;
  userName: string;
  completedDate: string;
  tr: ReturnType<typeof useTranslations>;
}) {
  return (
    <Card data-print-block className="overflow-hidden border-accent/20">
      <CardHeader className="space-y-4 bg-secondary/30 pb-8">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs uppercase tracking-[0.3em] text-muted-foreground">
          <span>{tr("header")}</span>
          {completedDate && <span>{tr("completedLabel")} · {completedDate}</span>}
        </div>

        {userName && (
          <p className="text-sm text-muted-foreground">
            {tr("forLabel")} <span className="font-medium text-foreground">{userName}</span>
          </p>
        )}

        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <div
            className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl border-2 text-5xl shadow-sm"
            style={{ backgroundColor: `${primary.color}1a`, borderColor: `${primary.color}` }}
          >
            {primary.emoji}
          </div>
          <div>
            <CardTitle className="font-serif text-4xl font-semibold leading-tight md:text-5xl" style={{ color: primary.color }}>
              {primary.name}
            </CardTitle>
            {primary.tagline && (
              <CardDescription className="mt-2 text-lg italic text-muted-foreground">{primary.tagline}</CardDescription>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-6 pt-6">
        {primary.description && (
          <p className="text-base leading-relaxed md:text-lg">{primary.description}</p>
        )}
        {secondary && (
          <div className="flex flex-wrap items-center gap-2 border-t pt-4 text-sm text-muted-foreground">
            <span>{tr("secondaryLabel")}</span>
            <span
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1 font-medium"
              style={{ borderColor: `${secondary.color}80`, color: secondary.color, backgroundColor: `${secondary.color}14` }}
            >
              <span>{secondary.emoji}</span>
              <span>{secondary.name}</span>
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SideCard({ label, trait, tone }: { label: string; trait: ThemeResult; tone: "strong" | "weak" }) {
  const accent = tone === "strong" ? "border-primary/40 bg-primary/5" : "border-accent/40 bg-accent/5";
  const labelClass = tone === "strong" ? "bg-primary/10 text-primary" : "bg-accent/10 text-accent";
  return (
    <Card className={accent}>
      <CardContent className="space-y-3 p-6">
        <div className="flex items-center justify-between gap-2">
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${labelClass}`}>
            {label}
          </span>
          <span className="font-mono text-xs text-muted-foreground">{(trait.score * 10).toFixed(1)} / 10</span>
        </div>
        <h3 className="font-serif text-2xl font-semibold">{trait.name}</h3>
        {trait.description && <p className="text-sm leading-relaxed text-muted-foreground">{trait.description}</p>}
      </CardContent>
    </Card>
  );
}

function LimitLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-accent">{label}</p>
      <p className="mt-1 leading-relaxed">{value}</p>
    </div>
  );
}

function RolePill({ role }: { role: RecommendedRole }) {
  return (
    <div
      className="flex items-center gap-3 rounded-full border bg-card px-4 py-2 shadow-sm transition-colors hover:border-accent hover:bg-accent/5"
      title={role.reason}
    >
      <span className="text-2xl">{role.emoji}</span>
      <div className="text-left">
        <div className="text-sm font-semibold">{role.name}</div>
        <div className="text-xs text-muted-foreground">{role.reason}</div>
      </div>
    </div>
  );
}
