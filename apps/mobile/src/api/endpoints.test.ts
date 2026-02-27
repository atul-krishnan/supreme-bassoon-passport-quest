import {
  getBootstrapConfig,
  getFlowStateSummary,
  getHealth,
  getHeroPlay,
  getPlaySession,
  getUserSummary,
  markPlayStepDone,
  saveFlowDiagnostic,
  startPlaySession,
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

  it("calls bootstrap config contract", async () => {
    await getBootstrapConfig("blr");
    expect(apiRequest).toHaveBeenCalledWith({
      method: "GET",
      path: "/config/bootstrap",
      query: { cityId: "blr" },
    });
  });

  it("calls user summary contract", async () => {
    await getUserSummary();
    expect(apiRequest).toHaveBeenCalledWith({
      method: "GET",
      path: "/users/me/summary",
    });
  });

  it("calls save diagnostic contract", async () => {
    await saveFlowDiagnostic({
      energyBaseline: "balanced",
      focusPillar: "deep_work",
      frictionPoint: "decision_paralysis",
    });
    expect(apiRequest).toHaveBeenCalledWith({
      method: "POST",
      path: "/flowstate/diagnostic",
      body: {
        energyBaseline: "balanced",
        focusPillar: "deep_work",
        frictionPoint: "decision_paralysis",
      },
    });
  });

  it("calls hero play contract with city context", async () => {
    await getHeroPlay("blr");
    expect(apiRequest).toHaveBeenCalledWith({
      method: "GET",
      path: "/flowstate/play/hero",
      query: { cityId: "blr" },
    });
  });

  it("calls hero play contract without city context", async () => {
    await getHeroPlay();
    expect(apiRequest).toHaveBeenCalledWith({
      method: "GET",
      path: "/flowstate/play/hero",
      query: undefined,
    });
  });

  it("calls start play session contract", async () => {
    await startPlaySession({
      recommendationId: "rec-1",
    });
    expect(apiRequest).toHaveBeenCalledWith({
      method: "POST",
      path: "/flowstate/play/start",
      body: {
        recommendationId: "rec-1",
      },
    });
  });

  it("calls get play session contract", async () => {
    await getPlaySession("session/1");
    expect(apiRequest).toHaveBeenCalledWith({
      method: "GET",
      path: "/flowstate/play/sessions/session%2F1",
    });
  });

  it("calls mark step done contract", async () => {
    await markPlayStepDone("session/1", 2);
    expect(apiRequest).toHaveBeenCalledWith({
      method: "POST",
      path: "/flowstate/play/sessions/session%2F1/steps/2/done",
    });
  });

  it("calls flow state summary contract", async () => {
    await getFlowStateSummary();
    expect(apiRequest).toHaveBeenCalledWith({
      method: "GET",
      path: "/flowstate/summary",
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
