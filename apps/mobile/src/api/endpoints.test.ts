import {
  completeQuest,
  deleteSavedPlan,
  getRecommendedPlans,
  getSavedPlans,
  getHealth,
  getIncomingFriendRequests,
  getNearbyQuests,
  savePlan,
  startTripContext,
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

  it("calls trip context start contract", async () => {
    await startTripContext({
      cityId: "blr",
      contextType: "couple",
      timeBudgetMin: 180,
      budget: "medium",
      pace: "balanced",
      vibeTags: ["romantic"],
      constraints: {},
    });
    expect(apiRequest).toHaveBeenCalledWith({
      method: "POST",
      path: "/trips/context/start",
      body: {
        cityId: "blr",
        contextType: "couple",
        timeBudgetMin: 180,
        budget: "medium",
        pace: "balanced",
        vibeTags: ["romantic"],
        constraints: {},
      },
    });
  });

  it("calls recommended plans contract", async () => {
    await getRecommendedPlans({
      cityId: "blr",
      tripContextId: "ctx_123",
      limit: 3,
    });
    expect(apiRequest).toHaveBeenCalledWith({
      method: "GET",
      path: "/plans/recommended",
      query: {
        cityId: "blr",
        tripContextId: "ctx_123",
        limit: 3,
      },
    });
  });

  it("calls save/get/delete saved plans contracts", async () => {
    await savePlan({
      planId: "plan_123",
      tripContextId: "ctx_123",
      cityId: "blr",
      planPayload: {
        planId: "plan_123",
        title: "Date Plan",
        summary: "Evening plan",
        estimatedDurationMin: 120,
        estimatedSpendBand: "medium",
        whyRecommended: ["Fits your budget", "Great for couples"],
        stops: [
          {
            questId: "quest_1",
            title: "Stop 1",
            order: 1,
            visitDurationMin: 60,
            storySnippet: "Story",
            practicalDetails: ["Detail 1"],
          },
        ],
      },
    });
    expect(apiRequest).toHaveBeenCalledWith({
      method: "POST",
      path: "/plans/save",
      body: {
        planId: "plan_123",
        tripContextId: "ctx_123",
        cityId: "blr",
        planPayload: {
          planId: "plan_123",
          title: "Date Plan",
          summary: "Evening plan",
          estimatedDurationMin: 120,
          estimatedSpendBand: "medium",
          whyRecommended: ["Fits your budget", "Great for couples"],
          stops: [
            {
              questId: "quest_1",
              title: "Stop 1",
              order: 1,
              visitDurationMin: 60,
              storySnippet: "Story",
              practicalDetails: ["Detail 1"],
            },
          ],
        },
      },
    });

    await getSavedPlans(20, "cursor_1");
    expect(apiRequest).toHaveBeenCalledWith({
      method: "GET",
      path: "/plans/saved",
      query: { limit: 20, cursor: "cursor_1" },
    });

    await deleteSavedPlan("plan_123");
    expect(apiRequest).toHaveBeenCalledWith({
      method: "DELETE",
      path: "/plans/saved/plan_123",
    });
  });
});
