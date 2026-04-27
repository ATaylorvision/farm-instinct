import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Sprout, ClipboardList, Trophy } from "lucide-react";

export default async function LandingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("landing");

  return (
    <div className="space-y-16">
      <section className="grid gap-6 py-8 md:py-12">
        <h1 className="font-serif text-4xl font-bold tracking-tight md:text-6xl">{t("tagline")}</h1>
        <p className="max-w-2xl text-lg text-muted-foreground md:text-xl">{t("subtitle")}</p>
        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/register">{t("cta")}</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/login">{t("ctaSecondary")}</Link>
          </Button>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="font-serif text-2xl font-semibold md:text-3xl">{t("how.title")}</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Step icon={<ClipboardList className="h-6 w-6" />} title={t("how.step1Title")} body={t("how.step1Body")} />
          <Step icon={<Sprout className="h-6 w-6" />} title={t("how.step2Title")} body={t("how.step2Body")} />
          <Step icon={<Trophy className="h-6 w-6" />} title={t("how.step3Title")} body={t("how.step3Body")} />
        </div>
      </section>
    </div>
  );
}

function Step({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
        {icon}
      </div>
      <h3 className="mb-2 text-lg font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
