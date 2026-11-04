// SPDX-License-Identifier: AGPL-3.0-only
// Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0
// Tests for edit-message metadata retention (shared harness in helpers).

import assert from "node:assert/strict";
import test from "node:test";

import type { ThreadMessage } from "@assistant-ui/react";
import type { MessageRecord } from "../src/features/chat/types.ts";
import {
  branchContextUsage,
  contextUsageMarkers,
  revisionTotal,
  threadBranchRecords,
} from "../src/features/chat/utils/saved-context-usage.ts";
import type { Exported } from "./helpers/edit-message-harness.ts";
import {
  CUSTOM,
  GENERATION_OWNERSHIP,
  RECORD_MODULE,
  attachmentDeletionHarness,
  deferred,
  harness,
  hydrateUser,
  save,
  saveOwnedReply,
  thread,
  withoutRevision,
} from "./helpers/edit-message-harness.ts";

test("an edited reply keeps the metadata the turn was stored with", async () => {
  const record = await save("an edited reply");

  assert.deepEqual(withoutRevision(record.metadata), CUSTOM);
});

test("saving a reply unchanged does not mark it revised, however the parts were stored", async () => {
  for (const content of [
    [{ type: "text", text: "the original reply" }],
    [
      { type: "reasoning", text: "\nlet me think\n" },
      { type: "text", text: "the reply" },
    ],
    [
      { type: "text", text: "one" },
      { type: "text", text: "two" },
    ],
    [{ type: "text", text: "the reply", status: { type: "complete" } }],
  ]) {
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
      newText: h.module.extractTaggedText(content),
      isIncognito: false,
    });
    assert.equal(
      "revision" in ((h.saved[0].metadata ?? {}) as Record<string, unknown>),
      false,
    );
  }
});

for (const modelId of ["unsloth/gguf-model", "external::openai::gpt-x"]) {
  for (const editedId of ["u0", "a0"]) {
    test(`an edit after reloading a revised user invalidates saved context: ${modelId}, ${editedId}`, async () => {
      const h = harness();
      const user: MessageRecord = {
        id: "u0",
        threadId: "remote-1",
        role: "user",
        content: [{ type: "text", text: "edited prompt" }],
        createdAt: 1000,
        metadata: { revision: 1, createdAtEstimated: true },
      };
      const assistant: MessageRecord = {
        id: "a0",
        threadId: "remote-1",
        parentId: "u0",
        role: "assistant",
        content: [{ type: "text", text: "the original reply" }],
        createdAt: 2000,
      };
      const usage = {
        promptTokens: 90,
        completionTokens: 10,
        totalTokens: 100,
        cachedTokens: 0,
        modelId,
        ...contextUsageMarkers([user, assistant]),
      };
      let exported = thread(assistant.content as unknown[]);
      exported.messages[0].message = hydrateUser(user);
      exported.messages[1].message.metadata = {
        custom: { contextUsage: usage },
      };

      await h.module.updateThreadMessage({
        thread: {
          export: () => exported,
          import: (data) => {
            exported = data;
          },
        },
        messageId: editedId,
        remoteId: "remote-1",
        newText: "a much longer edited message ".repeat(10),
        isIncognito: false,
      });

      const messages = exported.messages.map(
        ({ message }) => message,
      ) as unknown as ThreadMessage[];
      const window = modelId.startsWith("external::") ? null : 4096;
      const shown = branchContextUsage(
        threadBranchRecords(messages),
        modelId,
        window,
        window,
      );
      assert.ok(shown);
      assert.equal(
        shown.estimated,
        true,
        "the pre-edit count was accepted as exact",
      );
      assert.equal(revisionTotal(messages), 2);
      assert.equal(h.saved.length, 1);
    });
  }
}

test("reloading and saving a user unchanged preserves its revision and timestamp flag", async () => {
  const h = harness();
  const user: MessageRecord = {
    id: "u0",
    threadId: "remote-1",
    role: "user",
    content: [{ type: "text", text: "edited prompt" }],
    createdAt: 1000,
    metadata: { revision: 3, createdAtEstimated: true },
  };
  const exported = thread([]);
  exported.messages[0].message = hydrateUser(user);
  await h.module.updateThreadMessage({
    thread: {
      export: () => exported,
      import: () => {
        /* empty */
      },
    },
    messageId: "u0",
    remoteId: "remote-1",
    newText: h.module.extractTaggedText(user.content),
    isIncognito: false,
  });
  assert.deepEqual(h.saved[0].metadata, user.metadata);
});

