import * as Schema from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";

import { ThreadEnvMode } from "./environment.ts";
import { ModelSelection, ProjectScriptIcon, RuntimeMode } from "./orchestration.ts";

/** File name of the checked-in T3 project file, resolved at the workspace root. */
export const T3_PROJECT_FILE_NAME = "t3.json";

/** Public URL of the published JSON Schema for {@link T3ProjectFile}. */
export const T3_PROJECT_FILE_SCHEMA_URL = "https://t3.codes/schema/t3.json";

const T3_PROJECT_FILE_PATH_MAX_LENGTH = 512;
const T3_PROJECT_FILE_MAX_SCRIPTS = 50;
const T3_PROJECT_FILE_MAX_AUTOMATIONS = 50;
const T3_PROJECT_FILE_MAX_JOBS = 50;

// Annotations go on the encoded (string) side so they survive into the
// published JSON Schema; decoding still trims and re-validates non-emptiness.
const trimmedNonEmpty = (annotations: { readonly description: string }, maxLength?: number) => {
  const annotated = Schema.String.annotate(annotations);
  const encoded =
    maxLength === undefined
      ? annotated.check(Schema.isNonEmpty())
      : annotated.check(Schema.isNonEmpty(), Schema.isMaxLength(maxLength));
  return encoded.pipe(Schema.decodeTo(encoded, SchemaTransformation.trim()));
};

export const T3ProjectFileScript = Schema.Struct({
  name: trimmedNonEmpty({
    description: "Display name for the script, shown in the T3 Code scripts menu.",
  }),
  command: trimmedNonEmpty({
    description: "Shell command executed in a T3 Code terminal at the project root.",
  }),
  icon: Schema.optionalKey(
    ProjectScriptIcon.annotate({
      description: 'Icon shown next to the script in the scripts menu. Defaults to "play".',
    }),
  ),
  runOnWorktreeCreate: Schema.optionalKey(
    Schema.Boolean.annotate({
      description:
        "When true, the script runs automatically after a worktree is created for a new thread.",
    }),
  ),
  previewUrl: Schema.optionalKey(
    trimmedNonEmpty({
      description:
        "URL opened in the in-app browser preview when this script runs. Only honored on the desktop build.",
    }),
  ),
  autoOpenPreview: Schema.optionalKey(
    Schema.Boolean.annotate({
      description:
        "When true, automatically open the preview panel at `previewUrl` the moment the script starts.",
    }),
  ),
}).annotate({
  description: "A project script that team members can import into T3 Code.",
});
export type T3ProjectFileScript = typeof T3ProjectFileScript.Type;

export const T3ProjectFileJob = Schema.Struct({
  id: trimmedNonEmpty({
    description: "Unique identifier for this job.",
  }),
  name: trimmedNonEmpty({
    description: "Display name for the job.",
  }),
  description: Schema.optionalKey(
    trimmedNonEmpty({
      description: "Optional description of what this job does.",
    }),
  ),
  rolePrompt: trimmedNonEmpty({
    description: "System instructions and role guidelines passed to the agent.",
  }),
  promptTemplate: Schema.optionalKey(
    trimmedNonEmpty({
      description:
        "Default task prompt template with variable interpolation (e.g. ${pr.number}, ${issue.title}).",
    }),
  ),
  modelSelection: Schema.optionalKey(ModelSelection),
  runtimeMode: Schema.optionalKey(RuntimeMode),
  icon: Schema.optionalKey(trimmedNonEmpty({ description: "Optional icon identifier." })),
}).annotate({
  description:
    "A specialized agent job definition with role instructions and default prompt template.",
});
export type T3ProjectFileJob = typeof T3ProjectFileJob.Type;

export const AutomationGitHubPrEvent = Schema.Literals([
  "opened",
  "synchronize",
  "closed",
  "merged",
  "reopened",
  "review_requested",
]);
export type AutomationGitHubPrEvent = typeof AutomationGitHubPrEvent.Type;

export const AutomationGitHubPrTrigger = Schema.Struct({
  type: Schema.Literal("github_pr"),
  events: Schema.optionalKey(
    Schema.Array(AutomationGitHubPrEvent).annotate({
      description: 'PR events to listen for. Defaults to ["opened", "synchronize"].',
    }),
  ),
  targetBranches: Schema.optionalKey(
    Schema.Array(trimmedNonEmpty({ description: "Target base branch name" })).annotate({
      description: 'Optional branch filter (e.g. ["main"]).',
    }),
  ),
}).annotate({
  description: "Trigger that fires when GitHub pull request events occur.",
});
export type AutomationGitHubPrTrigger = typeof AutomationGitHubPrTrigger.Type;

export const AutomationGitHubIssueEvent = Schema.Literals([
  "opened",
  "closed",
  "reopened",
  "labeled",
  "assigned",
]);
export type AutomationGitHubIssueEvent = typeof AutomationGitHubIssueEvent.Type;

export const AutomationGitHubIssueTrigger = Schema.Struct({
  type: Schema.Literal("github_issue"),
  events: Schema.optionalKey(
    Schema.Array(AutomationGitHubIssueEvent).annotate({
      description: 'Issue events to listen for. Defaults to ["opened"].',
    }),
  ),
  labels: Schema.optionalKey(
    Schema.Array(trimmedNonEmpty({ description: "Issue label name" })).annotate({
      description: 'Optional label filter (e.g. ["bug", "agent-ready"]).',
    }),
  ),
}).annotate({
  description: "Trigger that fires when GitHub issue events occur.",
});
export type AutomationGitHubIssueTrigger = typeof AutomationGitHubIssueTrigger.Type;

