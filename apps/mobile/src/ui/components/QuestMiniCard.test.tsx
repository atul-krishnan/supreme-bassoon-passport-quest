import { fireEvent, render } from "@testing-library/react-native";
import { QuestMiniCard } from "./QuestMiniCard";

const quest = {
  id: "quest-1",
  title: "Cubbon Park Morning Walk",
  subtitle: "A calm morning loop",
  xpReward: 120,
  category: "landmark" as const,
  status: "nearby" as const,
};

describe("QuestMiniCard", () => {
  it("renders quest content", () => {
    const { getByText } = render(<QuestMiniCard quest={quest} />);
    expect(getByText("Cubbon Park Morning Walk")).toBeTruthy();
    expect(getByText("Reward: 120 XP")).toBeTruthy();
    expect(getByText("Start")).toBeTruthy();
  });

  it("triggers press handlers", () => {
    const onPress = jest.fn();
    const onStart = jest.fn();
    const { getByText } = render(
      <QuestMiniCard quest={quest} onPress={onPress} onStart={onStart} />,
    );

    fireEvent.press(getByText("Cubbon Park Morning Walk"));
    fireEvent.press(getByText("Start"));

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onStart).toHaveBeenCalledTimes(1);
  });
});
