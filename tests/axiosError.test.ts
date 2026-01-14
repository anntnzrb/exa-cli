import { beforeEach, describe, expect, it, vi } from "vitest";
import { axiosMock } from "./helpers/axiosMock.js";
import { getAxiosErrorInfo, logAxiosError } from "../src/utils/axiosError.js";

describe("axiosError utils", () => {
  beforeEach(() => {
    axiosMock.reset();
  });

  it("returns undefined for non-axios errors", () => {
    const info = getAxiosErrorInfo({ isAxiosError: false });
    expect(info).toBeUndefined();
  });

  it("extracts response message and logs response body", () => {
    const error = {
      isAxiosError: true,
      message: "fallback",
      response: {
        status: 500,
        data: { message: "bad", extra: "x" }
      }
    };
    const info = getAxiosErrorInfo(error);
    expect(info).toEqual({
      statusCode: 500,
      message: "bad",
      responseBody: JSON.stringify({ message: "bad", extra: "x" })
    });
    const logger = { log: vi.fn() };
    logAxiosError(logger, info!, { includeResponseBody: true });
    expect(logger.log).toHaveBeenCalledWith(`Response body: ${info?.responseBody}`);
    expect(logger.log).toHaveBeenCalledWith("Axios error (500): bad");
  });

  it("falls back to error message when response data has no message", () => {
    const error = {
      isAxiosError: true,
      message: "fallback",
      response: {
        status: 400,
        data: { error: "nope" }
      }
    };
    const info = getAxiosErrorInfo(error);
    expect(info?.message).toBe("fallback");
    expect(info?.responseBody).toBe(JSON.stringify({ error: "nope" }));
  });

  it("ignores non-string message values", () => {
    const error = {
      isAxiosError: true,
      message: "fallback",
      response: {
        status: 418,
        data: { message: 123 }
      }
    };
    const info = getAxiosErrorInfo(error);
    expect(info?.message).toBe("fallback");
    expect(info?.responseBody).toBe(JSON.stringify({ message: 123 }));
  });

  it("uses error message when response data is a string", () => {
    const error = {
      isAxiosError: true,
      message: "fallback",
      response: {
        status: 503,
        data: "bad request"
      }
    };
    const info = getAxiosErrorInfo(error);
    expect(info).toEqual({
      statusCode: 503,
      message: "fallback",
      responseBody: "bad request"
    });
  });

  it("handles missing response data and skips response body log", () => {
    const error = { isAxiosError: true, message: "fallback" };
    const info = getAxiosErrorInfo(error);
    expect(info).toEqual({
      statusCode: "unknown",
      message: "fallback",
      responseBody: undefined
    });
    const logger = { log: vi.fn() };
    logAxiosError(logger, info!, { includeResponseBody: true });
    expect(logger.log).toHaveBeenCalledTimes(1);
    expect(logger.log).toHaveBeenCalledWith("Axios error (unknown): fallback");
  });

  it("skips response body log when not requested", () => {
    const error = {
      isAxiosError: true,
      message: "fallback",
      response: {
        status: 401,
        data: { message: "unauthorized" }
      }
    };
    const info = getAxiosErrorInfo(error);
    const logger = { log: vi.fn() };
    logAxiosError(logger, info!);
    expect(logger.log).toHaveBeenCalledTimes(1);
    expect(logger.log).toHaveBeenCalledWith("Axios error (401): unauthorized");
  });
});
