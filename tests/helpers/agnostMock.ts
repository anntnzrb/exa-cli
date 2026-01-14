import { vi } from "vitest";

vi.mock("agnost", () => ({
  checkpoint: vi.fn()
}));
