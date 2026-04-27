"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/routing";
import {
  api,
  type AdminSessionDetail,
  type AdminUserDetail,
  type Archetype,
  type RecommendedRole,
  type ThemeResult,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export default function AdminUserDetailPage() {
  const t = useTranslations("admin");
  const locale = useLocale();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();

  const [userDetail, setUserDetail] = useState<AdminUserDetail | null>(null);
  const [sessionDetail, setSessionDetail] = useState<AdminSessionDetail | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionLoading, setSessionLoading] = useState(false);

  // Load user detail (list of sessions) on mount
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!user.is_admin) {
      setError(t("notAuthorized"));
      return;
    }
    const id = Number(params.id);
    if (!Number.isFinite(id)) {
      setError(t("errorLoad"));
      return;
    }
    api.adminUserDetail(id).then(setUserDetail).catch(() => setError(t("errorLoad")));
  }, [authLoading, user, router, params.id, t]);

  // Default-select the most recent completed session (or most recent, if none completed)
  useEffect(() => {
    if (!userDetail || selectedSessionId !== null) return;
    if (userDetail.sessions.length === 0) return;
    const firstCompleted = userDetail.sessions.find((s) => s.completed_at !== null);
    const target = firstCompleted ?? userDetail.sessions[0];
    setSelectedSessionId(target.id);
  }, [userDetail, selectedSessionId]);

  // Whenever selected session changes, load its full detail
  useEffect(() => {
    if (selectedSessionId === null) return;
    setSessionLoading(true);
    setSessionDetail(null);
    api
      .adminSessionDetail(selectedSessionId)
      .then(setSessionDetail)
      .catch(() => setError(t("errorLoad")))
      .finally(() => setSessionLoading(false));
  }, [selectedSessionId, t]);

  const sortedSessions = useMemo(
    () =>
      userDetail
        ? [...userDetail.sessions].sort((a, b) => {
            const ad = new Date(a.completed_at || a.started_at).getTime();
            const bd = new Date(b.completed_at || b.started_at).getTime();
            return bd - ad;
          })
        : [],
    [userDetail],
  );

  const handlePrint = () => {
    if (typeof window !== "undefined") window.print();
  };

  const handleDownloadCsv = () => {
    if (!sessionDetail || !userDetail) return;
    const csv = buildSessionCsv(userDetail, sessionDetail, t);
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const who = (userDetail.full_name || userDetail.email).replace(/[^a-z0-9]+/gi, "_");
    a.download = `farminstinct_${who}_session_${sessionDetail.id}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (error) return <p className="text-destructive">{error}</p>;
  if (!userDetail) return <p className="text-muted-foreground">{t("loading")}</p>;

  return (
    <div className="space-y-8">
      <div className="no-print">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin">← {t("backToList")}</Link>
        </Button>
      </div>

      <div className="space-y-2">
        <h1 className="font-serif text-3xl font-semibold md:text-4xl">
          {userDetail.full_name || userDetail.email}
        </h1>
        <p className="text-muted-foreground">
          {userDetail.email} · {t("joined")}{" "}
          {new Date(userDetail.created_at).toLocaleDateString(locale)}
          {userDetail.is_admin && (
            <span className="ml-2 rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
              {t("adminBadge")}
            </span>
          )}
        </p>
      </div>

      {userDetail.sessions.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground">{t("userNoSessions")}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {sortedSessions.length > 1 && (
            <Card className="no-print">
              <CardHeader>
                <CardTitle className="font-serif text-lg">{t("pickSession")}</CardTitle>
                <CardDescription>{t("pickSessionSubtitle")}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {sortedSessions.map((s) => {
                    const completed = s.completed_at ? new Date(s.completed_at) : null;
                    const started = new Date(s.started_at);
                    const label = completed
                      ? completed.toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" })
                      : `${t("inProgress")} · ${started.toLocaleDateString(locale)}`;
                    const isActive = s.id === selectedSessionId;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSelectedSessionId(s.id)}
                        className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                          isActive
                            ? "border-primary bg-primary/10 text-primary"
                            : "hover:border-primary hover:text-primary"
                        }`}
                      >
                        {label} · {s.locale.toUpperCase()}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {sessionDetail && (
            <div className="no-print flex flex-wrap gap-2">
              <Button variant="outline" onClick={handlePrint}>
                {t("printPdf")}
              </Button>
              <Button variant="outline" onClick={handleDownloadCsv}>
                {t("downloadCsv")}
              </Button>
            </div>
          )}

          {sessionLoading && !sessionDetail && (
            <p className="text-muted-foreground">{t("loading")}</p>
          )}

          {sessionDetail && (
            <>
              <OwnerReport detail={sessionDetail} t={t} />
              <SessionFullDetail detail={sessionDetail} t={t} locale={locale} />
            </>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Farm Owner Report (admin-only)
// ---------------------------------------------------------------------------

function OwnerReport({
  detail,
  t,
}: {
  detail: AdminSessionDetail;
  t: ReturnType<typeof useTranslations>;
}) {
  const primary = detail.primary_archetype;
  const secondary = detail.secondary_archetype;
  const sortedTraits = useMemo(
    () => [...detail.all_themes].sort((a, b) => b.score - a.score),
    [detail.all_themes],
  );
  const strongest = sortedTraits[0];
  const weakest = sortedTraits[sortedTraits.length - 1];

  if (!primary) return null;

  return (
    <div className="space-y-6">
      {/* Title bar */}
      <div className="space-y-2 border-l-4 border-accent pl-4">
        <h2 className="font-serif text-2xl font-semibold md:text-3xl">{t("ownerReportTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("ownerReportSubtitle")}</p>
      </div>

      {/* Hero archetype */}
      <Card data-print-block className="overflow-hidden border-accent/20">
        <CardHeader className="space-y-4 bg-secondary/30">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div
              className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border-2 text-5xl shadow-sm"
              style={{ backgroundColor: `${primary.color}1a`, borderColor: primary.color }}
            >
              {primary.emoji}
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                {t("ownerReportArchetype")}
              </p>
              <CardTitle
                className="font-serif text-3xl font-semibold leading-tight md:text-4xl"
                style={{ color: primary.color }}
              >
                {primary.name}
              </CardTitle>
              {primary.tagline && (
                <CardDescription className="mt-1 text-base italic text-muted-foreground">
                  {primary.tagline}
                </CardDescription>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 p-6">
          {primary.description && <p className="text-base leading-relaxed">{primary.description}</p>}
          {secondary && (
            <div className="flex flex-wrap items-center gap-2 border-t pt-4 text-sm text-muted-foreground">
              <span>{t("ownerReportSecondaryLabel")}:</span>
              <span
                className="inline-flex items-center gap-2 rounded-full border px-3 py-1 font-medium"
                style={{
                  borderColor: `${secondary.color}80`,
                  color: secondary.color,
                  backgroundColor: `${secondary.color}14`,
                }}
              >
                <span>{secondary.emoji}</span>
                <span>{secondary.name}</span>
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Manager Briefing — the BIG one */}
      {primary.management && (
        <Card data-print-block className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="font-serif text-2xl text-primary">{t("ownerReportManagerBriefing")}</CardTitle>
            <CardDescription>{t("ownerReportManagerSubtitle")}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-base leading-relaxed md:text-lg">{primary.management}</p>
          </CardContent>
        </Card>
      )}

      {/* Recommended Roles */}
      <Card data-print-block>
        <CardHeader>
          <CardTitle className="font-serif text-xl">{t("ownerReportRoles")}</CardTitle>
        </CardHeader>
        <CardContent>
          {detail.recommended_roles.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {detail.recommended_roles.map((r) => (
                <RoleRow key={r.code} role={r} />
              ))}
            </div>
          ) : (
            <p className="italic text-muted-foreground">{t("ownerReportNoRoles")}</p>
          )}
        </CardContent>
      </Card>

      {/* Strongest / Weakest at a glance */}
      {strongest && weakest && (
        <div className="grid gap-4 md:grid-cols-2">
          <SideTraitCard label={t("ownerReportStrongest")} trait={strongest} tone="strong" />
          <SideTraitCard label={t("ownerReportWeakest")} trait={weakest} tone="weak" />
        </div>
      )}

      {/* Strengths */}
      {primary.strengths.length > 0 && (
        <Card data-print-block>
          <CardHeader>
            <CardTitle className="font-serif text-xl">{t("ownerReportStrengths")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2">
              {primary.strengths.map((s, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 rounded-md border bg-secondary/40 px-4 py-3 text-sm"
                >
                  <span className="mt-0.5 font-bold text-primary">▸</span>
                  <span>{s}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Best role */}
      {primary.best_role && (
        <InfoBlock
          title={t("ownerReportBestRole")}
          body={primary.best_role}
          tone="primary"
        />
      )}

      {/* Caveats — wrong role + frustrated by + struggles with */}
      <div className="grid gap-4 md:grid-cols-3">
        {primary.wrong_role && (
          <InfoBlock title={t("ownerReportWrongRole")} body={primary.wrong_role} tone="accent" />
        )}
        {primary.frustrated_by && (
          <InfoBlock title={t("ownerReportFrustrated")} body={primary.frustrated_by} tone="accent" />
        )}
        {primary.struggles_with && (
          <InfoBlock title={t("ownerReportStruggles")} body={primary.struggles_with} tone="accent" />
        )}
      </div>

      {/* Hidden truth */}
      {primary.hidden_truth && (
        <InfoBlock
          title={t("ownerReportHiddenTruth")}
          body={primary.hidden_truth}
          tone="muted"
          large
        />
      )}

      {/* Vs others */}
      {primary.vs_others && (
        <InfoBlock
          title={t("ownerReportVsOthers")}
          body={primary.vs_others}
          tone="muted"
          large
        />
      )}

      {/* Trait profile (compact admin view) */}
      <Card data-print-block>
        <CardHeader>
          <CardTitle className="font-serif text-xl">{t("ownerReportTraitProfile")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
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
                <div className="w-28 text-right text-[10px] uppercase tracking-wide">
                  {isTop && (
                    <span className="rounded-full bg-primary/10 px-2 py-1 font-semibold text-primary">
                      ↑
                    </span>
                  )}
                  {isBottom && (
                    <span className="rounded-full bg-accent/10 px-2 py-1 font-semibold text-accent">
                      ↓
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function InfoBlock({
  title,
  body,
  tone,
  large = false,
}: {
  title: string;
  body: string;
  tone: "primary" | "accent" | "muted";
  large?: boolean;
}) {
  const toneClass =
    tone === "primary"
      ? "border-primary/30 bg-primary/5"
      : tone === "accent"
      ? "border-accent/30 bg-accent/5"
      : "border-border bg-secondary/40";
  const titleClass =
    tone === "primary" ? "text-primary" : tone === "accent" ? "text-accent" : "text-foreground";
  return (
    <Card data-print-block className={toneClass}>
      <CardContent className="space-y-2 p-5">
        <h3 className={`text-xs font-semibold uppercase tracking-wide ${titleClass}`}>{title}</h3>
        <p className={large ? "text-base leading-relaxed" : "text-sm leading-relaxed"}>{body}</p>
      </CardContent>
    </Card>
  );
}

function SideTraitCard({
  label,
  trait,
  tone,
}: {
  label: string;
  trait: ThemeResult;
  tone: "strong" | "weak";
}) {
  const accent = tone === "strong" ? "border-primary/40 bg-primary/5" : "border-accent/40 bg-accent/5";
  const labelClass = tone === "strong" ? "bg-primary/10 text-primary" : "bg-accent/10 text-accent";
  return (
    <Card data-print-block className={accent}>
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center justify-between gap-2">
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${labelClass}`}>
            {label}
          </span>
          <span className="font-mono text-xs text-muted-foreground">{(trait.score * 10).toFixed(1)} / 10</span>
        </div>
        <h3 className="font-serif text-xl font-semibold">{trait.name}</h3>
        {trait.description && <p className="text-sm leading-relaxed text-muted-foreground">{trait.description}</p>}
      </CardContent>
    </Card>
  );
}

function RoleRow({ role }: { role: RecommendedRole }) {
  return (
    <div className="flex items-center gap-3 rounded-md border bg-card px-4 py-3 transition-colors hover:border-accent">
      <span className="text-2xl">{role.emoji}</span>
      <div className="text-left">
        <div className="text-sm font-semibold">{role.name}</div>
        <div className="text-xs text-muted-foreground">{role.reason}</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Existing trait + transcript view
// ---------------------------------------------------------------------------

function SessionFullDetail({
  detail,
  t,
  locale,
}: {
  detail: AdminSessionDetail;
  t: ReturnType<typeof useTranslations>;
  locale: string;
}) {
  const completed = detail.completed_at ? new Date(detail.completed_at) : null;
  const started = new Date(detail.started_at);

  return (
    <div className="space-y-6">
      <Card data-print-block>
        <CardHeader>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <CardTitle className="font-serif text-2xl">
              {completed
                ? completed.toLocaleDateString(locale, { year: "numeric", month: "long", day: "numeric" })
                : `${t("inProgress")} · ${started.toLocaleDateString(locale)}`}
            </CardTitle>
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              {detail.locale.toUpperCase()} · {t("sessionIdLabel")} #{detail.id}
            </span>
          </div>
          <CardDescription>
            {completed
              ? `${t("completedAt")} ${completed.toLocaleString(locale)}`
              : t("notYetCompleted")}
          </CardDescription>
        </CardHeader>
      </Card>

      <Card data-print-block>
        <CardHeader>
          <CardTitle className="font-serif text-2xl">{t("allThemesTitle")}</CardTitle>
          <CardDescription>{t("allThemesSubtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {detail.all_themes.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noScoresYet")}</p>
          ) : (
            detail.all_themes.map((theme) => (
              <div key={theme.code} data-print-block className="space-y-2 rounded-md border p-4">
                <div className="grid grid-cols-[3rem_1fr_6rem_3rem] items-center gap-3">
                  <span className="font-serif text-xl font-semibold text-muted-foreground">#{theme.rank}</span>
                  <span className="font-serif text-lg font-semibold">{theme.name}</span>
                  <Progress value={theme.score * 100} />
                  <span className="text-right text-sm text-muted-foreground">
                    {Math.round(theme.score * 100)}%
                  </span>
                </div>
                {theme.description && (
                  <p className="text-sm text-muted-foreground">{theme.description}</p>
                )}
                {theme.tips.length > 0 && (
                  <ul className="ml-5 list-disc space-y-1 text-sm">
                    {theme.tips.map((tip, idx) => (
                      <li key={idx}>{tip}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card data-print-block>
        <CardHeader>
          <CardTitle className="font-serif text-2xl">{t("responsesTitle")}</CardTitle>
          <CardDescription>{t("responsesSubtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {detail.responses.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noResponsesYet")}</p>
          ) : (
            detail.responses.map((r) => (
              <div key={r.question_id} data-print-block className="space-y-2 rounded-md border p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("questionLabel")} {r.order} · {r.kind === "paired" ? t("kindPaired") : t("kindLikert")}
                  </span>
                  <span className="text-xs text-muted-foreground">{r.question_code}</span>
                </div>

                {r.kind === "likert" ? (
                  <>
                    {r.prompt && <p className="text-sm font-medium">{r.prompt}</p>}
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="rounded-full bg-primary/10 px-3 py-1 font-medium text-primary">
                        {r.value} / 5{r.value_label ? ` · ${r.value_label}` : ""}
                      </span>
                      {r.likert_themes.length > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {t("contributesTo")} {r.likert_themes.join(", ")}
                        </span>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium">{t("pairedPrompt")}</p>
                    <div className="space-y-2">
                      {r.options.map((opt) => {
                        const chosen = opt.position === r.value;
                        return (
                          <div
                            key={opt.position}
                            className={`rounded-md border p-3 text-sm ${
                              chosen ? "border-primary bg-primary/5" : "border-muted"
                            }`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className={chosen ? "font-medium" : "text-muted-foreground"}>
                                {chosen ? `✓ ${opt.text}` : opt.text}
                              </span>
                              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                                {opt.theme_name}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CSV builder — now includes the Farm Owner Report block at the top
// ---------------------------------------------------------------------------

function csvEscape(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function archetypeRow(label: string, a: Archetype | null): string[][] {
  if (!a) return [];
  return [[label, `${a.emoji} ${a.name} — ${a.tagline}`]];
}

function buildSessionCsv(
  userDetail: AdminUserDetail,
  s: AdminSessionDetail,
  t: ReturnType<typeof useTranslations>,
): string {
  const rows: string[][] = [];

  // Header block
  rows.push([t("csvUser"), userDetail.full_name || ""]);
  rows.push([t("csvEmail"), userDetail.email]);
  rows.push([t("sessionIdLabel"), String(s.id)]);
  rows.push([t("csvLanguage"), s.locale]);
  rows.push([t("csvStarted"), s.started_at]);
  rows.push([t("csvCompleted"), s.completed_at ?? ""]);
  rows.push([]);

  // Owner Report block — admin-only narrative
  if (s.primary_archetype) {
    const a = s.primary_archetype;
    rows.push([t("csvSectionOwnerReport")]);
    rows.push(...archetypeRow(t("csvArchetypePrimary"), a));
    if (s.secondary_archetype) {
      rows.push(...archetypeRow(t("csvArchetypeSecondary"), s.secondary_archetype));
    }
    rows.push([t("csvArchetypeTagline"), a.tagline]);
    rows.push([t("csvArchetypeManagement"), a.management]);
    rows.push([t("csvArchetypeBestRole"), a.best_role]);
    rows.push([t("csvArchetypeWrongRole"), a.wrong_role]);
    rows.push([t("csvArchetypeFrustrated"), a.frustrated_by]);
    rows.push([t("csvArchetypeStruggles"), a.struggles_with]);
    rows.push([t("csvArchetypeHiddenTruth"), a.hidden_truth]);
    rows.push([t("csvArchetypeVsOthers"), a.vs_others]);
    rows.push([t("csvArchetypeStrengths"), a.strengths.join(" | ")]);
    rows.push([]);

    // Recommended roles
    rows.push([t("csvSectionRoles")]);
    rows.push([t("csvRoleName"), t("csvRoleReason")]);
    for (const r of s.recommended_roles) {
      rows.push([`${r.emoji} ${r.name}`, r.reason]);
    }
    rows.push([]);
  }

  // Theme rankings
  rows.push([t("csvSectionThemes")]);
  rows.push([t("csvRank"), t("csvThemeCode"), t("csvThemeName"), t("csvScorePct"), t("csvDescription"), t("csvTips")]);
  for (const th of s.all_themes) {
    rows.push([
      String(th.rank),
      th.code,
      th.name,
      String(Math.round(th.score * 100)),
      th.description,
      th.tips.join(" | "),
    ]);
  }
  rows.push([]);

  // Responses transcript
  rows.push([t("csvSectionResponses")]);
  rows.push([
    t("csvOrder"),
    t("csvQuestionCode"),
    t("csvKind"),
    t("csvPrompt"),
    t("csvAnswer"),
    t("csvThemes"),
  ]);
  for (const r of s.responses) {
    if (r.kind === "paired") {
      const chosen = r.chosen_text ?? "";
      const chosenTheme = r.chosen_theme_name ?? "";
      const allOpts = r.options.map((o) => `${o.position === r.value ? "*" : ""}${o.text} (${o.theme_name})`).join(" | ");
      rows.push([
        String(r.order),
        r.question_code,
        t("kindPaired"),
        allOpts,
        chosen,
        chosenTheme,
      ]);
    } else {
      rows.push([
        String(r.order),
        r.question_code,
        t("kindLikert"),
        r.prompt ?? "",
        `${r.value}/5${r.value_label ? " · " + r.value_label : ""}`,
        r.likert_themes.join(" | "),
      ]);
    }
  }

  return rows.map((row) => row.map(csvEscape).join(",")).join("\r\n");
}
