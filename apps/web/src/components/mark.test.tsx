import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AccountBadge } from "./account-badge";
import { Mark } from "./mark";

describe("Mark", () => {
  it("has an accessible name, so it is not a decorative blank", () => {
    render(<Mark />);

    expect(screen.getByRole("img", { name: "M4" })).toBeInTheDocument();
  });

  it("points at the cropped banner asset", () => {
    render(<Mark />);

    expect(screen.getByRole("img", { name: "M4" })).toHaveAttribute("src", "/mark.svg");
  });

  it("renders at icon scale by default and honours an explicit size", () => {
    const { rerender } = render(<Mark />);
    expect(screen.getByRole("img", { name: "M4" })).toHaveAttribute("width", "32");

    rerender(<Mark size={64} />);
    expect(screen.getByRole("img", { name: "M4" })).toHaveAttribute("width", "64");
  });
});

describe("AccountBadge", () => {
  it("shows a tenant user's display name and address", () => {
    render(<AccountBadge displayName="Hanako Tanaka" email="hanako@example.com" />);

    expect(screen.getByText("Hanako Tanaka")).toBeInTheDocument();
    expect(screen.getByText("hanako@example.com")).toBeInTheDocument();
  });

  it("shows just the address for an operator, who has no display name", () => {
    render(<AccountBadge email="ops@example.com" />);

    expect(screen.getByText("ops@example.com")).toBeInTheDocument();
  });
});
