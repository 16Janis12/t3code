import {
  type AutomationAction,
  type AutomationGitHubIssueEvent,
  type AutomationGitHubPrEvent,
  type AutomationTrigger,
  type T3ProjectFileAutomation,
} from "@t3tools/contracts";
import { BotIcon, ClockIcon, GitPullRequestIcon, CircleDotIcon, TerminalIcon } from "lucide-react";
import React, { useEffect, useState } from "react";

import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";

const PR_EVENTS: Array<{ id: AutomationGitHubPrEvent; label: string }> = [
  { id: "opened", label: "Opened" },
  { id: "synchronize", label: "Synchronize (Pushed)" },
  { id: "closed", label: "Closed" },
  { id: "merged", label: "Merged" },
  { id: "reopened", label: "Reopened" },
  { id: "review_requested", label: "Review Requested" },
];

const ISSUE_EVENTS: Array<{ id: AutomationGitHubIssueEvent; label: string }> = [
  { id: "opened", label: "Opened" },
  { id: "closed", label: "Closed" },
  { id: "reopened", label: "Reopened" },
  { id: "labeled", label: "Labeled" },
  { id: "assigned", label: "Assigned" },
];

const CRON_PRESETS = [
  { label: "Hourly", value: "@hourly" },
  { label: "Daily (Midnight)", value: "@daily" },
  { label: "Weekdays 9 AM", value: "0 9 * * 1-5" },
  { label: "Every 15 mins", value: "*/15 * * * *" },
];

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export interface ProjectAutomationEditorDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly automation: T3ProjectFileAutomation | null;
  readonly existingIds: ReadonlyArray<string>;
  readonly onSave: (automation: T3ProjectFileAutomation) => void;
}

