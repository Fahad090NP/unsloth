// SPDX-License-Identifier: AGPL-3.0-only
// Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { AUTH_SESSION_STORED_EVENT, getAuthSessionEpoch, hasSettledAuthSession } from "@/features/auth";
import { notifyChatHistoryUpdated, useChatNavigationStore } from "@/features/chat";
import { translate } from "@/i18n";
import { browserAccountKey } from "@/lib/account-transition";
import { isTauri } from "@/lib/api-base";
import { notifyNative } from "@/lib/native-notifications";
import { toast } from "@/lib/toast";
import { type FinishedScheduledTaskRun, getScheduledTaskActivity } from "./api";
import {
  IDLE_POLL_MS,
  asksToLoadModel,
  SCHEDULED_TASKS_CHANGED_EVENT,
  SCHEDULED_TASKS_WRITTEN_KEY,
  SCHEDULED_TASK_RUNS_FINISHED_EVENT,
  SEEN_KEY_PREFIX,
  type SeenRuns,
  claimAnnouncements,
  collectFinishedRuns,
  nextPollDelay,
  pollDelayFor,
  readSeenRuns,
  runErrorText,
  runsToAnnounce,
  runsAskingToLoad,
  runsToNotify,
  readInRecents,
  unseenChatChanges,
  shouldSaveSeen,
} from "./results";
import { useUnseenScheduledRuns } from "./unseen";

// More than this at once, e.g. on reopening Studio, and one toast speaks for them all.
const INDIVIDUAL_TOASTS = 2;
const ModelLoadPrompt = lazy(() => import("./model-load-prompt"));
const RECHECK_MS = 500;
// Lock one tab holds while claiming what to announce (account name appended).
const ANNOUNCE_LOCK_PREFIX = "unsloth-scheduled-task-results:";

/** The signed-in account the record belongs to, by id so a recreated name starts afresh. */
function currentAccount(): string {
  return browserAccountKey();
}

function loadSeen(account: string): SeenRuns | null {
  try {
    return readSeenRuns(localStorage.getItem(SEEN_KEY_PREFIX + account));
  } catch {
    return null;
  }
}

function saveSeen(account: string, seen: SeenRuns): void {
  try {
    localStorage.setItem(SEEN_KEY_PREFIX + account, JSON.stringify(seen));
  } catch {
    // Without storage the next launch only announces runs from then on.
  }
}

/** `claim` under a Web Lock where available (secure contexts); elsewhere two tabs may both announce. */
async function exclusively<T>(name: string, claim: () => T): Promise<T> {
  const locks = (navigator as Partial<Navigator>).locks;
  if (!locks) return claim();
  const state = { claimed: false };
  try {
    return await locks.request(name, () => {
      state.claimed = true;
      return claim();
    });
  } catch (error) {
    if (state.claimed) throw error;
    return claim();
  }
}

function windowIsInBackground(): boolean {
  return (
    document.visibilityState !== "visible" ||
    (typeof document.hasFocus === "function" && !document.hasFocus())
  );
}

function notifySystem(runs: FinishedScheduledTaskRun[]): void {
  const [run] = runs;
  const single = runs.length === 1;
  const title = !single
    ? translate("scheduledTasks.toast.many", { count: runs.length })
    : run.status === "succeeded"
      ? translate("scheduledTasks.toast.finished", { title: run.taskTitle })
      : translate("scheduledTasks.toast.failed", { title: run.taskTitle });
  const body = !single
    ? runs.map((entry) => entry.taskTitle).join(", ")
    : run.status === "succeeded"
      ? translate("scheduledTasks.notificationBody")
      : runErrorText(run, translate);
  if (isTauri) {
    notifyNative({
      key: `scheduled-task:${runs.map((entry) => entry.id).join(",")}`,
      title,
      body,
      requestPermission: false,
    }).catch((err: unknown) => {
      console.error("Failed to show native notification:", err);
    });
    return;
  }
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    const notification = new Notification(title, { body });
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  } catch {
    // Some browsers only allow notifications from a service worker.
  }
}

