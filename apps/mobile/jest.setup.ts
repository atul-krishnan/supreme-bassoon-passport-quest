import "@testing-library/jest-native/extend-expect";

jest.mock("expo-constants", () => ({
  expoConfig: {
    extra: {
      appEnv: "local",
      apiBaseUrl: "http://127.0.0.1:54321/functions/v1/v1",
      supabaseUrl: "http://127.0.0.1:54321",
      supabasePublishableKey: "test_key",
      sentryDsn: "",
      posthogHost: "",
      posthogApiKey: "",
      releaseSha: "test-sha",
    },
  },
  easConfig: {
    projectId: "test-project",
  },
}));

jest.mock("@sentry/react-native", () => ({
  init: jest.fn(),
  setTag: jest.fn(),
  setUser: jest.fn(),
  captureException: jest.fn(),
  withScope: (fn: (scope: { setExtra: (k: string, v: unknown) => void }) => void) =>
    fn({ setExtra: jest.fn() }),
}));
