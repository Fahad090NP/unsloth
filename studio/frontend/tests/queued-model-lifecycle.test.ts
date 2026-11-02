import assert from "node:assert/strict";
import vm from "node:vm";
import test from "node:test";
import ts from "@typescript/typescript6";
import { readSrc } from "./helpers/kit.ts";
import {
  ModelLifecycleGate,
  type ModelLifecyclePhase,
} from "../src/features/chat/utils/model-lifecycle-gate.ts";

function required<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) {
    throw new Error("Expected a value");
  }
  return value;
}


const source = ts.createSourceFile(
  "chat-adapter.ts",
  readSrc("features/chat/api/chat-adapter.ts"),
  ts.ScriptTarget.Latest,
  true,
);
const loader = source.statements.find(
  (node) => ts.isFunctionDeclaration(node) && node.name?.text === "resolveQueuedEmptyLocalModel",
);
assert.ok(loader);
const js = ts.transpileModule(
  `${loader.getText(source)}\nreturn resolveQueuedEmptyLocalModel;`,
  {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.Preserve,
    },
  },
).outputText;

for (const busy of [false, true]) {
  test(`chat auto-load admits follow-ups while waiting for the model, busy=${String(busy)}`, async () => {
    const gate = new ModelLifecycleGate();
    const previous = busy ? gate.tryAcquire("preparing") : null;
    const leases: number[] = [];
    let finish!: (result: { loaded: boolean; blockedByTrustRemoteCode: boolean }) => void;
    const loading = new Promise<{ loaded: boolean; blockedByTrustRemoteCode: boolean }>(
      (resolve) => { finish = resolve; },
    );
    const deps = {
      useChatRuntimeStore: {
        getState: () => ({
          params: { checkpoint: "" },
          beginModelLoading: (phase?: ModelLifecyclePhase) => {
            const lease = gate.tryAcquire(phase);
            if (lease !== null) leases.push(lease);
            return lease;
          },
          endModelLoading: (lease: number) => gate.release(lease),
        }),
      },
      waitForModelReady:  () => {
        assert.notEqual(previous, null);
        gate.release(required(previous));
      return Promise.resolve(); },
      isExternalModelId: () => false,
      autoLoadSmallestModel: () => loading,
      queuedResolvedModelFromStore: () => null,
    };
    const load = (
      vm.compileFunction(js, Object.keys(deps)) as (
        ...args: unknown[]
      ) => (signal: AbortSignal) => Promise<{ loaded: boolean }>
    )(...Object.values(deps));
    const result = load(new AbortController().signal);
    await Promise.resolve();
    try {
      assert.equal(leases.length, 1);
      assert.equal(gate.tryAcquire(), null, "the load must still own the lifecycle");
      assert.equal(gate.canQueue(), true, "follow-ups remain available during chat auto-load");
    } finally {
      finish({ loaded: true, blockedByTrustRemoteCode: false });
      await result;
    }
    assert.equal(gate.canQueue(), true);
    const next = gate.tryAcquire("unloading");
    assert.notEqual(next, null, "the load releases its lifecycle");
    gate.release(required(next));
  });
}
