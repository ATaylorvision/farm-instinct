"use client";

import { FormEvent, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/routing";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth-context";

export default function RegisterPage() {
  const t = useTranslations("auth");
  const locale = useLocale() as "en" | "es";
  const router = useRouter();
  const { register } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await register({ email, password, full_name: fullName || undefined, preferred_locale: locale });
      router.push("/assessment");
    } catch (err) {
      const status = (err as { status?: number }).status;
      setError(status === 409 ? t("errorExists") : t("errorGeneric"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>{t("registerTitle")}</CardTitle>
          <CardDescription>{t("registerSubtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">{t("fullNameOptional")}</Label>
              <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t("email")}</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t("password")}</Label>
              <Input id="password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={submitting} className="w-full">
              {t("submitRegister")}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              {t("haveAccount")}{" "}
              <Link href="/login" className="text-primary underline-offset-4 hover:underline">
                {t("loginInstead")}
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
