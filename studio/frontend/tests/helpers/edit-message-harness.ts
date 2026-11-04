// SPDX-License-Identifier: AGPL-3.0-only
// Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0
// Shared harness for edit-message-keeps-metadata tests.

import assert from "node:assert/strict";
import { runSource } from "./eval-source.ts";

import { MessageRepository } from "@assistant-ui/core/internal";
import type { ThreadMessage } from "@assistant-ui/react";
import ts from "@typescript/typescript6";
import type { MessageRecord } from "../../src/features/chat/types.ts";
import * as researchSync from "../../src/features/chat/utils/research-message-sync.ts";
import * as savedUsage from "../../src/features/chat/utils/saved-context-usage.ts";
import { readSrc } from "./kit.ts";
import { loadWithStubs } from "./module-stubs.ts";

export interface Exported {
  headId: string | null;
  messages: { parentId: string | null; message: Record<string, unknown> }[];
}

export interface Module {
  extractTaggedText: (content: unknown) => string;
  updateThreadMessage: (args: {
    thread: { export: () => Exported; import: (data: Exported) => void };
    messageId: string;
    remoteId: string | undefined;
    newText: string;
    isIncognito: boolean;
  }) => Promise<unknown>;
}

export const RECORD_MODULE = loadWithStubs<{
  exportedItemToRecord: (
    threadId: string,
    parentId: string | null,
    message: unknown,
  ) => MessageRecord;
}>(
  new URL(
    "../../src/features/chat/utils/delete-thread-message.ts",
    import.meta.url,
  ),
  {
    "@assistant-ui/core/internal": { MessageRepository },
    "../api/chat-api": {
      listChatMessages: async () => {
        await Promise.resolve();
        return [];
      },
    },
    "./chat-history-storage": {
      ensureStoredChatThread: async () => {
        /* empty */
      },
      syncStoredChatMessages: async (
        _threadId: string,
        records: Record<string, unknown>[],
      ) => {
        await Promise.resolve();
        return records;
      },
    },
    "./research-message-sync": researchSync,
    "./saved-context-usage": savedUsage,
  },
);

export const CUSTOM = {
  incomplete: { reason: "length" },
  contextUsage: { promptTokens: 900, contextLength: 4096 },
  timing: { tokensPerSecond: 42.5, durationMs: 1200 },
  contextTruncation: { dropped: 4, fits: true },
};

const provider = ts.createSourceFile(
  "runtime-provider.tsx",
  readSrc("features/chat/runtime-provider.tsx"),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
const hydration = ["cloneContent", "cloneAttachments", "toThreadMessage"]
  .map((name) => {
    const declaration = provider.statements.find(
      (node) => ts.isFunctionDeclaration(node) && node.name?.text === name,
    );
    assert.ok(declaration, `${name} was not found`);
    return declaration.getText(provider);
  })
  .join("\n");
export const hydrateUser = runSource(
  ts.transpileModule(`${hydration}\nreturn toThreadMessage;`, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.None,
    },
  }).outputText,
  {},
) as (record: MessageRecord) => ThreadMessage;

export function harness(persist?: () => Promise<void>) {
  const saved: Record<string, unknown>[] = [];
  const module = loadWithStubs<Module>(
    new URL(
      "../../src/features/chat/utils/update-thread-message.ts",
      import.meta.url,
    ),
    {
      "../api/chat-api": {
        saveChatMessage: async (record: Record<string, unknown>) => {
          saved.push(record);
          await persist?.();
          return record;
        },
      },
      "./delete-thread-message": RECORD_MODULE,
      "./research-message-sync": researchSync,
      "./saved-context-usage": savedUsage,
    },
  );
  return { module, saved };
}

export function deferred() {
  let resolve!: () => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<void>((accept, refuse) => {
    resolve = accept;
    reject = refuse;
  });
  return { promise, resolve, reject };
}

export function thread(content: unknown[]): Exported {
  return {
    headId: "a0",
    messages: [
      {
        parentId: null,
        message: {
          id: "u0",
          role: "user",
          content: [{ type: "text", text: "hello" }],
          createdAt: new Date(1000),
          metadata: { custom: {} },
        },
      },
      {
        parentId: "u0",
        message: {
          id: "a0",
          role: "assistant",
          content,
          createdAt: new Date(2000),
          metadata: { custom: CUSTOM },
        },
      },
    ],
  };
}

export async function save(
  newText: string,
  content: unknown[] = [{ type: "text", text: "the original reply" }],
) {
  const h = harness();
  const exported = thread(content);
  await h.module.updateThreadMessage({
    thread: {
      export: () => exported,
      import: () => {
        /* empty */
      },
    },
    messageId: "a0",
    remoteId: "remote-1",
    newText,
    isIncognito: false,
  });
  assert.equal(h.saved.length, 1, "the edit was never written");
  return h.saved[0];
}

export function withoutRevision(metadata: unknown): Record<string, unknown> {
  const { revision, ...kept } = metadata as Record<string, unknown>;
  assert.equal(revision, 1);
  return kept;
}

export const GENERATION_OWNERSHIP = {
  serverManaged: true,
  generationRunId: "run-1",
  generationSeq: 3,
  generationStatus: "completed",
  generationSettled: true,
};

export async function saveOwnedReply(custom: Record<string, unknown>) {
  const h = harness();
  const exported = thread([{ type: "text", text: "the original reply" }]);
  exported.messages[1].message.metadata = { custom };

  await h.module.updateThreadMessage({
    thread: {
      export: () => exported,
      import: () => {
        /* empty */
      },
    },
    messageId: "a0",
    remoteId: "remote-1",
    newText: "an edited reply",
    isIncognito: false,
  });

  assert.equal(h.saved.length, 1, "the edit was never written");
  return h.saved[0];
}

const adapters = provider.statements.find(
  (node): node is ts.FunctionDeclaration =>
    ts.isFunctionDeclaration(node) &&
    node.name?.text === "useStudioRuntimeAdapters",
);
assert.ok(adapters?.body);
const deletionEffect = adapters.body.statements.find((node) => {
  let subscribes = false;
  const visit = (child: ts.Node) => {
    if (
      ts.isCallExpression(child) &&
      child.expression.getText(provider) === "onChatAttachmentDeleted"
    ) {
      subscribes = true;
    }
    ts.forEachChild(child, visit);
  };
  visit(node);
  return subscribes;
});
assert.ok(deletionEffect);
const deletionEffectCode = ts.transpileModule(
  deletionEffect.getText(provider),
  {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.None,
    },
  },
).outputText;

export function attachmentDeletionHarness(
  exported: Exported,
  hash: () => Promise<string>,
) {
  let listener!: (event: {
    messageId: string;
    attachmentId: string;
  }) => Promise<void>;
  let imports = 0;
  runSource(deletionEffectCode, {
    useEffect: (effect: () => unknown) => effect(),
    aui: {
      thread: () => ({
        export: () => exported,
        import: (next: Exported) => {
          Object.assign(exported, next);
          imports += 1;
        },
      }),
    },
    onChatAttachmentDeleted: (callback: typeof listener) => {
      listener = callback;
      return () => {
        /* empty */
      };
    },
    chatContentPartAttachmentSignature: (part: { type: string }) =>
      part.type === "image" ? "image-signature" : null,
    chatContentPartAttachmentIdFromSignature: hash,
    ...savedUsage,
  });
  return {
    remove: (attachmentId: string) =>
      listener({ messageId: "u0", attachmentId }),
    imports: () => imports,
  };
}
