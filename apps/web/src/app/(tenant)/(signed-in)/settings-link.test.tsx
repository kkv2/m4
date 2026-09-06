import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LanguageProvider } from "~/i18n/language-provider";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  } & Record<string, unknown>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const { SettingsLink } = await import("./settings-link");

function renderLink(language: "JA" | "EN" = "JA") {
  return render(
    <LanguageProvider language={language}>
      <SettingsLink />
      <input aria-label="somewhere to type" />
    </LanguageProvider>,
  );
}

beforeEach(() => vi.clearAllMocks());

describe("the visible control", () => {
  it("links to settings", () => {
    renderLink();

    expect(screen.getByRole("link", { name: "設定" })).toHaveAttribute("href", "/settings");
  });

  it("mentions the shortcut, so it is discoverable", () => {
    renderLink();

    expect(screen.getByRole("link", { name: "設定" })).toHaveAttribute(
      "title",
      expect.stringContaining("⌘"),
    );
  });

  it("is labelled in the signed-in user's language", () => {
    renderLink("EN");

    expect(screen.getByRole("link", { name: "Settings" })).toBeInTheDocument();
  });
});

describe("the keyboard shortcut", () => {
  it("opens settings on Meta + comma", async () => {
    const user = userEvent.setup();
    renderLink();

    await user.keyboard("{Meta>},{/Meta}");

    expect(push).toHaveBeenCalledWith("/settings");
  });

  it("opens settings on Control + comma, for anyone not on a Mac", async () => {
    const user = userEvent.setup();
    renderLink();

    await user.keyboard("{Control>},{/Control}");

    expect(push).toHaveBeenCalledWith("/settings");
  });

  it("ignores a bare comma", async () => {
    const user = userEvent.setup();
    renderLink();

    await user.keyboard(",");

    expect(push).not.toHaveBeenCalled();
  });

  it("leaves the key alone while the user is typing in a field", async () => {
    const user = userEvent.setup();
    renderLink();

    await user.click(screen.getByLabelText("somewhere to type"));
    await user.keyboard("{Meta>},{/Meta}");

    expect(push).not.toHaveBeenCalled();
  });

  it("stops listening once the shell unmounts", async () => {
    const user = userEvent.setup();
    const { unmount } = renderLink();

    unmount();
    await user.keyboard("{Meta>},{/Meta}");

    expect(push).not.toHaveBeenCalled();
  });
});
