// SPDX-License-Identifier: AGPL-3.0-only
// Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

// Production project dialog, with native IPC and HTTP supplied by the Playwright driver.
import { createRoot } from "react-dom/client";
import { useState } from "react";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import {
  EditProjectDialog,
  NewProjectDialog,
  type ProjectRecord,
} from "@/features/chat";
import { authFetch } from "@/features/auth";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "sonner";
import { setApiBase } from "@/lib/api-base";
import { initializeLocale } from "@/i18n";
import "./src/index.css";

setApiBase(Number(location.port));
const localeInitialization = initializeLocale();
if (typeof localeInitialization !== "string") {
  localeInitialization.catch((error: unknown) => {
    throw error;
  });
}

async function loadProject(projectId: string): Promise<ProjectRecord | null> {
  const response = await authFetch(
    `/api/chat/projects/${encodeURIComponent(projectId)}`,
  );
  if (response.status === 404) return null;
  return (await response.json()) as ProjectRecord;
}

function App() {
  const [open, setOpen] = useState(true);
  const [created, setCreated] = useState<ProjectRecord | null>(null);
  const [editing, setEditing] = useState(false);
  return (
    <TooltipProvider>
      <div className="aui-root" style={{ minHeight: "100vh" }}>
        <NewProjectDialog
          open={open}
          onOpenChange={setOpen}
          onCreated={setCreated}
        />
        <p data-testid="created">{created?.id}</p>
        {created && (
          <button
            onClick={() => {
              loadProject(created.id)
                .then((project) => {
                  setCreated(project);
                  setEditing(true);
                })
                .catch((error: unknown) => {
                  throw error;
                });
            }}
          >
            Edit project
          </button>
        )}
        <EditProjectDialog
          project={editing ? created : null}
          onOpenChange={setEditing}
          onDelete={() => {
            setEditing(false);
            setCreated(null);
          }}
        />
        <Toaster />
      </div>
    </TooltipProvider>
  );
}
const root = createRootRoute({ component: App });
const router = createRouter({
  routeTree: root,
  history: createMemoryHistory({ initialEntries: ["/"] }),
});
const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Missing #root element");
createRoot(rootElement).render(
  <RouterProvider router={router} />,
);