export const AutomationCronTrigger = Schema.Struct({
  type: Schema.Literal("cron"),
  schedule: trimmedNonEmpty({
    description:
      'Cron expression (e.g. "0 9 * * 1-5" or "*/30 * * * *") or shortcut ("@hourly", "@daily").',
  }),
}).annotate({
  description: "Trigger that fires on a recurring schedule.",
});
export type AutomationCronTrigger = typeof AutomationCronTrigger.Type;

export const AutomationManualTrigger = Schema.Struct({
  type: Schema.Literal("manual"),
}).annotate({
  description: "Trigger that fires manually on-demand.",
});
export type AutomationManualTrigger = typeof AutomationManualTrigger.Type;

export const AutomationTrigger = Schema.Union([
  AutomationCronTrigger,
  AutomationGitHubPrTrigger,
  AutomationGitHubIssueTrigger,
  AutomationManualTrigger,
]).annotate({
  description: "Trigger conditions for an automation.",
});
export type AutomationTrigger = typeof AutomationTrigger.Type;

export const AutomationThreadAction = Schema.Struct({
  type: Schema.Literal("thread"),
  jobId: Schema.optionalKey(
    trimmedNonEmpty({
      description: "Optional ID of a project-defined or built-in agent job.",
    }),
  ),
  prompt: Schema.optionalKey(
    trimmedNonEmpty({
      description:
        "Prompt template sent to the agent thread. Supports variables like ${event.type}, ${pr.number}, ${pr.title}, ${issue.number}, ${issue.title}. If omitted, the job's prompt template is used.",
    }),
  ),
  title: Schema.optionalKey(
    trimmedNonEmpty({
      description: "Optional thread title template.",
    }),
  ),
  modelSelection: Schema.optionalKey(ModelSelection),
  runtimeMode: Schema.optionalKey(RuntimeMode),
}).annotate({
  description: "Action that starts a new agent thread with an initial prompt or job.",
});
export type AutomationThreadAction = typeof AutomationThreadAction.Type;

export const AutomationScriptAction = Schema.Struct({
  type: Schema.Literal("script"),
  command: Schema.optionalKey(
    trimmedNonEmpty({
      description: "Shell command executed at the project root.",
    }),
  ),
  scriptName: Schema.optionalKey(
    trimmedNonEmpty({
      description: "Name of an existing project script in t3.json to run.",
    }),
  ),
}).annotate({
  description: "Action that executes a script or shell command at the project root.",
});
export type AutomationScriptAction = typeof AutomationScriptAction.Type;

export const AutomationAction = Schema.Union([
  AutomationThreadAction,
  AutomationScriptAction,
]).annotate({
  description: "Action performed when an automation trigger fires.",
});
export type AutomationAction = typeof AutomationAction.Type;

export const T3ProjectFileAutomation = Schema.Struct({
  id: trimmedNonEmpty({
    description: "Unique identifier for this automation within the project.",
  }),
  name: trimmedNonEmpty({
    description: "Human-readable display name for the automation.",
  }),
  enabled: Schema.optionalKey(
    Schema.Boolean.annotate({
      description: "Whether the automation is active. Defaults to true.",
    }),
  ),
  trigger: AutomationTrigger,
  action: AutomationAction,
}).annotate({
  description: "An automation rule reacting to cron schedules or GitHub events.",
});
export type T3ProjectFileAutomation = typeof T3ProjectFileAutomation.Type;

export const T3ProjectFile = Schema.Struct({
  $schema: Schema.optionalKey(
    Schema.String.annotate({
      description: `URL of the JSON Schema for this file, typically "${T3_PROJECT_FILE_SCHEMA_URL}".`,
    }),
  ),
  iconPath: Schema.optionalKey(
    trimmedNonEmpty(
      {
        description:
          'Workspace-relative path to the project icon (e.g. "assets/logo.svg"). Checked before T3 Code\'s built-in icon locations.',
      },
      T3_PROJECT_FILE_PATH_MAX_LENGTH,
    ),
  ),
  defaultThreadEnvMode: Schema.optionalKey(
    ThreadEnvMode.annotate({
      description:
        'Where new threads start for this repository: "worktree" for a fresh git worktree, "local" for the current checkout. A per-project setting in T3 Code overrides this; when neither is set, the global default applies.',
    }),
  ),
  jobs: Schema.optionalKey(
    Schema.Array(T3ProjectFileJob)
      .annotate({
        description: "Custom agent jobs defined for this repository.",
      })
      .check(Schema.isMaxLength(T3_PROJECT_FILE_MAX_JOBS)),
  ),
  scripts: Schema.optionalKey(
    Schema.Array(T3ProjectFileScript)
      .annotate({
        description: "Project scripts shared with everyone who opens this repository in T3 Code.",
      })
      .check(Schema.isMaxLength(T3_PROJECT_FILE_MAX_SCRIPTS)),
  ),
  automations: Schema.optionalKey(
    Schema.Array(T3ProjectFileAutomation)
      .annotate({
        description: "Automations configured for this project (cron, github_pr, github_issue).",
      })
      .check(Schema.isMaxLength(T3_PROJECT_FILE_MAX_AUTOMATIONS)),
  ),
}).annotate({
  title: "T3 project file",
  description:
    "Checked-in project configuration for T3 Code (t3.json at the repository root). See https://t3.codes for documentation.",
});
export type T3ProjectFile = typeof T3ProjectFile.Type;
