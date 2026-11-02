// SPDX-License-Identifier: AGPL-3.0-only
import { canvasBlob, decodeImage } from "./image";
import type { BackgroundEffect } from "./model";

interface Job { promise: Promise<Blob>; release: () => void }
type JobEntry = { promise: Promise<Blob>; users: number; cancel: () => void };
const cache = new WeakMap<Blob, Map<string, Blob>>();
const jobs = new WeakMap<Blob, Map<string, JobEntry>>();
/** Shared by chat and previews: the last release cancels pixel work; blobs are cached, never URLs. */
export function acquireRender(
	blob: Blob,
	effect: BackgroundEffect,
	light: boolean,
): Job {
	if (effect === "None")
		return { promise: Promise.resolve(blob), release: () => { /* no-op */ } };
	const key = `${effect}:${String(effect === "Dither" ? false : light)}`;
	const cached = cache.get(blob)?.get(key);
	if (cached) return { promise: Promise.resolve(cached), release: () => { /* no-op */ } };
	const pending = jobs.get(blob) ?? new Map<string, JobEntry>();
	jobs.set(blob, pending);
	let entry = pending.get(key);
	if (!entry) {
		let cancelled = false,
			worker: Worker | undefined,
			rejectJob: (reason: Error) => void = () => { /* no-op */ };
		const promise = new Promise<Blob>((resolve, reject) => {
			rejectJob = reject;
			void (async () => {
				const decoded = await decodeImage(blob);
				const canvas = document.createElement("canvas");
				canvas.width = decoded.width;
				canvas.height = decoded.height;
				const ctx = canvas.getContext("2d", { willReadFrequently: true });
				try {
					if (cancelled) return;
					if (!ctx) throw new Error("effect");
					ctx.drawImage(decoded.source, 0, 0);
				} finally {
					decoded.close();
				}
				const pixels = ctx.getImageData(
					0,
					0,
					canvas.width,
					canvas.height,
				).data;
				worker = new Worker(new URL("./worker.ts", import.meta.url), {
					type: "module",
				});
				worker.onerror = () => { reject(new Error("effect")); };
				worker.onmessage = ({
					data,
				}: MessageEvent<{ pixels?: Uint8ClampedArray; error?: boolean }>) => {
					worker?.terminate();
					if (cancelled) return;
					if (!data.pixels) {
						reject(new Error("effect"));
						return;
					}
					ctx.putImageData(
						new ImageData(
							new Uint8ClampedArray(data.pixels),
							canvas.width,
							canvas.height,
						),
						0,
						0,
					);
					void canvasBlob(canvas).then(resolve, reject);
				};
				worker.postMessage(
					{ pixels, width: canvas.width, height: canvas.height, effect, light },
					[pixels.buffer],
				);
			})().catch(reject);
		})
			.then((result) => {
				if (!cancelled) {
					const images = cache.get(blob) ?? new Map<string, Blob>();
					images.set(key, result);
					const firstKey = images.keys().next().value;
					if (images.size > 4 && firstKey !== undefined) images.delete(firstKey);
					cache.set(blob, images);
				}
				return result;
			})
			.finally(() => {
				worker?.terminate();
				if (pending.get(key)?.promise === promise) pending.delete(key);
			});
		entry = {
			promise,
			users: 0,
			cancel: () => {
				cancelled = true;
				worker?.terminate();
				rejectJob(new Error("cancelled"));
			},
		};
		pending.set(key, entry);
	}
	const currentEntry = entry;
	currentEntry.users++;
	let released = false;
	return {
		promise: currentEntry.promise,
		release: () => {
			if (released) return;
			released = true;
			if (--currentEntry.users === 0 && pending.get(key) === currentEntry) {
				pending.delete(key);
				currentEntry.cancel();
			}
		},
	};
}