test("editing clears stale Gemini continuation replay and keeps other metadata", async () => {
  const record = await saveOwnedReply({
    ...CUSTOM,
    geminiContinuationReplay: {
      turns: [{ text: "the original reply", thoughtSignature: "SIG-OLD" }],
      visiblePrefix: "the original reply",
      stripVisiblePrefix: true,
    },
  });

  assert.deepEqual(withoutRevision(record.metadata), CUSTOM);
  assert.equal(
    "geminiContinuationReplay" in (record.metadata as Record<string, unknown>),
    false,
  );
});

test("the edit still rewrites the content and its identity", async () => {
  const record = await save("an edited reply");

  assert.equal(record.id, "a0");
  assert.equal(record.threadId, "remote-1");
  assert.equal(record.parentId, "u0");
  assert.equal(record.role, "assistant");
  assert.equal(record.createdAt, 2000);
  assert.deepEqual(record.content, [{ type: "text", text: "an edited reply" }]);
});

test("a reply with no metadata of its own writes only its revision", async () => {
  const h = harness();
  const exported = thread([{ type: "text", text: "hi" }]);
  const target = exported.messages[1].message;
  target.metadata = { custom: {} };

  await h.module.updateThreadMessage({
    thread: {
      export: () => exported,
      import: () => {
        /* empty */
      },
    },
    messageId: "a0",
    remoteId: "remote-1",
    newText: "edited",
    isIncognito: false,
  });

  assert.deepEqual(withoutRevision(h.saved[0].metadata), {});
});

test("an incognito edit is never written at all", async () => {
  const h = harness();
  const exported = thread([{ type: "text", text: "hi" }]);

  await h.module.updateThreadMessage({
    thread: {
      export: () => exported,
      import: () => {
        /* empty */
      },
    },
    messageId: "a0",
    remoteId: "remote-1",
    newText: "edited",
    isIncognito: true,
  });

  assert.equal(h.saved.length, 0);
});

test("an edit updates content and token-count revision before the existing save settles", async () => {
  let accept!: () => void;
  const pending = new Promise<void>((resolve) => {
    accept = resolve;
  });
  const h = harness(() => pending);
  let exported = thread([{ type: "text", text: "original" }]);
  const published: Exported[] = [];
  const save = h.module.updateThreadMessage({
    thread: {
      export: () => exported,
      import: (next) => {
        exported = next;
        published.push(next);
      },
    },
    messageId: "a0",
    remoteId: "remote-1",
    newText: "edited",
    isIncognito: false,
  });

  assert.equal(h.saved.length, 1);
  assert.equal(published.length, 1);
  assert.deepEqual(exported.messages[1].message.content, [
    { type: "text", text: "edited" },
  ]);
  assert.equal(
    revisionTotal(
      exported.messages.map(
        ({ message }) => message,
      ) as unknown as ThreadMessage[],
    ),
    1,
  );
  accept();
  await save;
  assert.equal(published.length, 1);
  const messages = exported.messages.map(
    ({ message }) => message,
  ) as unknown as ThreadMessage[];
  assert.equal(revisionTotal(messages), 1);
  assert.deepEqual(messages[1].content, [{ type: "text", text: "edited" }]);
});

test("upstream edit rollback restores content, revision and the saved token count", async () => {
  const error = new Error(
    "server-managed generation messages cannot be edited",
  );
  const write = deferred();
  const h = harness(() => write.promise);
  let exported = thread([{ type: "text", text: "original" }]);
  const saved = {
    modelId: "local-model",
    promptTokens: 42,
    completionTokens: 8,
    totalTokens: 50,
    cachedTokens: 0,
  };
  exported.messages[1].message.metadata = { custom: { contextUsage: saved } };
  const shownUsage = () =>
    branchContextUsage(
      threadBranchRecords(
        exported.messages.map(
          ({ message }) => message,
        ) as unknown as ThreadMessage[],
      ),
      "local-model",
      4096,
      4096,
    );

  const saving = h.module.updateThreadMessage({
    thread: {
      export: () => exported,
      import: (next) => {
        exported = next;
      },
    },
    messageId: "a0",
    remoteId: "remote-1",
    newText: "edited",
    isIncognito: false,
  });
  assert.notEqual(shownUsage(), saved);
  const rejected = assert.rejects(saving, error);
  write.reject(error);
  await rejected;

  assert.equal(shownUsage(), saved);
  const messages = exported.messages.map(
    ({ message }) => message,
  ) as unknown as ThreadMessage[];
  assert.equal(revisionTotal(messages), 0);
  assert.deepEqual(messages[1].content, [{ type: "text", text: "original" }]);
});

