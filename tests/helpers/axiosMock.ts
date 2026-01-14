import { vi } from "vitest";

const post = vi.fn();
const get = vi.fn();
const create = vi.fn(() => ({ post, get }));
const isAxiosError = vi.fn((err: any) => Boolean(err?.isAxiosError));

vi.mock("axios", () => ({
  default: {
    create,
    isAxiosError
  }
}));

const resetAxiosMock = () => {
  post.mockReset();
  get.mockReset();
  create.mockClear();
  isAxiosError.mockClear();
};

export const axiosMock = { post, get, create, isAxiosError, reset: resetAxiosMock };
