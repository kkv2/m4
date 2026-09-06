import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import HomePage from "./page";

describe("HomePage", () => {
  it("renders the product name and tagline", () => {
    render(<HomePage />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("M4");
    expect(screen.getByText("Multi Model, Multi Modal.")).toBeInTheDocument();
  });
});