test("token-count revisions do not serialize or delay upstream edit requests", async () => {
  const firstWrite = deferred();
  const secondWrite = deferred();
  const writes = [firstWrite, secondWrite];
  let writeIndex = 0;
  const h = harness(() => writes[writeIndex++].promise);
  let exported = thread([{ type: "text", text: "original" }]);
  const edit = (newText: string) =>
    h.module.updateThreadMessage({
      thread: {
        export: () => exported,
        import: (next) => {
          exported = next;
        },
      },
      messageId: "a0",
      remoteId: "remote-1",
      newText,
      isIncognito: false,
    });
  const first = edit("edit A");
  const second = edit("edit B");
  assert.equal(h.saved.length, 2);
  assert.deepEqual(exported.messages[1].message.content, [
    { type: "text", text: "edit B" },
  ]);

  secondWrite.resolve();
  await second;
  firstWrite.resolve();
  await Promise.all([first, second]);

  assert.deepEqual(
    h.saved.map((record) => record.content),
    [[{ type: "text", text: "edit A" }], [{ type: "text", text: "edit B" }]],
  );
  assert.deepEqual(
    h.saved.map(
      (record) => (record.metadata as Record<string, unknown>).revision,
    ),
    [1, 2],
  );
  assert.deepEqual(exported.messages[1].message.content, [
    { type: "text", text: "edit B" },
  ]);
  assert.equal(
    revisionTotal(
      exported.messages.map(
        ({ message }) => message,
      ) as unknown as ThreadMessage[],
    ),
    2,
  );
});

test("submitting the same edit twice does not add a second revision", async () => {
  const firstWrite = deferred();
  const h = harness(() => firstWrite.promise);
  let exported = thread([{ type: "text", text: "original" }]);
  const edit = () =>
    h.module.updateThreadMessage({
      thread: {
        export: () => exported,
        import: (next) => {
          exported = next;
        },
      },
      messageId: "a0",
      remoteId: "remote-1",
      newText: "edit A",
      isIncognito: false,
    });
  const first = edit();
  const second = edit();
  firstWrite.resolve();
  await Promise.all([first, second]);

  assert.deepEqual(
    h.saved.map(
      (record) => (record.metadata as Record<string, unknown>).revision,
    ),
    [1, 1],
  );
});

test("repeating an edit with THINK whitespace keeps the accepted revision", async () => {
  const firstWrite = deferred();
  const h = harness(() => firstWrite.promise);
  let exported = thread([{ type: "text", text: "original" }]);
  const edit = () =>
    h.module.updateThreadMessage({
      thread: {
        export: () => exported,
        import: (next) => {
          exported = next;
        },
      },
      messageId: "a0",
      remoteId: "remote-1",
      isIncognito: false,
      newText: "<THINK>\n  reasoning  \n</THINK>\n\nreply",
    });
  const first = edit();
  const second = edit();
  firstWrite.resolve();
  await Promise.all([first, second]);
  assert.deepEqual(
    h.saved.map(
      (record) => (record.metadata as Record<string, unknown>).revision,
    ),
    [1, 1],
  );
});

test("reordering distinct calls to the same tool increments the revision", async () => {
  const tool = (toolCallId: string) => ({
    type: "tool-call",
    toolCallId,
    toolName: "search",
    args: {},
    result: toolCallId,
  });
  const record = await save("<TOOL 2: search>\n\n<TOOL 1: search>", [
    tool("a"),
    tool("b"),
  ]);
  assert.equal((record.metadata as Record<string, unknown>).revision, 1);
  assert.deepEqual(record.content, [tool("b"), tool("a")]);
});

test("the turn keeps its timestamp when the export carries epoch millis", async () => {
  const h = harness();
  const exported = thread([{ type: "text", text: "hi" }]);
  exported.messages[1].message.createdAt = 2000;

  await h.module.updateThreadMessage({
    thread: {
      export: () => exported,
      import: () => {
        /* empty */
      },
    },
    messageId: "a0",
    remoteId: "remote-1",
    newText: "edited",
    isIncognito: false,
  });

  assert.equal(h.saved[0].createdAt, 2000);
});

