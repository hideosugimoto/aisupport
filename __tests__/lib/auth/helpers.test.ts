import { describe, it, expect, vi, beforeEach } from "vitest";
import { requireAuth, AuthError, handleAuthError } from "@/lib/auth/helpers";

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}));

import { auth } from "@clerk/nextjs/server";

const mockAuth = vi.mocked(auth);

describe("requireAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns userId when authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: "user_123" } as never);
    const userId = await requireAuth();
    expect(userId).toBe("user_123");
  });

  it("throws AuthError when not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null } as never);
    await expect(requireAuth()).rejects.toThrow(AuthError);
    await expect(requireAuth()).rejects.toThrow("認証が必要です");
  });
});

describe("AuthError", () => {
  it("has correct name and message", () => {
    const error = new AuthError("test message");
    expect(error.name).toBe("AuthError");
    expect(error.message).toBe("test message");
    expect(error).toBeInstanceOf(Error);
  });
});

describe("handleAuthError", () => {
  it("returns 401 for AuthError", () => {
    const response = handleAuthError(new AuthError("未認証"));
    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(401);
  });

  it("re-throws non-AuthError", () => {
    const genericError = new Error("other error");
    expect(() => handleAuthError(genericError)).toThrow("other error");
  });
});
