"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { api, type AssessmentQuestion, type AssessmentStart } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

type Answers = Record<number, number>;

export default function AssessmentPage() {
  const t = useTranslations("assessment");
  const locale = useLocale() as "en" | "es";
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [session, setSession] = useState<AssessmentStart | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [index, setIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (session) return;
    api
      .startAssessment(locale)
      .then(setSession)
      .catch(() => setError(t("loading")));
  }, [authLoading, user, session, locale, router, t]);

  const questions = session?.questions ?? [];
  const current = questions[index];
  const progress = useMemo(() => (questions.length ? ((index) / questions.length) * 100 : 0), [index, questions.length]);
  const isLast = index === questions.length - 1;
  const currentAnswered = current ? answers[current.id] !== undefined : false;

  function setAnswer(qid: number, value: number) {
    setAnswers((prev) => ({ ...prev, [qid]: value }));
  }

  async function finish() {
    if (!session) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        session_id: session.session_id,
        responses: Object.entries(answers).map(([qid, value]) => ({ question_id: Number(qid), value })),
      };
      const result = await api.submitAssessment(payload);
      router.push(`/results?session=${result.session_id}`);
    } catch {
      setError(t("loading"));
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading || !session) {
    return <p className="text-muted-foreground">{t("loading")}</p>;
  }

  if (!current) {
    return <p className="text-muted-foreground">{t("loading")}</p>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-2">
        <h1 className="font-serif text-3xl font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("intro")}</p>
      </div>

      <div className="space-y-2">
        <Progress value={progress} />
        <p className="text-sm text-muted-foreground">
          {t("questionOf", { current: index + 1, total: questions.length })}
        </p>
      </div>

      <QuestionCard
        key={current.id}
        question={current}
        value={answers[current.id]}
        onChange={(v) => setAnswer(current.id, v)}
      />

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0}>
          {t("back")}
        </Button>
        {isLast ? (
          <Button onClick={finish} disabled={!currentAnswered || submitting}>
            {submitting ? t("submitting") : t("finish")}
          </Button>
        ) : (
          <Button onClick={() => setIndex((i) => Math.min(questions.length - 1, i + 1))} disabled={!currentAnswered}>
            {t("next")}
          </Button>
        )}
      </div>
    </div>
  );
}

function QuestionCard({
  question,
  value,
  onChange,
}: {
  question: AssessmentQuestion;
  value: number | undefined;
  onChange: (v: number) => void;
}) {
  const t = useTranslations("assessment");

  if (question.kind === "paired") {
    return (
      <Card>
        <CardContent className="space-y-4 p-6">
          <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">{t("pairedPrompt")}</p>
          <div className="grid gap-3">
            {(question.options ?? []).map((opt) => {
              const selected = value === opt.position;
              return (
                <button
                  key={opt.position}
                  type="button"
                  onClick={() => onChange(opt.position)}
                  className={`rounded-md border-2 p-4 text-left transition hover:border-primary/60 ${
                    selected ? "border-primary bg-primary/5" : "border-input bg-background"
                  }`}
                >
                  <span className="text-base">{opt.text}</span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Likert
  return (
    <Card>
      <CardContent className="space-y-6 p-6">
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">{t("likertPrompt")}</p>
        <p className="text-lg">{question.prompt}</p>
        <div className="grid grid-cols-5 gap-2">
          {[1, 2, 3, 4, 5].map((n) => {
            const selected = value === n;
            return (
              <button
                key={n}
                type="button"
                onClick={() => onChange(n)}
                className={`rounded-md border-2 p-3 text-center transition hover:border-primary/60 ${
                  selected ? "border-primary bg-primary/5" : "border-input bg-background"
                }`}
              >
                <div className="text-lg font-semibold">{n}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {t(`likert.${n}` as "likert.1" | "likert.2" | "likert.3" | "likert.4" | "likert.5")}
                </div>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
