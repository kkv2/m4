import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LanguageProvider } from "~/i18n/language-provider";

const updateDisplayNameMutate = vi.fn();
const updateLanguageMutate = vi.fn();
const changePasswordMutate = vi.fn();
const refresh = vi.fn();
let passwordOptions: { onError?: (error: { message: string }) => void; onSuccess?: () => void } =
  {};
let nameOptions: { onSuccess?: () => void } = {};

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn() }),
}));

const account = {
  id: "cluser1user1user1user1use",
  email: "hanako@example.test",
  displayName: "山田 花子",
  language: "JA" as const,
};

vi.mock("~/lib/trpc-client", () => ({
  api: {
    account: {
      get: { useQuery: () => ({ data: account }) },
      updateDisplayName: {
        useMutation: (options: typeof nameOptions) => {
          nameOptions = options;
          return { mutate: updateDisplayNameMutate, isPending: false };
        },
      },
      updateLanguage: {
        useMutation: () => ({ mutate: updateLanguageMutate, isPending: false }),
      },
      changePassword: {
        useMutation: (options: typeof passwordOptions) => {
          passwordOptions = options;
          return { mutate: changePasswordMutate, isPending: false };
        },
      },
    },
  },
}));

const { SettingsForm } = await import("./settings-form");

function renderSettings(language: "JA" | "EN" = "JA") {
  return render(
    <LanguageProvider language={language}>
      <SettingsForm />
    </LanguageProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  passwordOptions = {};
  nameOptions = {};
});

describe("what the screen shows", () => {
  it("shows the user identifier and address", () => {
    renderSettings();

    expect(screen.getByText(account.id)).toBeInTheDocument();
    expect(screen.getByText(account.email)).toBeInTheDocument();
  });

  it("renders them as values, never as editable fields", () => {
    // A disabled input still reads as something you might have been allowed to
    // change. FR-037 says these cannot be changed, so they are not inputs.
    renderSettings();

    const editable = screen
      .getAllByRole("textbox")
      .map((field) => (field as HTMLInputElement).value);

    expect(editable).not.toContain(account.id);
    expect(editable).not.toContain(account.email);
  });

  it("says so, in words, that they cannot be changed", () => {
    renderSettings();

    expect(screen.getByText("この項目は変更できません。")).toBeInTheDocument();
  });

  it("renders in the signed-in user's language", () => {
    renderSettings("EN");

    expect(screen.getByText("This cannot be changed.")).toBeInTheDocument();
    expect(screen.getByLabelText("Display name")).toBeInTheDocument();
  });
});

describe("changing the display name", () => {
  it("starts from the current name and submits the new one", async () => {
    const user = userEvent.setup();
    renderSettings();

    const field = screen.getByLabelText("表示名");
    expect(field).toHaveValue("山田 花子");

    await user.clear(field);
    await user.type(field, "山田 花");
    await user.click(screen.getByRole("button", { name: "保存" }));

    expect(updateDisplayNameMutate).toHaveBeenCalledWith({ displayName: "山田 花" });
  });

  it("submits nothing when the name is emptied", async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.clear(screen.getByLabelText("表示名"));
    await user.click(screen.getByRole("button", { name: "保存" }));

    expect(updateDisplayNameMutate).not.toHaveBeenCalled();
  });

  it("confirms the save, and asks the shell to re-read the account", () => {
    renderSettings();

    act(() => nameOptions.onSuccess?.());

    expect(screen.getByRole("status")).toHaveTextContent("変更を保存しました。");
    expect(refresh).toHaveBeenCalled();
  });
});

describe("changing the language", () => {
  it("takes effect on selection, without a separate save", async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.selectOptions(screen.getByLabelText("言語"), "EN");

    expect(updateLanguageMutate).toHaveBeenCalledWith({ language: "EN" });
  });
});

describe("changing the password", () => {
  it("submits the current and the new password", async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.type(screen.getByLabelText("現在のパスワード"), "the-old-one");
    await user.type(screen.getByLabelText("新しいパスワード"), "cantilever moss inventory");
    await user.click(screen.getByRole("button", { name: "パスワードを変更" }));

    expect(changePasswordMutate).toHaveBeenCalledWith({
      currentPassword: "the-old-one",
      newPassword: "cantilever moss inventory",
    });
  });

  it("names the rule that failed, rather than saying the password is invalid", () => {
    renderSettings();

    const cases: [string, string | RegExp][] = [
      ["too-short", /12 文字以上/],
      ["too-common", "よく使われるパスワードです。推測されにくいものにしてください。"],
      ["matches-email", "メールアドレスと同じパスワードは使用できません。"],
      ["matches-display-name", "表示名と同じパスワードは使用できません。"],
      ["current-incorrect", "現在のパスワードが正しくありません。"],
      ["same-as-current", "現在のパスワードとは異なるものにしてください。"],
    ];

    for (const [rule, expected] of cases) {
      act(() => passwordOptions.onError?.({ message: rule }));
      expect(screen.getByRole("alert")).toHaveTextContent(expected);
    }
  });

  it("clears both fields once the change succeeds", async () => {
    const user = userEvent.setup();
    renderSettings();
    await user.type(screen.getByLabelText("現在のパスワード"), "the-old-one");
    await user.type(screen.getByLabelText("新しいパスワード"), "cantilever moss inventory");

    act(() => passwordOptions.onSuccess?.());

    expect(screen.getByLabelText("現在のパスワード")).toHaveValue("");
    expect(screen.getByLabelText("新しいパスワード")).toHaveValue("");
    expect(screen.getByRole("status")).toHaveTextContent("変更を保存しました。");
  });

  it("carries a username field so a password manager files the change", () => {
    const { container } = renderSettings();

    expect(container.querySelector('input[autocomplete="username"]')).toHaveValue(account.email);
  });
});

describe("both forms", () => {
  it("are POST, so an un-hydrated native submit cannot leak the field values", () => {
    const { container } = renderSettings();

    const forms = [...container.querySelectorAll("form")];
    expect(forms).toHaveLength(2);
    for (const form of forms) expect(form).toHaveAttribute("method", "post");
  });
});
