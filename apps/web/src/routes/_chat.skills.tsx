import { createFileRoute } from "@tanstack/react-router";
import { SkillsPage } from "~/components/skills/SkillsPage";
import { SidebarInset } from "~/components/ui/sidebar";

export const Route = createFileRoute("/_chat/skills")({
  component: SkillsRoute,
});

function SkillsRoute() {
  return (
    <SidebarInset className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <SkillsPage />
    </SidebarInset>
  );
}
