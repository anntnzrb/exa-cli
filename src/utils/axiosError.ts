import axios from "axios";

export type AxiosErrorInfo = {
  statusCode: number | string;
  message: string;
  responseBody?: string;
};

const getResponseMessage = (data: unknown): string | undefined => {
  if (typeof data !== "object" || data === null) {
    return undefined;
  }
  if (!("message" in data)) {
    return undefined;
  }
  const message = (data as { message?: unknown }).message;
  return typeof message === "string" ? message : undefined;
};

export const getAxiosErrorInfo = (error: unknown): AxiosErrorInfo | undefined => {
  if (!axios.isAxiosError(error)) {
    return undefined;
  }
  const data = error.response?.data;
  const statusCode = error.response?.status ?? "unknown";
  const responseMessage = getResponseMessage(data);
  const message = responseMessage ?? error.message;
  const responseBody =
    data === undefined
      ? undefined
      : typeof data === "string"
        ? data
        : JSON.stringify(data);
  return {
    statusCode,
    message,
    responseBody
  };
};

export const logAxiosError = (
  logger: { log: (message: string) => void },
  info: AxiosErrorInfo,
  options?: { includeResponseBody?: boolean }
): void => {
  if (options?.includeResponseBody && info.responseBody !== undefined) {
    logger.log(`Response body: ${info.responseBody}`);
  }
  logger.log(`Axios error (${info.statusCode}): ${info.message}`);
};
