"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/routing";
import { api, type AdminSessionDetail } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export default function AdminSessionDetailPage() {
  const t = useTranslations("admin");
  const locale = useLocale();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const [detail, setDetail] = useState<AdminSessionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    api.adminSessionDetail(id).then(setDetail).catch(() => setError(t("errorLoad")));
  }, [authLoading, user, router, params.id, t]);

  if (error) return <p className="text-destructive">{error}</p>;
  if (!detail) return <p className="text-muted-foreground">{t("loading")}</p>;

  const completed = detail.completed_at ? new Date(detail.completed_at) : null;
  const started = new Date(detail.started_at);

  return (
    <div className="space-y-8">
      <div>
        <Button asChild variant="ghost" size="sm">
          <Link href={`/admin/users/${detail.user.id}`}>← {t("backToUser")}</Link>
        </Button>
      </div>

      <div className="space-y-2">
        <h1 className="font-serif text-3xl font-semibold md:text-4xl">
          {detail.user.full_name || detail.user.email}
        </h1>
        <p className="text-muted-foreground">
          {detail.user.email} · {t("sessionIdLabel")} #{detail.id} · {detail.locale.toUpperCase()}
        </p>
        <p className="text-sm text-muted-foreground">
          {completed
            ? `${t("completedAt")} ${completed.toLocaleString(locale)}`
            : `${t("inProgress")} · ${started.toLocaleString(locale)}`}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-2xl">{t("allThemesTitle")}</CardTitle>
          <CardDescription>{t("allThemesSubtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {detail.all_themes.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noScoresYet")}</p>
          ) : (
            detail.all_themes.map((theme) => (
              <div key={theme.code} className="space-y-2 rounded-md border p-4">
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

      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-2xl">{t("responsesTitle")}</CardTitle>
          <CardDescription>{t("responsesSubtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {detail.responses.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noResponsesYet")}</p>
          ) : (
            detail.responses.map((r) => (
              <div key={r.question_id} className="space-y-2 rounded-md border p-4">
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
