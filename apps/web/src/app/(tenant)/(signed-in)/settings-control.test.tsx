import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LanguageProvider } from "~/i18n/language-provider";

// The form has its own tests; this one is about the way in and the way out.
vi.mock("./settings-form", () => ({
  SettingsForm: () => <p>設定フォーム</p>,
}));

const { SettingsControl } = await import("./settings-control");

function renderControl(language: "JA" | "EN" = "JA") {
  return render(
    <LanguageProvider language={language}>
      <SettingsControl />
      <input aria-label="somewhere to type" />
    </LanguageProvider>,
  );
}

beforeEach(() => vi.clearAllMocks());

describe("the visible control", () => {
  it("opens settings without leaving the application", async () => {
    const user = userEvent.setup();
    renderControl();

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "設定" }));

    expect(screen.getByRole("dialog", { name: "設定" })).toBeInTheDocument();
    expect(screen.getByText("設定フォーム")).toBeInTheDocument();
  });

  it("is a button rather than a link, because there is no settings URL any more", () => {
    renderControl();

    expect(screen.queryByRole("link", { name: "設定" })).not.toBeInTheDocument();
  });

  it("mentions the shortcut, so it is discoverable", () => {
    renderControl();

    expect(screen.getByRole("button", { name: "設定" })).toHaveAttribute(
      "title",
      expect.stringContaining("⌘"),
    );
  });

  it("is labelled in the signed-in user's language", () => {
    renderControl("EN");

    expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument();
  });
});

describe("the way back to the application", () => {
  it("closes on the dialog's own close control", async () => {
    const user = userEvent.setup();
    renderControl();

    await user.click(screen.getByRole("button", { name: "設定" }));
    await user.click(screen.getByRole("button", { name: "閉じる" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    renderControl();

    await user.click(screen.getByRole("button", { name: "設定" }));
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("the keyboard shortcut", () => {
  it("opens settings on Meta + comma", async () => {
    const user = userEvent.setup();
    renderControl();

    await user.keyboard("{Meta>},{/Meta}");

    expect(screen.getByRole("dialog", { name: "設定" })).toBeInTheDocument();
  });

  it("opens settings on Control + comma, for anyone not on a Mac", async () => {
    const user = userEvent.setup();
    renderControl();

    await user.keyboard("{Control>},{/Control}");

    expect(screen.getByRole("dialog", { name: "設定" })).toBeInTheDocument();
  });

  it("ignores a bare comma", async () => {
    const user = userEvent.setup();
    renderControl();

    await user.keyboard(",");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("leaves the key alone while the user is typing in a field", async () => {
    const user = userEvent.setup();
    renderControl();

    await user.click(screen.getByLabelText("somewhere to type"));
    await user.keyboard("{Meta>},{/Meta}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("stops listening once the shell unmounts", async () => {
    const user = userEvent.setup();
    const { unmount } = renderControl();

    unmount();
    await user.keyboard("{Meta>},{/Meta}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
