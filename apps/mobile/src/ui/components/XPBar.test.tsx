import { render } from "@testing-library/react-native";
import { XPBar } from "./XPBar";

describe("XPBar", () => {
  it("renders rounded values and label", () => {
    const { getByText } = render(<XPBar value={149.4} max={300} label="Journey" />);
    expect(getByText("Journey")).toBeTruthy();
    expect(getByText("149/300")).toBeTruthy();
  });

  it("guards against zero max", () => {
    const { getByText } = render(<XPBar value={10} max={0} />);
    expect(getByText("10/1")).toBeTruthy();
  });
});
