"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { LanguageToggle } from "@/components/language-toggle";
import { useAuth } from "@/lib/auth-context";
import { Sprout } from "lucide-react";

export function Nav() {
  const t = useTranslations("nav");
  const { user, logout } = useAuth();

  return (
    <header className="border-b bg-background/80 backdrop-blur">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold font-serif">
          <Sprout className="h-5 w-5 text-primary" aria-hidden />
          <span>{t("brand")}</span>
        </Link>
        <div className="flex items-center gap-2">
          <LanguageToggle />
          {user ? (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/assessment">{t("takeAssessment")}</Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link href="/profile">{t("profile")}</Link>
              </Button>
              {user.is_admin && (
                <Button asChild variant="ghost" size="sm">
                  <Link href="/admin">{t("admin")}</Link>
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={logout}>
                {t("logout")}
              </Button>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">{t("login")}</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/register">{t("register")}</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
