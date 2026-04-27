"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/routing";
import { Button } from "@/components/ui/button";

export function LanguageToggle() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("nav");

  const other = locale === "en" ? "es" : "en";
  // Language names are shown in their own language by convention
  const label = other === "es" ? "Español" : "English";

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => router.replace(pathname, { locale: other })}
      aria-label={t("switchLanguageTo", { lang: label })}
    >
      {label}
    </Button>
  );
}
