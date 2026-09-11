import { useAtomValue } from "@effect/atom-react";
import {
  CheckIcon,
  ChevronDownIcon,
  FolderIcon,
  PackageIcon,
  RefreshCwIcon,
  SearchIcon,
  SparklesIcon,
  XIcon,
} from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useState } from "react";

import { isElectron } from "~/env";
import { useActiveProjectTarget } from "~/hooks/useActiveProjectTarget";
import { useOpenInPreferredEditor } from "~/editorPreferences";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "~/components/ui/input-group";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "~/components/ui/menu";
import { toastManager } from "~/components/ui/toast";
import {
  WorkspaceBreadcrumb,
  WorkspaceBreadcrumbItem,
  WorkspaceBreadcrumbSeparator,
} from "~/components/WorkspaceBreadcrumb";
import { WorkspacePageContainer } from "~/components/WorkspacePageContainer";
import { WorkspacePageHeader } from "~/components/WorkspacePageHeader";
import { useProjects } from "~/state/entities";
import { projectEnvironment } from "~/state/projects";
import { primaryServerConfigAtom, serverEnvironment } from "~/state/server";
import { useAtomCommand } from "~/state/use-atom-command";
import { DropInSkillCard } from "./DropInSkillCard";
import { SkillCard } from "./SkillCard";
import { SkillPreviewDialog } from "./SkillPreviewDialog";
import {
  CURATED_BUNDLES,
  CURATED_FEATURED_SKILLS,
  fetchAntigravityCatalog,
  fetchSkillContent,
  SKILL_CATEGORIES,
  type SkillItem,
} from "./skillsRegistry";

