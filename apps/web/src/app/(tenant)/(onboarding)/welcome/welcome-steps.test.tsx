import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const confirmMutate = vi.fn();
const replaceMutate = vi.fn();
const replace = vi.fn();
let confirmOptions: { onSuccess?: () => void } = {};
let replaceOptions: { onError?: (error: { message: string }) => void } = {};

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh: vi.fn() }),
}));

vi.mock("~/lib/trpc-client", () => ({
  api: {
    onboarding: {
      confirmLanguage: {
        useMutation: (options: typeof confirmOptions) => {
          confirmOptions = options;
          return { mutate: confirmMutate, isPending: false };
        },
      },
      replacePassword: {
        useMutation: (options: typeof replaceOptions) => {
          replaceOptions = options;
          return { mutate: replaceMutate, isPending: false };
        },
      },
    },
  },
}));

const { WelcomeSteps } = await import("./welcome-steps");

beforeEach(() => {
  vi.clearAllMocks();
  confirmOptions = {};
  replaceOptions = {};
});

function renderAt(step: "language" | "password", language: "JA" | "EN" = "JA") {
  return render(<WelcomeSteps step={step} operatorLanguage={language} displayName="山田 花子" />);
}

describe("the language step", () => {
  it("pre-selects the language the operator assigned", () => {
    renderAt("language", "EN");

    expect(screen.getByRole("combobox")).toHaveValue("EN");
  });

  it("shows the step in the operator's language before anything is chosen", () => {
    renderAt("language", "JA");

    expect(screen.getByRole("heading", { name: "表示言語を選んでください" })).toBeInTheDocument();
  });

  it("previews the language as it is chosen, then submits it", async () => {
    const user = userEvent.setup();
    renderAt("language", "JA");

    await user.selectOptions(screen.getByRole("combobox"), "EN");

    // The copy follows the selection immediately, so the user sees the language
    // they are choosing before committing to it.
    expect(screen.getByRole("heading", { name: "Choose your language" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(confirmMutate).toHaveBeenCalledWith({ language: "EN" });
  });

  it("submits even when the pre-selected language is kept", async () => {
    const user = userEvent.setup();
    renderAt("language", "JA");

    await user.click(screen.getByRole("button", { name: "次へ" }));

    expect(confirmMutate).toHaveBeenCalledWith({ language: "JA" });
  });

  it("moves to the password step, in the language just chosen", async () => {
    const user = userEvent.setup();
    renderAt("language", "JA");

    await user.selectOptions(screen.getByRole("combobox"), "EN");
    act(() => confirmOptions.onSuccess?.());

    expect(screen.getByRole("heading", { name: "Set your own password" })).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });
});

describe("the password step", () => {
  it("opens directly for a user who already confirmed a language", () => {
    renderAt("password", "JA");

    expect(
      screen.getByRole("heading", { name: "パスワードを変更してください" }),
    ).toBeInTheDocument();
  });

  it("submits the new password once both copies agree", async () => {
    const user = userEvent.setup();
    renderAt("password");

    await user.type(screen.getByLabelText("新しいパスワード"), "tumbling walnut ledger");
    await user.type(screen.getByLabelText("新しいパスワード（確認）"), "tumbling walnut ledger");
    await user.click(screen.getByRole("button", { name: "設定して開始" }));

    expect(replaceMutate).toHaveBeenCalledWith({ newPassword: "tumbling walnut ledger" });
  });

  it("says so as soon as the two copies diverge, and refuses to submit", async () => {
    const user = userEvent.setup();
    renderAt("password");

    await user.type(screen.getByLabelText("新しいパスワード"), "tumbling walnut ledger");
    await user.type(screen.getByLabelText("新しいパスワード（確認）"), "tumbling walnut ledgar");

    expect(screen.getByRole("alert")).toHaveTextContent("新しいパスワードが一致しません。");
    expect(screen.getByRole("button", { name: "設定して開始" })).toBeDisabled();
    expect(replaceMutate).not.toHaveBeenCalled();
  });

  it("stops complaining once they agree again", async () => {
    const user = userEvent.setup();
    renderAt("password");

    await user.type(screen.getByLabelText("新しいパスワード"), "tumbling walnut ledger");
    await user.type(screen.getByLabelText("新しいパスワード（確認）"), "tumbling walnut ledge");
    expect(screen.getByRole("alert")).toBeInTheDocument();

    await user.type(screen.getByLabelText("新しいパスワード（確認）"), "r");

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "設定して開始" })).toBeEnabled();
  });

  it("marks its required fields, and says what the marker means", () => {
    renderAt("password");

    expect(screen.getByLabelText("新しいパスワード")).toBeRequired();
    expect(screen.getByLabelText("新しいパスワード（確認）")).toBeRequired();
    expect(screen.getByText("* は必須項目です。")).toBeInTheDocument();
  });

  it("names the rule that failed, rather than saying the password is invalid", () => {
    renderAt("password");

    const cases: [string, string | RegExp][] = [
      ["too-short", /12 文字以上/],
      ["too-common", "よく使われるパスワードです。推測されにくいものにしてください。"],
      ["matches-email", "メールアドレスと同じパスワードは使用できません。"],
      ["matches-display-name", "表示名と同じパスワードは使用できません。"],
      ["same-as-issued", "配布されたパスワードとは異なるものにしてください。"],
    ];

    for (const [rule, expected] of cases) {
      act(() => replaceOptions.onError?.({ message: rule }));
      expect(screen.getByRole("alert")).toHaveTextContent(expected);
    }
  });

  it("falls back to a generic message for a failure it does not recognise", () => {
    renderAt("password");

    act(() => replaceOptions.onError?.({ message: "something-else" }));

    expect(screen.getByRole("alert")).toHaveTextContent("予期しないエラーが発生しました。");
  });

  it("offers no way back to the language step, which is already done", () => {
    renderAt("password");

    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("carries a username field so a password manager files the new password", () => {
    const { container } = renderAt("password");

    expect(container.querySelector('input[autocomplete="username"]')).toHaveValue("山田 花子");
  });
});

describe("both steps", () => {
  it("are POST, so an un-hydrated native submit cannot leak the field values", () => {
    const language = renderAt("language");
    expect(language.container.querySelector("form")).toHaveAttribute("method", "post");
    language.unmount();

    const password = renderAt("password");
    expect(password.container.querySelector("form")).toHaveAttribute("method", "post");
  });
});
