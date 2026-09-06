import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const signInMutate = vi.fn();
const replace = vi.fn();
let mutationOptions: {
  onSuccess?: (data: { next: "language" | "password" | "app" }) => void;
  onError?: (error: { data?: { code?: string } }) => void;
} = {};

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh: vi.fn() }),
}));

vi.mock("~/lib/trpc-client", () => ({
  api: {
    auth: {
      signIn: {
        useMutation: (options: typeof mutationOptions) => {
          mutationOptions = options;
          return { mutate: signInMutate, isPending: false };
        },
      },
    },
  },
}));

const { SignInForm } = await import("./sign-in-form");

beforeEach(() => {
  vi.clearAllMocks();
  mutationOptions = {};
});

afterEach(() => {
  document.cookie = "m4_signin_language=; Path=/; Max-Age=0";
});

describe("the language of the sign-in screen", () => {
  it("opens in Japanese when nothing is remembered", () => {
    render(<SignInForm initialLanguage="JA" />);

    expect(screen.getByRole("heading", { name: "ログイン" })).toBeInTheDocument();
    expect(screen.getByLabelText("メールアドレス")).toBeInTheDocument();
  });

  it("opens in English when that is what the device remembers", () => {
    render(<SignInForm initialLanguage="EN" />);

    expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByLabelText("Email address")).toBeInTheDocument();
  });

  it("switches language on demand, and every string follows", async () => {
    const user = userEvent.setup();
    render(<SignInForm initialLanguage="JA" />);

    await user.click(screen.getByRole("button", { name: "English" }));

    expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("remembers the choice on the device, so a later visit opens in it", async () => {
    const user = userEvent.setup();
    render(<SignInForm initialLanguage="JA" />);

    await user.click(screen.getByRole("button", { name: "English" }));

    expect(document.cookie).toContain("m4_signin_language=en");
  });

  it("switches back again", async () => {
    const user = userEvent.setup();
    render(<SignInForm initialLanguage="EN" />);

    await user.click(screen.getByRole("button", { name: "日本語" }));

    expect(screen.getByRole("heading", { name: "ログイン" })).toBeInTheDocument();
    expect(document.cookie).toContain("m4_signin_language=ja");
  });
});

describe("signing in", () => {
  it("submits the address and the password, and nothing else", async () => {
    const user = userEvent.setup();
    render(<SignInForm initialLanguage="JA" />);

    await user.type(screen.getByLabelText("メールアドレス"), "hanako@example.test");
    await user.type(screen.getByLabelText("パスワード"), "a-long-enough-password");
    await user.click(screen.getByRole("button", { name: "ログイン" }));

    expect(signInMutate).toHaveBeenCalledWith({
      email: "hanako@example.test",
      password: "a-long-enough-password",
    });
  });

  it("goes where the server says to go", () => {
    render(<SignInForm initialLanguage="JA" />);

    act(() => mutationOptions.onSuccess?.({ next: "app" }));
    expect(replace).toHaveBeenLastCalledWith("/");

    act(() => mutationOptions.onSuccess?.({ next: "language" }));
    expect(replace).toHaveBeenLastCalledWith("/welcome");

    act(() => mutationOptions.onSuccess?.({ next: "password" }));
    expect(replace).toHaveBeenLastCalledWith("/welcome");
  });

  it("gives one message for bad credentials, revealing nothing about the address", () => {
    render(<SignInForm initialLanguage="JA" />);

    act(() => mutationOptions.onError?.({ data: { code: "UNAUTHORIZED" } }));

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("メールアドレスまたはパスワードが正しくありません。");
    expect(alert.textContent).not.toContain("登録");
  });

  it("says so when the attempt was throttled", () => {
    render(<SignInForm initialLanguage="JA" />);

    act(() => mutationOptions.onError?.({ data: { code: "TOO_MANY_REQUESTS" } }));

    expect(screen.getByRole("alert")).toHaveTextContent("ログインの試行回数が上限に達しました。");
  });

  it("shows its errors in the chosen language", async () => {
    const user = userEvent.setup();
    render(<SignInForm initialLanguage="JA" />);
    await user.click(screen.getByRole("button", { name: "English" }));

    act(() => mutationOptions.onError?.({ data: { code: "UNAUTHORIZED" } }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "That email address and password do not match.",
    );
  });

  it("is a POST, so an un-hydrated native submit cannot leak the password", () => {
    const { container } = render(<SignInForm initialLanguage="JA" />);

    expect(container.querySelector("form")).toHaveAttribute("method", "post");
  });
});
