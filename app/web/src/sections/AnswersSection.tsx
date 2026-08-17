import { useState } from "react";
import { PlusIcon, PencilSimpleIcon, LockIcon, ListPlusIcon, CheckIcon, XIcon } from "@phosphor-icons/react";
import { FormattedMessage, useIntl } from "react-intl";
import { useResource } from "@/hooks/useResource";
import { useLiveTable } from "@/hooks/useLiveTable";
import { api, post } from "@/lib/api";
import { LoadingState } from "@/components/common/LoadingState";
import { ErrorState } from "@/components/common/ErrorState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ApplicantAnswer } from "@/types";

const CATEGORIES = ["contact", "eligibility", "links", "eeo", "custom"];

const CATEGORY_I18N: Record<string, string> = {
  contact: "answers.categories.contact",
  links: "answers.categories.links",
  eligibility: "answers.categories.eligibility",
  eeo: "answers.categories.eeo",
  custom: "answers.categories.custom",
};

export function AnswersSection() {
  const intl = useIntl();
  const answers = useResource<ApplicantAnswer[]>(() => api<ApplicantAnswer[]>("answers"), []);
  useLiveTable("applicant_answers", answers.reload);

  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  // New answer form
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newCategory, setNewCategory] = useState("contact");
  const [addError, setAddError] = useState("");

  function startEdit(a: ApplicantAnswer) {
    setDrafts((prev) => ({ ...prev, [a.key]: a.value ?? "" }));
  }

  function cancelEdit(a: ApplicantAnswer) {
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[a.key];
      return next;
    });
  }

  async function saveEdit(a: ApplicantAnswer) {
    setSaving((prev) => ({ ...prev, [a.key]: true }));
    try {
      await post("answer", { key: a.key, value: drafts[a.key], category: a.category });
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[a.key];
        return next;
      });
      answers.reload();
    } finally {
      setSaving((prev) => ({ ...prev, [a.key]: false }));
    }
  }

  async function handleAddAnswer() {
    setAddError("");
    const key = newKey.trim();
    if (!key) {
      setAddError(intl.formatMessage({ id: "answers.keyRequired", defaultMessage: "Key is required." }));
      return;
    }
    try {
      await post("answer", { key, value: newValue, category: newCategory });
      setNewKey("");
      setNewValue("");
      setNewCategory("contact");
      answers.reload();
    } catch (e: unknown) {
      setAddError(e instanceof Error ? e.message : intl.formatMessage({ id: "answers.saveFailed", defaultMessage: "Failed to save." }));
    }
  }

  const list = answers.data ?? [];
  const grouped: Record<string, ApplicantAnswer[]> = {};
  for (const a of list) {
    (grouped[a.category] ??= []).push(a);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          <FormattedMessage id="answers.title" defaultMessage="Answers" />
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          <FormattedMessage
            id="answers.subtitle"
            defaultMessage="Reusable application answers — portal-filler fills external ATS forms from these. EEO answers are never auto-filled."
          />
        </p>
      </div>

      {answers.status === "loading" && <LoadingState />}
      {answers.status === "error" && <ErrorState error={answers.error} onretry={answers.reload} />}

      {answers.status === "ready" && (
        <>
          {/* Add New Answer */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-xs space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              <div className="sm:col-span-4 space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <FormattedMessage id="answers.key" defaultMessage="Key" />
                </label>
                <Input
                  placeholder={intl.formatMessage({ id: "answers.keyPlaceholder", defaultMessage: "e.g. portfolio_url" })}
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                />
              </div>
              <div className="sm:col-span-5 space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <FormattedMessage id="answers.value" defaultMessage="Value" />
                </label>
                <Input
                  placeholder={intl.formatMessage({ id: "answers.valuePlaceholder", defaultMessage: "Value to insert" })}
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                />
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <FormattedMessage id="answers.category" defaultMessage="Category" />
                </label>
                <Select value={newCategory} onValueChange={(val) => setNewCategory(val || "contact")}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={intl.formatMessage({ id: "answers.category", defaultMessage: "Category" })} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contact">
                      <FormattedMessage id="answers.categories.contact" defaultMessage="Contact" />
                    </SelectItem>
                    <SelectItem value="links">
                      <FormattedMessage id="answers.categories.links" defaultMessage="Links" />
                    </SelectItem>
                    <SelectItem value="eligibility">
                      <FormattedMessage id="answers.categories.eligibility" defaultMessage="Eligibility" />
                    </SelectItem>
                    <SelectItem value="custom">
                      <FormattedMessage id="answers.categories.custom" defaultMessage="Custom" />
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-1">
                <Button onClick={handleAddAnswer} className="w-full">
                  <PlusIcon className="size-4" />
                </Button>
              </div>
            </div>
            {addError && <p className="text-xs text-destructive">{addError}</p>}
          </div>

          {list.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-10 text-center text-muted-foreground shadow-xs">
              <FormattedMessage
                id="answers.empty"
                defaultMessage="No answers yet. Add your contact details, links, and eligibility above."
              />
            </div>
          ) : (
            <div className="space-y-8">
              {CATEGORIES.map((cat) => {
                const rows = grouped[cat] ?? [];
                const isEeo = cat === "eeo";
                if (!rows.length && cat !== "custom") return null;
                const catLabel = intl.formatMessage({
                  id: CATEGORY_I18N[cat] ?? `answers.categories.${cat}`,
                  defaultMessage: cat,
                });

                return (
                  <section key={cat} className={isEeo ? "opacity-80" : ""}>
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{catLabel}</h3>
                      {isEeo && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-border bg-muted/60 text-[0.65rem] font-semibold text-muted-foreground">
                          <LockIcon className="size-3" />
                          <span>
                            <FormattedMessage
                              id="answers.eeoWarning"
                              defaultMessage="HUMAN-ONLY — NEVER AUTO-FILLED"
                            />
                          </span>
                        </span>
                      )}
                    </div>

                    {rows.length > 0 ? (
                      <div
                        className={`rounded-xl border bg-card overflow-hidden divide-y divide-border/60 shadow-xs ${
                          isEeo ? "border-dashed border-border" : "border-border"
                        }`}
                      >
                        {rows.map((a) => {
                          const isEditing = a.key in drafts;
                          return (
                            <div
                              key={a.key}
                              className={`flex items-center px-4 py-3 text-xs transition-colors group ${
                                isEditing ? "bg-muted/30" : "hover:bg-muted/10"
                              }`}
                            >
                              <div className="w-[30%] pr-3">
                                <span className="font-mono text-muted-foreground">{a.key}</span>
                              </div>

                              <div className="flex-1 pr-4">
                                {isEditing ? (
                                  <Input
                                    value={drafts[a.key] ?? ""}
                                    onChange={(e) =>
                                      setDrafts((prev) => ({ ...prev, [a.key]: e.target.value }))
                                    }
                                    className="h-7 text-xs"
                                  />
                                ) : (
                                  <span
                                    className={
                                      a.value
                                        ? isEeo
                                          ? "text-muted-foreground italic font-mono"
                                          : "text-foreground font-medium"
                                        : "text-muted-foreground/60"
                                    }
                                  >
                                    {a.value || "—"}
                                  </span>
                                )}
                              </div>

                              <div className="w-16 flex justify-end">
                                {isEditing ? (
                                  <div className="flex items-center gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon-xs"
                                      onClick={() => cancelEdit(a)}
                                      title={intl.formatMessage({ id: "common.cancel", defaultMessage: "Cancel" })}
                                    >
                                      <XIcon className="size-3.5" />
                                    </Button>
                                    <Button
                                      size="icon-xs"
                                      onClick={() => saveEdit(a)}
                                      disabled={saving[a.key]}
                                      title={intl.formatMessage({ id: "common.save", defaultMessage: "Save" })}
                                    >
                                      <CheckIcon className="size-3.5" />
                                    </Button>
                                  </div>
                                ) : (
                                  <Button
                                    variant="ghost"
                                    size="icon-xs"
                                    onClick={() => startEdit(a)}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <PencilSimpleIcon className="size-3.5" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-border bg-card p-6 flex flex-col items-center justify-center text-center text-muted-foreground shadow-xs">
                        <ListPlusIcon className="size-6 text-muted-foreground/60 mb-2" />
                        <p className="text-xs">
                          <FormattedMessage
                            id="answers.emptyCustom"
                            defaultMessage="No custom answers added yet."
                          />
                        </p>
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

