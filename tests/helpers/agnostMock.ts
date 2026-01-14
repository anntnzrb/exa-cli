import { vi } from "vitest";

vi.mock("agnost", () => ({
  checkpoint: vi.fn()
}));

if (!(globalThis as { Bun?: { env?: Record<string, string> } }).Bun) {
  (globalThis as { Bun?: { env: Record<string, string> } }).Bun = { env: {} };
} else if (!(globalThis as { Bun?: { env?: Record<string, string> } }).Bun?.env) {
  (globalThis as { Bun?: { env: Record<string, string> } }).Bun!.env = {};
}
