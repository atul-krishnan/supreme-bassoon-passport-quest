jest.mock("../state/session", () => {
  const store = Object.assign(jest.fn(), {
    getState: jest.fn(),
  });
  return {
    __esModule: true,
    useSessionStore: store,
  };
});

import { apiRequest } from "./http";

type SessionState = {
  accessToken: string | null;
  refreshAccessToken: jest.Mock<Promise<string | null>, []>;
  bootstrapSession: jest.Mock<Promise<void>, []>;
};

const mockedSessionModule = jest.requireMock("../state/session") as {
  useSessionStore: {
    getState: jest.Mock;
  };
};

describe("apiRequest", () => {
  beforeEach(() => {
    const state: SessionState = {
      accessToken: "token-initial",
      refreshAccessToken: jest.fn(async () => null),
      bootstrapSession: jest.fn(async () => undefined),
    };
    mockedSessionModule.useSessionStore.getState.mockReturnValue(state);
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("sends request with bearer token", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: "ok" }),
      text: async () => "",
    });

    const result = await apiRequest<{ status: string }>({
      method: "GET",
      path: "/health",
    });

    expect(result.status).toBe("ok");
    expect(global.fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:54321/functions/v1/v1/health",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer token-initial",
        }),
      }),
    );
  });

  it("retries once after invalid jwt with refreshed token", async () => {
    const state: SessionState = {
      accessToken: "token-expired",
      refreshAccessToken: jest.fn(async () => "token-refreshed"),
      bootstrapSession: jest.fn(async () => undefined),
    };
    mockedSessionModule.useSessionStore.getState.mockImplementation(() => state);

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => "Invalid JWT",
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ status: "ok" }),
        text: async () => "",
      });

    await apiRequest<{ status: string }>({
      method: "GET",
      path: "/health",
    });

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(state.refreshAccessToken).toHaveBeenCalledTimes(1);
    expect((global.fetch as jest.Mock).mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer token-refreshed",
        }),
      }),
    );
  });
});
