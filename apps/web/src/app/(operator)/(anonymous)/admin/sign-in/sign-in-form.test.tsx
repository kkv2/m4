import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const signInMutate = vi.fn();
let mutationOptions: { onError?: (error: unknown) => void } = {};

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("~/lib/trpc-client", () => ({
  api: {
    operatorAuth: {
      signIn: {
        useMutation: (options: typeof mutationOptions) => {
          mutationOptions = options;
          return { mutate: signInMutate, isPending: false };
        },
      },
    },
  },
}));

const { OperatorSignInForm } = await import("./sign-in-form");

beforeEach(() => {
  vi.clearAllMocks();
  mutationOptions = {};
});

describe("the operator sign-in form", () => {
  it("is a POST, so an un-hydrated native submit cannot leak the password", () => {
    // Without an explicit method a form submits as GET, putting every field in
    // the query string — and from there into history, logs and the Referer.
    const { container } = render(<OperatorSignInForm />);

    expect(container.querySelector("form")).toHaveAttribute("method", "post");
  });

  it("submits the credentials that were typed", async () => {
    const user = userEvent.setup();
    render(<OperatorSignInForm />);

    await user.type(screen.getByLabelText("メールアドレス"), "ops@example.test");
    await user.type(screen.getByLabelText("パスワード"), "a-long-enough-password");
    await user.click(screen.getByRole("button", { name: "ログイン" }));

    expect(signInMutate).toHaveBeenCalledWith({
      email: "ops@example.test",
      password: "a-long-enough-password",
    });
  });

  it("shows one message for bad credentials that does not mention the address", () => {
    render(<OperatorSignInForm />);

    act(() => mutationOptions.onError?.({ data: { code: "UNAUTHORIZED" } }));

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("メールアドレスまたはパスワードが正しくありません。");
    expect(alert.textContent).not.toContain("登録");
  });

  it("says so when the attempt was throttled", () => {
    render(<OperatorSignInForm />);

    act(() => mutationOptions.onError?.({ data: { code: "TOO_MANY_REQUESTS" } }));

    expect(screen.getByRole("alert")).toHaveTextContent("ログインの試行回数が上限に達しました。");
  });

  it("is written in Japanese, with no language control", () => {
    render(<OperatorSignInForm />);

    expect(screen.getByLabelText("メールアドレス")).toBeInTheDocument();
    expect(screen.getByLabelText("パスワード")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ログイン" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /English|日本語/ })).not.toBeInTheDocument();
  });
});