export function ProjectAutomationEditorDialog({
  open,
  onOpenChange,
  automation,
  existingIds,
  onSave,
}: ProjectAutomationEditorDialogProps) {
  const isEditing = automation !== null;

  const [name, setName] = useState("");
  const [id, setId] = useState("");
  const [idManuallyEdited, setIdManuallyEdited] = useState(false);
  const [enabled, setEnabled] = useState(true);

  const [triggerType, setTriggerType] = useState<"cron" | "github_pr" | "github_issue">("cron");
  const [cronSchedule, setCronSchedule] = useState("0 9 * * 1-5");
  const [prEvents, setPrEvents] = useState<AutomationGitHubPrEvent[]>(["opened", "synchronize"]);
  const [prBranches, setPrBranches] = useState("");
  const [issueEvents, setIssueEvents] = useState<AutomationGitHubIssueEvent[]>(["opened"]);
  const [issueLabels, setIssueLabels] = useState("");

  const [actionType, setActionType] = useState<"thread" | "script">("thread");
  const [threadTitle, setThreadTitle] = useState("");
  const [threadPrompt, setThreadPrompt] = useState("");
  const [scriptCommand, setScriptCommand] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    if (automation) {
      setName(automation.name);
      setId(automation.id);
      setIdManuallyEdited(true);
      setEnabled(automation.enabled ?? true);

      if (automation.trigger.type === "cron") {
        setTriggerType("cron");
        setCronSchedule(automation.trigger.schedule);
      } else if (automation.trigger.type === "github_pr") {
        setTriggerType("github_pr");
        setPrEvents(
          automation.trigger.events ? [...automation.trigger.events] : ["opened", "synchronize"],
        );
        setPrBranches(automation.trigger.targetBranches?.join(", ") ?? "");
      } else if (automation.trigger.type === "github_issue") {
        setTriggerType("github_issue");
        setIssueEvents(automation.trigger.events ? [...automation.trigger.events] : ["opened"]);
        setIssueLabels(automation.trigger.labels?.join(", ") ?? "");
      }

      if (automation.action.type === "thread") {
        setActionType("thread");
        setThreadTitle(automation.action.title ?? "");
        setThreadPrompt(automation.action.prompt);
      } else {
        setActionType("script");
        setScriptCommand(automation.action.command ?? "");
      }
    } else {
      setName("");
      setId("");
      setIdManuallyEdited(false);
      setEnabled(true);
      setTriggerType("cron");
      setCronSchedule("0 9 * * 1-5");
      setPrEvents(["opened", "synchronize"]);
      setPrBranches("");
      setIssueEvents(["opened"]);
      setIssueLabels("");
      setActionType("thread");
      setThreadTitle("");
      setThreadPrompt("Analyze recent repository activity and generate a status update.");
      setScriptCommand("npm test");
    }
    setErrorMessage(null);
  }, [open, automation]);

  const handleNameChange = (val: string) => {
    setName(val);
    if (!idManuallyEdited && !isEditing) {
      setId(slugify(val));
    }
  };

  const handleInsertVariable = (variable: string) => {
    setThreadPrompt((prev) => `${prev} \${${variable}}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = name.trim();
    const trimmedId = id.trim() || slugify(trimmedName);

    if (!trimmedName) {
      setErrorMessage("Please enter an automation name.");
      return;
    }
    if (!trimmedId) {
      setErrorMessage("Please enter a valid unique ID.");
      return;
    }
    if ((!isEditing || trimmedId !== automation.id) && existingIds.includes(trimmedId)) {
      setErrorMessage(`An automation with ID "${trimmedId}" already exists.`);
      return;
    }

    let trigger: AutomationTrigger;
    if (triggerType === "cron") {
      const schedule = cronSchedule.trim();
      if (!schedule) {
        setErrorMessage("Please specify a cron schedule.");
        return;
      }
      trigger = { type: "cron", schedule };
    } else if (triggerType === "github_pr") {
      if (prEvents.length === 0) {
        setErrorMessage("Please select at least one PR event.");
        return;
      }
      const branches = prBranches
        .split(",")
        .map((b) => b.trim())
        .filter(Boolean);
      trigger = {
        type: "github_pr",
        events: prEvents,
        ...(branches.length > 0 ? { targetBranches: branches } : {}),
      };
    } else {
      if (issueEvents.length === 0) {
        setErrorMessage("Please select at least one Issue event.");
        return;
      }
      const labels = issueLabels
        .split(",")
        .map((l) => l.trim())
        .filter(Boolean);
      trigger = {
        type: "github_issue",
        events: issueEvents,
        ...(labels.length > 0 ? { labels } : {}),
      };
    }

    let action: AutomationAction;
    if (actionType === "thread") {
      const prompt = threadPrompt.trim();
      if (!prompt) {
        setErrorMessage("Please enter a prompt template for the thread.");
        return;
      }
      const title = threadTitle.trim();
      action = {
        type: "thread",
        prompt,
        ...(title ? { title } : {}),
      };
    } else {
      const command = scriptCommand.trim();
      if (!command) {
        setErrorMessage("Please enter a shell command to execute.");
        return;
      }
      action = {
        type: "script",
        command,
      };
    }

    const payload: T3ProjectFileAutomation = {
      id: trimmedId,
      name: trimmedName,
      enabled,
      trigger,
      action,
    };

    onSave(payload);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Automation" : "Add Automation"}</DialogTitle>
          <DialogDescription>
            Automations are stored in <code className="font-mono text-xs">t3.json</code> at your
            project root.
          </DialogDescription>
        </DialogHeader>

        <DialogPanel>
          <form id="automation-editor-form" onSubmit={handleSubmit} className="space-y-4">
            {errorMessage ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                {errorMessage}
              </div>
            ) : null}

            {/* General Info */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="automation-name">Name</Label>
                <Input
                  id="automation-name"
                  placeholder="e.g. PR Code Review"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="automation-id">ID (slug)</Label>
                <Input
                  id="automation-id"
                  placeholder="pr-code-review"
                  value={id}
                  onChange={(e) => {
                    setId(e.target.value);
                    setIdManuallyEdited(true);
                  }}
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
              <div className="space-y-0.5">
                <span className="text-sm font-medium">Enable Automation</span>
                <p className="text-xs text-muted-foreground">
                  When enabled, this automation actively listens for events.
                </p>
              </div>
              <Switch checked={enabled} onCheckedChange={setEnabled} />
            </div>

            {/* Trigger Selection */}
            <div className="space-y-2 pt-1">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Trigger
              </Label>
              <div className="grid grid-cols-3 gap-1.5 rounded-lg border border-border/60 bg-muted/40 p-1">
                <button
                  type="button"
                  className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-colors ${
                    triggerType === "cron"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => setTriggerType("cron")}
                >
                  <ClockIcon className="size-3.5" />
                  Cron Schedule
                </button>
                <button
                  type="button"
                  className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-colors ${
                    triggerType === "github_pr"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => setTriggerType("github_pr")}
                >
                  <GitPullRequestIcon className="size-3.5" />
                  GitHub PR
                </button>
                <button
                  type="button"
                  className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-colors ${
                    triggerType === "github_issue"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => setTriggerType("github_issue")}
                >
                  <CircleDotIcon className="size-3.5" />
                  GitHub Issue
                </button>
              </div>

              {triggerType === "cron" && (
                <div className="space-y-2 rounded-lg border border-border/60 p-3">
                  <Label htmlFor="cron-schedule" className="text-xs">
                    Cron Expression
                  </Label>
                  <Input
                    id="cron-schedule"
                    placeholder="0 9 * * 1-5"
                    value={cronSchedule}
                    onChange={(e) => setCronSchedule(e.target.value)}
                    className="font-mono text-xs"
                  />
                  <div className="flex flex-wrap gap-1 pt-1">
                    {CRON_PRESETS.map((preset) => (
                      <button
                        key={preset.value}
                        type="button"
                        className="rounded border border-border/60 bg-muted/50 px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground"
                        onClick={() => setCronSchedule(preset.value)}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {triggerType === "github_pr" && (
                <div className="space-y-3 rounded-lg border border-border/60 p-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">PR Events</Label>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {PR_EVENTS.map((event) => {
                        const isChecked = prEvents.includes(event.id);
                        return (
                          <label
                            key={event.id}
                            className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
                          >
                            <Checkbox
                              checked={isChecked}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setPrEvents((prev) => [...prev, event.id]);
                                } else {
                                  setPrEvents((prev) => prev.filter((e) => e !== event.id));
                                }
                              }}
                            />
                            <span>{event.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="pr-branches" className="text-xs">
                      Target Branches (optional)
                    </Label>
                    <Input
                      id="pr-branches"
                      placeholder="main, production (comma separated)"
                      value={prBranches}
                      onChange={(e) => setPrBranches(e.target.value)}
                      className="text-xs"
                    />
                  </div>
                </div>
              )}

              {triggerType === "github_issue" && (
                <div className="space-y-3 rounded-lg border border-border/60 p-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Issue Events</Label>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {ISSUE_EVENTS.map((event) => {
                        const isChecked = issueEvents.includes(event.id);
                        return (
                          <label
                            key={event.id}
                            className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
                          >
                            <Checkbox
                              checked={isChecked}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setIssueEvents((prev) => [...prev, event.id]);
                                } else {
                                  setIssueEvents((prev) => prev.filter((e) => e !== event.id));
                                }
                              }}
                            />
                            <span>{event.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="issue-labels" className="text-xs">
                      Labels Filter (optional)
                    </Label>
                    <Input
                      id="issue-labels"
                      placeholder="bug, agent-ready (comma separated)"
                      value={issueLabels}
                      onChange={(e) => setIssueLabels(e.target.value)}
                      className="text-xs"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Action Selection */}
            <div className="space-y-2 pt-1">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Action
              </Label>
              <div className="grid grid-cols-2 gap-1.5 rounded-lg border border-border/60 bg-muted/40 p-1">
                <button
                  type="button"
                  className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-colors ${
                    actionType === "thread"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => setActionType("thread")}
                >
                  <BotIcon className="size-3.5" />
                  Agent Thread
                </button>
                <button
                  type="button"
                  className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-colors ${
                    actionType === "script"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => setActionType("script")}
                >
                  <TerminalIcon className="size-3.5" />
                  Run Script / Command
                </button>
              </div>

              {actionType === "thread" && (
                <div className="space-y-3 rounded-lg border border-border/60 p-3">
                  <div className="space-y-1">
                    <Label htmlFor="thread-title" className="text-xs">
                      Thread Title Template (optional)
                    </Label>
                    <Input
                      id="thread-title"
                      placeholder="e.g. Review PR #${pr.number}: ${pr.title}"
                      value={threadTitle}
                      onChange={(e) => setThreadTitle(e.target.value)}
                      className="text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="thread-prompt" className="text-xs">
                      Prompt Template
                    </Label>
                    <Textarea
                      id="thread-prompt"
                      rows={3}
                      placeholder="Please review the changes in pull request #${pr.number}."
                      value={threadPrompt}
                      onChange={(e) => setThreadPrompt(e.target.value)}
                      className="text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] text-muted-foreground">Available Variables:</span>
                    <div className="flex flex-wrap gap-1">
                      {[
                        "pr.number",
                        "pr.title",
                        "pr.headRefName",
                        "pr.baseRefName",
                        "issue.number",
                        "issue.title",
                        "event.type",
                        "project.title",
                      ].map((v) => (
                        <button
                          key={v}
                          type="button"
                          className="rounded border border-border/60 bg-muted/40 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground hover:bg-accent hover:text-foreground"
                          onClick={() => handleInsertVariable(v)}
                        >
                          ${`{${v}}`}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {actionType === "script" && (
                <div className="space-y-2 rounded-lg border border-border/60 p-3">
                  <Label htmlFor="script-command" className="text-xs">
                    Shell Command
                  </Label>
                  <Input
                    id="script-command"
                    placeholder="npm test"
                    value={scriptCommand}
                    onChange={(e) => setScriptCommand(e.target.value)}
                    className="font-mono text-xs"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Executed at the project root directory when the trigger fires.
                  </p>
                </div>
              )}
            </div>
          </form>
        </DialogPanel>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" type="button" />}>Cancel</DialogClose>
          <Button form="automation-editor-form" type="submit">
            {isEditing ? "Save Changes" : "Create Automation"}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
