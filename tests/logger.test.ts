import { describe, expect, it, vi } from "vitest";
import { createRequestLogger, log } from "../src/utils/logger.js";

describe("logger", () => {
  it("writes log messages", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    log("hello");
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("uses request logger helpers", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const logger = createRequestLogger("req-1", "tool");
    logger.start("query");
    logger.log("info");
    logger.error(new Error("boom"));
    logger.complete();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
