// SPDX-License-Identifier: AGPL-3.0-only
// Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

interface RandomUuidCrypto {
  getRandomValues?: <T extends ArrayBufferView<ArrayBuffer>>(array: T) => T;
  randomUUID?: () => string;
}

function fillPseudoRandomBytes(bytes: Uint8Array): Uint8Array {
  const output = bytes;
  for (let index = 0; index < output.length; index += 1) {
    output[index] = Math.floor(Math.random() * 256);
  }
  return output;
}

function createRandomBytes(cryptoSource: RandomUuidCrypto | null): Uint8Array {
  const bytes = new Uint8Array(16);
  if (typeof cryptoSource?.getRandomValues !== "function") {
    return fillPseudoRandomBytes(bytes);
  }
  try {
    return cryptoSource.getRandomValues(bytes);
  } catch {
    return fillPseudoRandomBytes(bytes);
  }
}

function formatUuid(bytes: Uint8Array): string {
  const output = bytes;
  output[6] = (output[6] & 0x0f) | 0x40;
  output[8] = (output[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
}

export function createTrainingStartRequestId(
  cryptoSource: RandomUuidCrypto | null = globalThis.crypto,
): string {
  if (typeof cryptoSource?.randomUUID === "function") {
    try {
      return cryptoSource.randomUUID();
    } catch {
      return formatUuid(createRandomBytes(cryptoSource));
    }
  }
  return formatUuid(createRandomBytes(cryptoSource));
}
