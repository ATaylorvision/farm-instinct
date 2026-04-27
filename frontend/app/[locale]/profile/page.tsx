"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/routing";
import { api, type AssessmentResult } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ProfilePage() {
  const t = useTranslations("profile");
  const locale = useLocale();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [history, setHistory] = useState<AssessmentResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    api.history().then(setHistory).catch(() => setError(t("errorLoad")));
  }, [authLoading, user, router, t]);

  if (authLoading || (!history && !error)) {
    return <p className="text-muted-foreground">{t("loading")}</p>;
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="font-serif text-3xl font-semibold md:text-4xl">{t("title")}</h1>
        {user && (
          <p className="text-muted-foreground">
            {user.full_name ? `${user.full_name} · ` : ""}{user.email}
          </p>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-2xl">{t("historyTitle")}</CardTitle>
          <CardDescription>{t("historySubtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {error && <p className="text-sm text-destructive">{error}</p>}
          {history && history.length === 0 && (
            <div className="flex flex-col items-start gap-3">
              <p className="text-sm text-muted-foreground">{t("empty")}</p>
              <Button asChild>
                <Link href="/assessment">{t("startNew")}</Link>
              </Button>
            </div>
          )}
          {history && history.length > 0 && (
            <div className="divide-y rounded-md border">
              {history.map((result) => {
                const date = result.completed_at ? new Date(result.completed_at) : null;
                const top3 = result.top.slice(0, 3);
                return (
                  <Link
                    key={result.session_id}
                    href={`/results?session=${result.session_id}`}
                    className="flex flex-col gap-1 p-4 transition hover:bg-accent/5 md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <div className="font-medium">
                        {date ? date.toLocaleDateString(locale, { year: "numeric", month: "long", day: "numeric" }) : t("inProgress")}
                      </div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">
                        {date ? date.toLocaleTimeString(locale) : ""} · {result.locale.toUpperCase()}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {top3.map((theme) => (
                        <span key={theme.code} className="rounded-full border bg-secondary/60 px-3 py-1 text-xs font-medium">
                          #{theme.rank} {theme.name}
                        </span>
                      ))}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
          {history && history.length > 0 && (
            <div className="pt-2">
              <Button asChild variant="outline">
                <Link href="/assessment">{t("retake")}</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
