import { fireEvent, render } from "@testing-library/react-native";
import type { PlanBundle } from "@passport-quest/shared";
import { PlanCard } from "./PlanCard";

const plan: PlanBundle = {
  planId: "plan_1",
  title: "Evening Date Plan",
  summary: "A short evening plan with one calm stop.",
  estimatedDurationMin: 120,
  estimatedSpendBand: "medium",
  whyRecommended: ["Fits a medium budget", "Great for couple vibe"],
  stops: [
    {
      questId: "quest_1",
      title: "Sky View Point",
      order: 1,
      visitDurationMin: 90,
      storySnippet: "A sunset stop with a view.",
      practicalDetails: ["Reach before sunset"],
    },
  ],
};

describe("PlanCard", () => {
  it("renders plan details and why recommended section", () => {
    const { getByText } = render(<PlanCard plan={plan} />);

    expect(getByText("Evening Date Plan")).toBeTruthy();
    expect(getByText("A short evening plan with one calm stop.")).toBeTruthy();
    expect(getByText("Why this is recommended")).toBeTruthy();
    expect(getByText("Fits a medium budget")).toBeTruthy();
    expect(getByText("Find Plans")).toBeTruthy();
  });

  it("triggers open/start/save/share handlers", () => {
    const onOpen = jest.fn();
    const onStart = jest.fn();
    const onSave = jest.fn();
    const onShare = jest.fn();

    const { getByText } = render(
      <PlanCard
        plan={plan}
        onOpen={onOpen}
        onStart={onStart}
        onSave={onSave}
        onShare={onShare}
      />,
    );

    fireEvent.press(getByText("Evening Date Plan"));
    fireEvent.press(getByText("Find Plans"));
    fireEvent.press(getByText("Save"));
    fireEvent.press(getByText("Share"));

    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onShare).toHaveBeenCalledTimes(1);
  });
});
