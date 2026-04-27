import { getRequestConfig } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = routing.locales.includes(requested as "en" | "es") ? (requested as "en" | "es") : routing.defaultLocale;
  if (!locale) notFound();

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