/** Watches for scheduled results: refreshes Recents, marks chats unread, toasts and notifies. Renders nothing. */
export function ScheduledTaskRunNotifier() {
  const navigate = useNavigate();
  const [asking, setAsking] = useState<FinishedScheduledTaskRun[]>([]);
  const navigateRef = useRef(navigate);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const pathnameRef = useRef(pathname);
  const openThread = useRouterState({
    select: (state) => (state.location.search as { thread?: unknown }).thread,
  });
  useEffect(() => {
    if (typeof openThread === "string") useUnseenScheduledRuns.getState().clearThread(openThread);
  }, [openThread]);
  // Recents' unread marks follow the account's stored unseen results, so every tab and a reload
  // show them, and opening one anywhere clears it everywhere.
  useEffect(() => {
    const sync = (now: readonly string[], before: readonly string[]) => {
      const chats = useChatNavigationStore.getState();
      const { added, opened } = unseenChatChanges(now, before);
      const fresh = added.filter((id) => !chats.unreadThreadIds.has(id));
      if (fresh.length > 0) chats.markThreadsUnread(fresh);
      if (opened.length > 0) chats.clearThreadsUnread(opened);
    };
    sync(useUnseenScheduledRuns.getState().threads, []);
    const offUnseen = useUnseenScheduledRuns.subscribe((state, previous) => {
      if (state.threads !== previous.threads) sync(state.threads, previous.threads);
    });
    // Read in Recents (opened, "Mark as read", all at once) is read for good. A sign-out's reset
    // comes after the token is gone, when the record is out of reach and stays as it was.
    const offChats = useChatNavigationStore.subscribe((state, previous) => {
      if (state.unreadThreadIds === previous.unreadThreadIds) return;
      const unseen = useUnseenScheduledRuns.getState();
      for (const id of readInRecents(unseen.threads, previous.unreadThreadIds, state.unreadThreadIds)) {
        unseen.clearThread(id);
      }
    });
    return () => {
      offUnseen();
      offChats();
    };
  }, []);
  useEffect(() => {
    navigateRef.current = navigate;
    pathnameRef.current = pathname;
  }, [navigate, pathname]);

  useEffect(() => {
    const state = {
      disposed: false,
      polling: false,
      recheckAfterPoll: false,
      account: null as string | null,
      seen: null as SeenRuns | null,
      lastState: "",
      lastDelay: 0,
    };
    let timer: ReturnType<typeof setTimeout> | null = null;
    // Read through a call: the cleanup below flips this after the poll's awaits.
    const isDisposed = (): boolean => state.disposed;

    const openChat = (threadId: string) => {
      navigateRef.current({ to: "/chat", search: { thread: threadId } }).catch((err: unknown) => {
        console.error("Navigation to chat failed:", err);
      });
    };
    const openTasks = () => {
      navigateRef.current({ to: "/tasks" }).catch((err: unknown) => {
        console.error("Navigation to tasks failed:", err);
      });
    };

    const refreshFor = (finished: FinishedScheduledTaskRun[]) => {
      if (finished.some((run) => run.status === "succeeded" && run.threadId)) {
        notifyChatHistoryUpdated();
      }
      window.dispatchEvent(new Event(SCHEDULED_TASK_RUNS_FINISHED_EVENT));
    };

    // Only the claiming tab records and notifies, so it cannot revive a dot cleared in a faster tab.
    const announce = (claimed: FinishedScheduledTaskRun[]) => {
      const runs = runsToAnnounce(claimed);
      if (runs.length === 0) return;
      useUnseenScheduledRuns.getState().markFinished(
        runs.map((run) => ({
          taskId: run.taskId,
          threadId: run.status === "succeeded" ? run.threadId : null,
        })),
        pathnameRef.current === "/tasks",
      );
      const asks = runsAskingToLoad(runs);
      if (asks.length > 0) {
        setAsking((current) => [
          ...current.filter((run) => !asks.some((ask) => ask.taskId === run.taskId)),
          ...asks,
        ]);
      }
      const notified = runsToNotify(runs.filter((run) => !asksToLoadModel(run)));
      if (notified.length === 0) return;
      if (notified.length > INDIVIDUAL_TOASTS) {
        toast(translate("scheduledTasks.toast.many", { count: notified.length }), {
          action: { label: translate("scheduledTasks.toast.view"), onClick: openTasks },
        });
      } else {
        for (const run of notified) {
          const threadId = run.threadId;
          if (run.status === "succeeded" && threadId) {
            toast.success(translate("scheduledTasks.toast.finished", { title: run.taskTitle }), {
              action: {
                label: translate("scheduledTasks.toast.open"),
                onClick: () => { openChat(threadId); },
              },
            });
          } else {
            toast.error(translate("scheduledTasks.toast.failed", { title: run.taskTitle }), {
              description: runErrorText(run, translate),
              action: { label: translate("scheduledTasks.toast.view"), onClick: openTasks },
            });
          }
        }
      }
      if (windowIsInBackground()) notifySystem(notified);
    };

    const schedule = (delay: number) => {
      if (state.disposed) return;
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => {
        poll().catch((err: unknown) => {
          console.error("Poll failed:", err);
        });
      }, delay);
    };

    const poll = async () => {
      if (state.disposed || state.polling) return;
      if (!hasSettledAuthSession()) {
        schedule(IDLE_POLL_MS);
        return;
      }
      const owner = currentAccount();
      if (owner !== state.account) {
        state.account = owner;
        state.seen = loadSeen(owner);
        state.lastState = "";
      }
      const epoch = getAuthSessionEpoch();
      state.polling = true;
      try {
        const result = await collectFinishedRuns(state.seen, getScheduledTaskActivity);
        const mine = await exclusively(ANNOUNCE_LOCK_PREFIX + owner, () => {
          if (state.disposed || getAuthSessionEpoch() !== epoch || currentAccount() !== owner) return null;
          const stored = loadSeen(owner);
          const claim = claimAnnouncements(stored, result.seen, result.fresh);
          if (shouldSaveSeen(stored, claim.record, claim.mine.length)) saveSeen(owner, claim.record);
          return claim.mine;
        });
        if (isDisposed()) return;
        if (mine === null) {
          Object.assign(state, { recheckAfterPoll: true });
          return;
        }
        Object.assign(state, { seen: result.seen });
        const nextAt = result.last.nextRunAt !== null ? String(result.last.nextRunAt) : "";
        const nextState = `${result.last.activeRuns}:${nextAt}`;
        // The first answer only sets the baseline: a page that just mounted read its own list.
        const changed = result.fresh.length > 0 || (state.lastState !== "" && nextState !== state.lastState);
        Object.assign(state, { lastState: nextState });
        if (changed) refreshFor(result.fresh);
        if (mine.length > 0) announce(mine);
        Object.assign(state, {
          lastDelay: nextPollDelay(result.last, changed ? 0 : state.lastDelay),
        });
        schedule(pollDelayFor(state.lastDelay, document.visibilityState === "hidden"));
      } catch {
        schedule(IDLE_POLL_MS);
      } finally {
        Object.assign(state, { polling: false });
        if (state.recheckAfterPoll) {
          Object.assign(state, { recheckAfterPoll: false });
          schedule(RECHECK_MS);
        }
      }
    };

    const recheck = () => {
      state.lastDelay = 0;
      if (state.polling) state.recheckAfterPoll = true;
      else schedule(RECHECK_MS);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") recheck();
    };
    // Another tab's change: it may have made a task due sooner than this tab's next look.
    const onStorage = (event: StorageEvent) => {
      if (event.key === SCHEDULED_TASKS_WRITTEN_KEY) recheck();
    };
    window.addEventListener(SCHEDULED_TASKS_CHANGED_EVENT, recheck);
    window.addEventListener("storage", onStorage);
    window.addEventListener(AUTH_SESSION_STORED_EVENT, recheck);
    window.addEventListener("focus", recheck);
    document.addEventListener("visibilitychange", onVisible);
    poll().catch((err: unknown) => {
      console.error("Initial poll failed:", err);
    });
    return () => {
      state.disposed = true;
      if (timer !== null) clearTimeout(timer);
      window.removeEventListener(SCHEDULED_TASKS_CHANGED_EVENT, recheck);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(AUTH_SESSION_STORED_EVENT, recheck);
      window.removeEventListener("focus", recheck);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const ask = asking.at(0);
  if (!ask) return null;
  return (
    <Suspense fallback={null}>
      <ModelLoadPrompt
        key={ask.id}
        run={ask}
        // By id: Load and run closes the dialog too, and both must not drop the next prompt.
        onDone={() => { setAsking((current) => current.filter((run) => run.id !== ask.id)); }}
      />
    </Suspense>
  );
}
