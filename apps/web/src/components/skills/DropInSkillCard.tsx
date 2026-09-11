import {
  ArrowRightIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  ChevronUpIcon,
  DownloadIcon,
  FileCodeIcon,
  GlobeIcon,
  Loader2Icon,
  PlusIcon,
  SparklesIcon,
} from "lucide-react";
import { useState } from "react";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { parseCustomSkillInput, type SkillItem } from "./skillsRegistry";

interface DropInSkillCardProps {
  readonly onInstallCustom: (skill: SkillItem, rawContent?: string) => Promise<void>;
}

export function DropInSkillCard({ onInstallCustom }: DropInSkillCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<"url" | "paste">("url");
  const [inputValue, setInputValue] = useState("");
  const [customName, setCustomName] = useState("");
  const [installing, setInstalling] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    readonly type: "success" | "error";
    readonly message: string;
  } | null>(null);

  const parsed = inputValue.trim() ? parseCustomSkillInput(inputValue) : null;
  const effectiveId = (customName.trim() || parsed?.inferredId || "custom-skill")
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-");

  const handleInstall = async () => {
    if (!inputValue.trim()) return;
    setInstalling(true);
    setStatusMessage(null);

    try {
      if (mode === "url" && parsed?.url) {
        // Fetch URL content to verify
        const res = await fetch(parsed.url, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) {
          throw new Error(`Could not fetch SKILL.md from ${parsed.url} (Status: ${res.status})`);
        }
        const text = await res.text();
        const customSkill: SkillItem = {
          id: effectiveId,
          name: effectiveId,
          displayName: effectiveId,
          description: parsed.inferredDescription,
          category: "development",
          tags: ["custom"],
          source: "custom",
          rawUrl: parsed.url,
        };
        await onInstallCustom(customSkill, text);
      } else {
        // Pasted markdown
        const text = inputValue.trim();
        const customSkill: SkillItem = {
          id: effectiveId,
          name: effectiveId,
          displayName: effectiveId,
          description: parsed?.inferredDescription || "Custom installed skill",
          category: "development",
          tags: ["custom"],
          source: "custom",
        };
        await onInstallCustom(customSkill, text);
      }

      setStatusMessage({
        type: "success",
        message: `Successfully installed skill '${effectiveId}' into .agents/skills/${effectiveId}/SKILL.md!`,
      });
      setInputValue("");
      setCustomName("");
    } catch (err) {
      setStatusMessage({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to install custom skill.",
      });
    } finally {
      setInstalling(false);
    }
  };

  return (
    <div className="rounded-xl border border-dashed border-border/80 bg-muted/15 p-4 transition-all duration-200">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center justify-between text-left"
      >
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <PlusIcon className="size-4" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
              Drop in / Install Custom Skill
              <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-normal text-primary">
                GitHub & SkillsLLM & Raw MD
              </span>
            </h4>
            <p className="text-xs text-muted-foreground">
              Install any skill by GitHub repository URL, SkillsLLM link, or paste SKILL.md
              directly.
            </p>
          </div>
        </div>
        <div className="text-muted-foreground hover:text-foreground">
          {isOpen ? <ChevronUpIcon className="size-4" /> : <ChevronDownIcon className="size-4" />}
        </div>
      </button>

      {isOpen ? (
        <div className="mt-4 border-t border-border/40 pt-4 space-y-3">
          {/* Mode toggle */}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="xs"
              variant={mode === "url" ? "default" : "outline"}
              onClick={() => {
                setMode("url");
                setStatusMessage(null);
              }}
              className="gap-1.5 text-xs"
            >
              <GlobeIcon className="size-3.5" />
              From GitHub / URL
            </Button>
            <Button
              type="button"
              size="xs"
              variant={mode === "paste" ? "default" : "outline"}
              onClick={() => {
                setMode("paste");
                setStatusMessage(null);
              }}
              className="gap-1.5 text-xs"
            >
              <FileCodeIcon className="size-3.5" />
              Paste SKILL.md
            </Button>
          </div>

          {mode === "url" ? (
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground block">
                GitHub or Raw SKILL.md URL
              </label>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g. https://github.com/rmyndharis/antigravity-skills/tree/main/skills/fastapi-pro"
                  value={inputValue}
                  onChange={(e) => {
                    setInputValue(e.target.value);
                    setStatusMessage(null);
                  }}
                  className="text-xs font-mono h-9"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Paste any GitHub repo, folder, or raw file URL. We will resolve and install{" "}
                <code className="font-mono">SKILL.md</code>.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground block">
                Raw SKILL.md Content
              </label>
              <Textarea
                placeholder="Paste full SKILL.md content here (including YAML frontmatter)..."
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  setStatusMessage(null);
                }}
                rows={5}
                className="text-xs font-mono resize-y"
              />
            </div>
          )}

          {/* Inferred preview & Custom ID override */}
          {parsed && inputValue.trim() ? (
            <div className="rounded-lg border border-border/50 bg-background/60 p-3 space-y-2 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <SparklesIcon className="size-3.5 text-primary" />
                  <span className="font-medium text-foreground">Inferred Skill ID:</span>
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-primary font-semibold">
                    {effectiveId}
                  </code>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-[11px]">Custom ID:</span>
                  <Input
                    placeholder={effectiveId}
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    className="h-6 w-36 text-[11px] font-mono"
                  />
                </div>
              </div>
              <div className="text-[11px] text-muted-foreground">
                Will install to:{" "}
                <code className="font-mono">.agents/skills/{effectiveId}/SKILL.md</code>
              </div>
            </div>
          ) : null}

          {statusMessage ? (
            <div
              className={`rounded-lg p-3 text-xs flex items-center gap-2 ${
                statusMessage.type === "success"
                  ? "bg-success/10 text-success border border-success/30"
                  : "bg-destructive/10 text-destructive border border-destructive/30"
              }`}
            >
              {statusMessage.type === "success" ? (
                <CheckCircle2Icon className="size-4 shrink-0" />
              ) : null}
              <span>{statusMessage.message}</span>
            </div>
          ) : null}

          <div className="flex justify-end pt-1">
            <Button
              size="sm"
              disabled={!inputValue.trim() || installing}
              onClick={handleInstall}
              className="gap-1.5 text-xs"
            >
              {installing ? (
                <>
                  <Loader2Icon className="size-3.5 animate-spin" />
                  Installing...
                </>
              ) : (
                <>
                  <DownloadIcon className="size-3.5" />
                  Install Skill
                </>
              )}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