export const SkillsPage = memo(function SkillsPage() {
  const projects = useProjects();
  const activeTarget = useActiveProjectTarget();

  // Pick target project
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const targetProject = useMemo(() => {
    if (selectedProjectId) {
      const found = projects.find((p) => p.id === selectedProjectId);
      if (found) return found;
    }
    if (activeTarget?.projectId) {
      const found = projects.find((p) => p.id === activeTarget.projectId);
      if (found) return found;
    }
    return projects[0] ?? null;
  }, [projects, selectedProjectId, activeTarget]);

  // Server config & commands
  const serverConfig = useAtomValue(primaryServerConfigAtom);
  const writeFileCmd = useAtomCommand(projectEnvironment.writeFile, { reportFailure: false });
  const refreshProvidersCmd = useAtomCommand(serverEnvironment.refreshProviders, {
    reportFailure: false,
  });
  const openInPreferredEditor = useOpenInPreferredEditor(
    targetProject?.environmentId ?? null,
    serverConfig?.availableEditors ?? [],
  );

  // Catalog state
  const [skills, setSkills] = useState<SkillItem[]>(() => [...CURATED_FEATURED_SKILLS]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [installedSkillIds, setInstalledSkillIds] = useState<Set<string>>(new Set());
  const [installingIds, setInstallingIds] = useState<Set<string>>(new Set());

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedSource, setSelectedSource] = useState<
    "all" | "antigravity" | "skillsllm" | "installed"
  >("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedBundleId, setSelectedBundleId] = useState<string | null>(null);

  // Preview dialog
  const [previewSkill, setPreviewSkill] = useState<SkillItem | null>(null);

  // Load catalog on mount
  const loadCatalog = useCallback(async () => {
    setIsLoading(true);
    try {
      const catalog = await fetchAntigravityCatalog();
      setSkills(catalog);
    } catch {
      // Fallback already in initial state
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  // Detect installed skills from server provider snapshots
  useEffect(() => {
    if (!serverConfig?.providers) return;
    const installed = new Set<string>();

    for (const provider of serverConfig.providers) {
      if (provider.skills) {
        for (const s of provider.skills) {
          installed.add(s.name.toLowerCase());
          if (s.path) {
            const parts = s.path.split(/[\/\\]/);
            const folderName = parts[parts.length - 2];
            if (folderName) installed.add(folderName.toLowerCase());
          }
        }
      }
      if (provider.workspaceSnapshots && targetProject?.workspaceRoot) {
        for (const snapshot of provider.workspaceSnapshots) {
          if (snapshot.cwd === targetProject.workspaceRoot && snapshot.skills) {
            for (const s of snapshot.skills) {
              installed.add(s.name.toLowerCase());
              if (s.path) {
                const parts = s.path.split(/[\/\\]/);
                const folderName = parts[parts.length - 2];
                if (folderName) installed.add(folderName.toLowerCase());
              }
            }
          }
        }
      }
    }

    setInstalledSkillIds((prev) => {
      const next = new Set(prev);
      for (const id of installed) {
        next.add(id);
      }
      return next;
    });
  }, [serverConfig, targetProject?.workspaceRoot]);

  // Install handler
  const handleInstallSkill = useCallback(
    async (skill: SkillItem, customContent?: string) => {
      if (!targetProject) {
        toastManager.add({
          type: "error",
          title: "No target project selected",
          description: "Please select an active project to install skills into.",
        });
        return;
      }

      setInstallingIds((prev) => new Set(prev).add(skill.id));

      try {
        let content = customContent;
        if (!content) {
          content = await fetchSkillContent(skill);
        }

        const relativePath = `.agents/skills/${skill.id}/SKILL.md`;

        // Write to project workspace
        const writeResult = await writeFileCmd({
          environmentId: targetProject.environmentId,
          input: {
            cwd: targetProject.workspaceRoot,
            relativePath,
            contents: content,
          },
        });

        if (writeResult._tag === "Failure") {
          throw new Error("Failed to write skill file to workspace.");
        }

        // Refresh providers to make skill immediately active
        await refreshProvidersCmd({
          environmentId: targetProject.environmentId,
          input: {},
        });

        // Mark installed locally
        setInstalledSkillIds((prev) => new Set(prev).add(skill.id.toLowerCase()));

        toastManager.add({
          type: "success",
          title: `Skill "${skill.displayName || skill.name}" installed!`,
          description: `Saved to ${relativePath} and activated for your AI assistants.`,
        });
      } catch (err) {
        toastManager.add({
          type: "error",
          title: `Failed to install skill "${skill.displayName || skill.name}"`,
          description: err instanceof Error ? err.message : "Unknown error",
        });
      } finally {
        setInstallingIds((prev) => {
          const next = new Set(prev);
          next.delete(skill.id);
          return next;
        });
      }
    },
    [targetProject, writeFileCmd, refreshProvidersCmd],
  );

  // Open in editor handler
  const handleOpenInEditor = useCallback(
    async (skill: SkillItem) => {
      if (!targetProject) return;
      const relativePath = `.agents/skills/${skill.id}/SKILL.md`;
      const targetPath = `${targetProject.workspaceRoot}/${relativePath}`;

      await openInPreferredEditor(targetPath);

      toastManager.add({
        type: "info",
        title: "Opening skill in editor",
        description: relativePath,
      });
    },
    [targetProject, openInPreferredEditor],
  );

  // Filter skills
  const filteredSkills = useMemo(() => {
    let result = skills;

    // Filter by bundle
    if (selectedBundleId) {
      const bundle = CURATED_BUNDLES.find((b) => b.id === selectedBundleId);
      if (bundle) {
        result = result.filter((s) => bundle.skillIds.includes(s.id));
      }
    }

    // Filter by source
    if (selectedSource === "antigravity") {
      result = result.filter((s) => s.source === "antigravity");
    } else if (selectedSource === "skillsllm") {
      result = result.filter((s) => s.source === "skillsllm");
    } else if (selectedSource === "installed") {
      result = result.filter((s) => installedSkillIds.has(s.id.toLowerCase()));
    }

    // Filter by category
    if (selectedCategory !== "all") {
      result = result.filter((s) => s.category === selectedCategory);
    }

    // Filter by query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((s) => {
        return (
          s.id.toLowerCase().includes(q) ||
          s.name.toLowerCase().includes(q) ||
          (s.displayName && s.displayName.toLowerCase().includes(q)) ||
          s.description.toLowerCase().includes(q) ||
          s.category.toLowerCase().includes(q) ||
          s.tags?.some((t) => t.toLowerCase().includes(q)) ||
          s.triggers?.some((tr) => tr.toLowerCase().includes(q))
        );
      });
    }

    return result;
  }, [skills, selectedBundleId, selectedSource, selectedCategory, searchQuery, installedSkillIds]);

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-y-auto bg-background text-foreground">
      {/* Workspace topbar */}
      <WorkspacePageHeader electron={isElectron}>
        <WorkspaceBreadcrumb ariaLabel="Breadcrumb">
          <WorkspaceBreadcrumbItem>
            <span className="text-muted-foreground">Home</span>
          </WorkspaceBreadcrumbItem>
          <WorkspaceBreadcrumbSeparator />
          <WorkspaceBreadcrumbItem current>
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <SparklesIcon className="size-4 text-primary" />
              Skills Catalog
            </span>
          </WorkspaceBreadcrumbItem>
        </WorkspaceBreadcrumb>

        {/* Project Selector dropdown in header */}
        <div className="ml-auto flex items-center gap-3">
          {projects.length > 0 && targetProject ? (
            <Menu>
              <MenuTrigger
                render={
                  <Button variant="outline" size="xs" className="gap-1.5 text-xs font-normal" />
                }
              >
                <FolderIcon className="size-3.5 text-muted-foreground" />
                <span className="max-w-36 truncate sm:max-w-52 font-medium">
                  {targetProject.title}
                </span>
                <ChevronDownIcon className="size-3 text-muted-foreground" />
              </MenuTrigger>
              <MenuPopup align="end" className="w-64 p-1">
                <div className="px-2 py-1.5 text-[11px] font-medium text-muted-foreground border-b border-border/40 mb-1">
                  Target Project Workspace
                </div>
                {projects.map((p) => (
                  <MenuItem
                    key={p.id}
                    onClick={() => setSelectedProjectId(p.id)}
                    className="flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0 truncate">
                      <div className="font-medium truncate">{p.title}</div>
                      <div className="font-mono text-[10px] text-muted-foreground truncate">
                        {p.workspaceRoot}
                      </div>
                    </div>
                    {p.id === targetProject.id ? (
                      <CheckIcon className="size-3.5 text-primary shrink-0" />
                    ) : null}
                  </MenuItem>
                ))}
              </MenuPopup>
            </Menu>
          ) : null}

          <Button
            variant="ghost"
            size="xs"
            disabled={isLoading}
            onClick={() => void loadCatalog()}
            className="gap-1 text-xs text-muted-foreground hover:text-foreground"
            title="Refresh catalog from GitHub"
          >
            <RefreshCwIcon className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </WorkspacePageHeader>

      <WorkspacePageContainer width="expanded" className="pb-20">
        {/* Hero Banner */}
        <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-primary/5 via-muted/30 to-background p-6 sm:p-8">
          <div className="relative z-10 max-w-2xl space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <SparklesIcon className="size-3.5" />
              Multi-Source AI Skills Directory
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Install Skills into your Project
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Enhance Antigravity, Claude, and your AI coding assistants with specialized domain
              knowledge, architectural guidelines, and custom toolsets. Installed directly to{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
                .agents/skills/&lt;name&gt;/SKILL.md
              </code>
              .
            </p>
          </div>
        </div>

        {/* Drop in / Custom skill card */}
        <DropInSkillCard
          onInstallCustom={async (skill, rawContent) => {
            await handleInstallSkill(skill, rawContent);
          }}
        />

        {/* Bundle Quick Install Bar */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <PackageIcon className="size-3.5" />
            <span>Featured Bundles:</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedBundleId(null)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                selectedBundleId === null
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "border border-border/60 bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              All Skills
            </button>
            {CURATED_BUNDLES.map((bundle) => (
              <button
                type="button"
                key={bundle.id}
                onClick={() =>
                  setSelectedBundleId((prev) => (prev === bundle.id ? null : bundle.id))
                }
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition ${
                  selectedBundleId === bundle.id
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "border border-border/60 bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <span>{bundle.name}</span>
                <span className="opacity-70 text-[10px]">({bundle.skillIds.length})</span>
              </button>
            ))}
          </div>
        </div>

        {/* Search and Filter Row */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Search bar */}
          <div className="w-full sm:max-w-md">
            <InputGroup>
              <InputGroupAddon>
                <SearchIcon className="size-4 text-muted-foreground" />
              </InputGroupAddon>
              <InputGroupInput
                placeholder="Search by name, category, or triggers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="text-xs"
              />
              {searchQuery ? (
                <InputGroupAddon>
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <XIcon className="size-3.5" />
                  </button>
                </InputGroupAddon>
              ) : null}
            </InputGroup>
          </div>

          {/* Source Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              type="button"
              onClick={() => setSelectedSource("all")}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                selectedSource === "all"
                  ? "bg-muted text-foreground font-semibold"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }`}
            >
              All Sources
            </button>
            <button
              type="button"
              onClick={() => setSelectedSource("antigravity")}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                selectedSource === "antigravity"
                  ? "bg-muted text-foreground font-semibold"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }`}
            >
              Antigravity Vault
            </button>
            <button
              type="button"
              onClick={() => setSelectedSource("skillsllm")}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                selectedSource === "skillsllm"
                  ? "bg-muted text-foreground font-semibold"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }`}
            >
              SkillsLLM
            </button>
            <button
              type="button"
              onClick={() => setSelectedSource("installed")}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition flex items-center gap-1 ${
                selectedSource === "installed"
                  ? "bg-muted text-foreground font-semibold"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }`}
            >
              <CheckIcon className="size-3" />
              Installed
              {installedSkillIds.size > 0 ? (
                <Badge variant="success" size="sm" className="ml-0.5 text-[10px]">
                  {installedSkillIds.size}
                </Badge>
              ) : null}
            </button>
          </div>
        </div>

        {/* Category Filter Chips */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {SKILL_CATEGORIES.map((cat) => (
            <button
              type="button"
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`rounded-md px-2 py-1 text-xs capitalize transition ${
                selectedCategory === cat
                  ? "bg-accent text-accent-foreground font-medium shadow-xs"
                  : "bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              }`}
            >
              {cat === "all" ? "All Categories" : cat.replace("-", " & ")}
            </button>
          ))}
        </div>

        {/* Skills Counter */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
          <span>
            Showing <strong className="text-foreground">{filteredSkills.length}</strong> skills
            {targetProject ? (
              <>
                {" "}
                for project <strong className="text-foreground">{targetProject.title}</strong>
              </>
            ) : null}
          </span>
          {installedSkillIds.size > 0 ? (
            <span className="text-success font-medium flex items-center gap-1">
              <CheckIcon className="size-3" />
              {installedSkillIds.size} installed in project
            </span>
          ) : null}
        </div>

        {/* Skills Grid */}
        {filteredSkills.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredSkills.map((skill) => {
              const isInstalled = installedSkillIds.has(skill.id.toLowerCase());
              const isInstalling = installingIds.has(skill.id);

              return (
                <SkillCard
                  key={skill.id}
                  skill={skill}
                  isInstalled={isInstalled}
                  isInstalling={isInstalling}
                  onInstall={(s) => void handleInstallSkill(s)}
                  onPreview={(s) => setPreviewSkill(s)}
                  onOpenInEditor={(s) => void handleOpenInEditor(s)}
                  onSelectTag={(tag) => setSearchQuery(tag)}
                />
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-muted/10 p-12 text-center">
            <SparklesIcon className="size-10 text-muted-foreground/50 mb-3" />
            <h3 className="text-base font-semibold text-foreground">No skills found</h3>
            <p className="mt-1 text-xs text-muted-foreground max-w-sm">
              No skills match your current search or category filter. Try clearing filters or
              dropping in a custom skill above.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchQuery("");
                setSelectedCategory("all");
                setSelectedSource("all");
                setSelectedBundleId(null);
              }}
              className="mt-4 text-xs"
            >
              Reset Filters
            </Button>
          </div>
        )}
      </WorkspacePageContainer>

      {/* Markdown Preview Dialog */}
      <SkillPreviewDialog
        skill={previewSkill}
        isOpen={Boolean(previewSkill)}
        isInstalled={previewSkill ? installedSkillIds.has(previewSkill.id.toLowerCase()) : false}
        isInstalling={previewSkill ? installingIds.has(previewSkill.id) : false}
        onOpenChange={(open) => {
          if (!open) setPreviewSkill(null);
        }}
        onInstall={(s) => void handleInstallSkill(s)}
      />
    </div>
  );
});
