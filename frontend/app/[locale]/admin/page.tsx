"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { api, type AdminUserSummary } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminUsersPage() {
  const t = useTranslations("admin");
  const locale = useLocale();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<AdminUserSummary[] | null>(null);
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
    api.adminListUsers().then(setUsers).catch(() => setError(t("errorLoad")));
  }, [authLoading, user, router, t]);

  if (authLoading) {
    return <p className="text-muted-foreground">{t("loading")}</p>;
  }

  if (error) {
    return <p className="text-destructive">{error}</p>;
  }

  if (!users) {
    return <p className="text-muted-foreground">{t("loading")}</p>;
  }

  const completedUsers = users.filter((u) => u.session_count > 0).length;
  const totalSessions = users.reduce((sum, u) => sum + u.session_count, 0);

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="font-serif text-3xl font-semibold md:text-4xl">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard label={t("statUsers")} value={users.length} />
        <StatCard label={t("statCompleted")} value={completedUsers} />
        <StatCard label={t("statSessions")} value={totalSessions} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-2xl">{t("tableTitle")}</CardTitle>
          <CardDescription>{t("tableSubtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3">{t("colUser")}</th>
                  <th className="py-2 pr-3">{t("colEmail")}</th>
                  <th className="py-2 pr-3">{t("colSessions")}</th>
                  <th className="py-2 pr-3">{t("colTopTheme")}</th>
                  <th className="py-2 pr-3">{t("colLastCompleted")}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {users.map((u) => (
                  <tr
                    key={u.id}
                    role="link"
                    tabIndex={0}
                    onClick={() => router.push(`/admin/users/${u.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        router.push(`/admin/users/${u.id}`);
                      }
                    }}
                    className="cursor-pointer transition hover:bg-accent/10"
                    title={t("rowClickHint")}
                  >
                    <td className="py-3 pr-3">
                      <span className="font-medium text-primary">{u.full_name || u.email}</span>
                      {u.is_admin && (
                        <span className="ml-2 rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
                          {t("adminBadge")}
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-3 text-muted-foreground">{u.email}</td>
                    <td className="py-3 pr-3">{u.session_count}</td>
                    <td className="py-3 pr-3">{u.top_theme_name ?? "—"}</td>
                    <td className="py-3 pr-3 text-muted-foreground">
                      {u.last_completed_at
                        ? new Date(u.last_completed_at).toLocaleDateString(locale)
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">{t("rowClickHint")}</p>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="mt-2 font-serif text-4xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}
