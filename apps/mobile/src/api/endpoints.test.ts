import {
  completeQuest,
  getHealth,
  getIncomingFriendRequests,
  getNearbyQuests,
} from "./endpoints";
import { apiRequest } from "./http";

jest.mock("./http", () => ({
  apiRequest: jest.fn(),
}));

describe("API endpoint contracts", () => {
  beforeEach(() => {
    (apiRequest as jest.Mock).mockResolvedValue({});
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("calls nearby quests contract", async () => {
    await getNearbyQuests({
      cityId: "blr",
      lat: 12.9763,
      lng: 77.5929,
      radiusM: 1200,
    });
    expect(apiRequest).toHaveBeenCalledWith({
      method: "GET",
      path: "/quests/nearby",
      query: {
        cityId: "blr",
        lat: 12.9763,
        lng: 77.5929,
        radiusM: 1200,
      },
    });
  });

  it("calls completion contract", async () => {
    await completeQuest({
      questId: "quest-1",
      occurredAt: "2026-02-22T00:00:00.000Z",
      location: { lat: 1, lng: 2, accuracyM: 10 },
      deviceEventId: "evt-1",
    });
    expect(apiRequest).toHaveBeenCalledWith({
      method: "POST",
      path: "/quests/complete",
      body: {
        questId: "quest-1",
        occurredAt: "2026-02-22T00:00:00.000Z",
        location: { lat: 1, lng: 2, accuracyM: 10 },
        deviceEventId: "evt-1",
      },
    });
  });

  it("uses pending status by default for incoming friend requests", async () => {
    await getIncomingFriendRequests();
    expect(apiRequest).toHaveBeenCalledWith({
      method: "GET",
      path: "/social/friend-requests/incoming",
      query: { status: "pending", limit: 30 },
    });
  });

  it("calls health contract", async () => {
    await getHealth();
    expect(apiRequest).toHaveBeenCalledWith({
      method: "GET",
      path: "/health",
    });
  });
});