test("editing a generated reply drops the run's claim on the turn", async () => {
  const record = await saveOwnedReply({ ...CUSTOM, ...GENERATION_OWNERSHIP });

  assert.deepEqual(withoutRevision(record.metadata), CUSTOM);
  assert.deepEqual(
    Object.keys(GENERATION_OWNERSHIP).filter(
      (key) => key in (record.metadata as Record<string, unknown>),
    ),
    [],
  );
  assert.deepEqual(record.content, [{ type: "text", text: "an edited reply" }]);
});

test("the strip covers the backend's whole server-managed key set", async () => {
  const record = await saveOwnedReply({
    ...CUSTOM,
    serverManaged: true,
    researchRunId: "research-1",
    researchStatus: "completed",
    researchPlanRevision: 2,
    researchRun: { id: "research-1" },
  });

  assert.deepEqual(withoutRevision(record.metadata), CUSTOM);
});

test("a reply whose only metadata was the run's claim writes only its revision", async () => {
  const record = await saveOwnedReply({ ...GENERATION_OWNERSHIP });

  assert.deepEqual(withoutRevision(record.metadata), {});
});

for (const kind of ["attachment", "content-hash", "legacy-content"] as const) {
  test(`deleting an upload (${kind}) invalidates saved usage in the loaded branch and after hydration`, async () => {
    const exported = thread([{ type: "text", text: "reply" }]);
    const user = exported.messages[0].message;
    user.metadata = { custom: { revision: 3, keep: "metadata" } };
    const attachmentId =
      kind === "attachment"
        ? "file-1"
        : kind === "content-hash"
          ? "content-part-sha256-test"
          : "content-part-1";
    if (kind === "attachment") {
      user.attachments = [
        { id: attachmentId, content: [{ type: "text", text: "large file" }] },
      ];
    } else {
      (user.content as unknown[]).push({
        type: "image",
        image: "data:image/png;base64,AA==",
      });
    }
    const records = () =>
      exported.messages.map((item) =>
        RECORD_MODULE.exportedItemToRecord(
          "thread-1",
          item.parentId,
          item.message,
        ),
      );
    const usage = {
      promptTokens: 4000,
      completionTokens: 10,
      totalTokens: 4010,
      cachedTokens: 0,
      modelId: "model",
      ...contextUsageMarkers(records()),
    };
    exported.messages[1].message.metadata = { custom: { contextUsage: usage } };
    assert.equal(branchContextUsage(records(), "model", 8192, 8192), usage);
    const h = attachmentDeletionHarness(exported, async () => {
      await Promise.resolve();
      return attachmentId;
    });
    await h.remove(attachmentId);
    assert.equal(h.imports(), 1);
    const saved = records();
    assert.deepEqual(saved[0].metadata, { revision: 4, keep: "metadata" });
    assert.equal(
      branchContextUsage(saved, "model", 8192, 8192)?.estimated,
      true,
    );
    const reloaded = [
      hydrateUser(saved[0]),
      exported.messages[1].message as unknown as ThreadMessage,
    ];
    assert.equal(revisionTotal(reloaded), 4);
    assert.equal(
      branchContextUsage(threadBranchRecords(reloaded), "model", 8192, 8192)
        ?.estimated,
      true,
    );
    await h.remove(attachmentId);
    assert.equal(h.imports(), 1);
    assert.equal(records()[0].metadata?.revision, 4);
  });
}

test("an attachment removed during hashing does not revise the message again", async () => {
  const exported = thread([{ type: "text", text: "reply" }]);
  const attachmentId = "content-part-sha256-document";
  const user = exported.messages[0].message;
  user.attachments = [{ id: attachmentId }];
  user.content = [{ type: "image", image: "data:image/png;base64,AA==" }];
  user.metadata = { custom: { revision: 3 } };
  const h = attachmentDeletionHarness(exported, async () => {
    await Promise.resolve();
    exported.messages[0].message = {
      ...user,
      attachments: [],
      metadata: { custom: { revision: 4, keep: "new metadata" } },
    };
    return "content-part-sha256-image";
  });
  await h.remove(attachmentId);
  assert.deepEqual(exported.messages[0].message.metadata, {
    custom: { revision: 4, keep: "new metadata" },
  });
});
