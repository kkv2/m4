import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const createMutate = vi.fn();
const updateMutate = vi.fn();
const reissueMutate = vi.fn();
const onClose = vi.fn();
let createOptions: {
  onSuccess?: (
    data: { generatedPassword: string },
    variables: { email: string },
  ) => Promise<void> | void;
  onError?: (error: { data?: { code?: string } }) => void;
} = {};
let updateOptions: { onSuccess?: () => Promise<void> | void } = {};
let reissueOptions: { onSuccess?: (data: { generatedPassword: string }) => void } = {};

vi.mock("~/lib/trpc-client", () => ({
  api: {
    useUtils: () => ({
      admin: {
        users: { listByTenant: { invalidate: vi.fn() } },
        tenants: { get: { invalidate: vi.fn() }, list: { invalidate: vi.fn() } },
      },
    }),
    admin: {
      users: {
        create: {
          useMutation: (options: typeof createOptions) => {
            createOptions = options;
            return { mutate: createMutate, isPending: false };
          },
        },
        update: {
          useMutation: (options: typeof updateOptions) => {
            updateOptions = options;
            return { mutate: updateMutate, isPending: false };
          },
        },
        reissuePassword: {
          useMutation: (options: typeof reissueOptions) => {
            reissueOptions = options;
            return { mutate: reissueMutate, isPending: false };
          },
        },
      },
    },
  },
}));

const { UserFormModal } = await import("./user-form-modal");

const TENANT_ID = "clabc123abc123abc123abc12";

const aUser = {
  id: "cluser1user1user1user1use",
  email: "hanako@example.com",
  name: "山田 花子",
  language: "JA" as "JA" | "EN",
  firstLoginCompletedAt: null,
  createdAt: new Date(),
};

function renderRegistration(defaultLanguage: "JA" | "EN" = "JA") {
  return render(
    <UserFormModal
      tenantId={TENANT_ID}
      user={null}
      defaultLanguage={defaultLanguage}
      onClose={onClose}
    />,
  );
}

function renderEdit(user = aUser) {
  return render(
    <UserFormModal tenantId={TENANT_ID} user={user} defaultLanguage="JA" onClose={onClose} />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  createOptions = {};
  updateOptions = {};
  reissueOptions = {};
});

describe("registering a user", () => {
  it("starts on the tenant's default language", () => {
    renderRegistration("EN");

    expect(screen.getByLabelText("言語")).toHaveValue("EN");
  });

  it("says the address cannot be changed later", () => {
    renderRegistration();

    expect(screen.getByText("登録後は変更できません。")).toBeInTheDocument();
  });

  it("refuses an empty address, then an empty display name, and calls nothing", async () => {
    const user = userEvent.setup();
    renderRegistration();

    await user.click(screen.getByRole("button", { name: "登録" }));
    expect(screen.getByRole("alert")).toHaveTextContent("メールアドレスを入力してください。");

    await user.type(screen.getByLabelText("メールアドレス"), "hanako@example.com");
    await user.click(screen.getByRole("button", { name: "登録" }));
    expect(screen.getByRole("alert")).toHaveTextContent("表示名を入力してください。");

    expect(createMutate).not.toHaveBeenCalled();
  });

  it("submits the address, display name and language", async () => {
    const user = userEvent.setup();
    renderRegistration();

    await user.type(screen.getByLabelText("メールアドレス"), "hanako@example.com");
    await user.type(screen.getByLabelText("表示名"), "山田 花子");
    await user.selectOptions(screen.getByLabelText("言語"), "EN");
    await user.click(screen.getByRole("button", { name: "登録" }));

    expect(createMutate).toHaveBeenCalledWith({
      tenantId: TENANT_ID,
      email: "hanako@example.com",
      name: "山田 花子",
      language: "EN",
    });
  });

  it("is a POST, so an un-hydrated native submit cannot leak the fields", () => {
    const { container } = renderRegistration();

    expect(container.querySelector("form")).toHaveAttribute("method", "post");
  });

  it("says the address is taken, without naming the tenant that holds it", () => {
    renderRegistration();

    act(() => createOptions.onError?.({ data: { code: "CONFLICT" } }));

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("このメールアドレスは既に使用されています。");
    expect(alert.textContent).not.toContain("株式会社");
  });

  it("falls back to a generic message for any other failure", () => {
    renderRegistration();

    act(() => createOptions.onError?.({ data: { code: "INTERNAL_SERVER_ERROR" } }));

    expect(screen.getByRole("alert")).toHaveTextContent("予期しないエラーが発生しました。");
  });

  it("marks its required fields, and says what the marker means", () => {
    renderRegistration();

    expect(screen.getByLabelText("メールアドレス")).toBeRequired();
    expect(screen.getByLabelText("表示名")).toBeRequired();
    expect(screen.getByText("* は必須項目です。")).toBeInTheDocument();
  });
});

describe("the generated password", () => {
  async function register() {
    await act(
      async () =>
        await createOptions.onSuccess?.(
          { generatedPassword: "S3cretGeneratedValue123" },
          { email: "hanako@example.com" },
        ),
    );
  }

  it("is shown once, with a warning that it cannot be read back", async () => {
    renderRegistration();

    await register();

    const notice = screen.getByRole("alert", { name: "パスワードを控えてください" });
    expect(within(notice).getByText("S3cretGeneratedValue123")).toBeInTheDocument();
    expect(within(notice).getByText(/一度だけ表示されます/)).toBeInTheDocument();
  });

  it("names the address it belongs to, which is the whole point of the dialog", async () => {
    renderRegistration();

    await register();

    const notice = screen.getByRole("alert", { name: "パスワードを控えてください" });
    expect(within(notice).getByText("hanako@example.com")).toBeInTheDocument();
  });

  it("replaces the form, so nothing else on screen can be mistaken for its subject", async () => {
    const { container } = renderRegistration();

    await register();

    expect(container.querySelector("form")).toBeNull();
  });

  it("closes the dialog when it is dismissed after a registration", async () => {
    const user = userEvent.setup();
    renderRegistration();

    await register();
    await user.click(screen.getByRole("button", { name: "控えました" }));

    expect(onClose).toHaveBeenCalled();
  });

  it("is not rendered at all before a registration happens", () => {
    renderRegistration();

    expect(
      screen.queryByRole("alert", { name: "パスワードを控えてください" }),
    ).not.toBeInTheDocument();
  });
});

describe("editing a user", () => {
  it("shows the address and the identifier as text, never as inputs", () => {
    renderEdit();

    expect(screen.getByText("hanako@example.com")).toBeInTheDocument();
    expect(screen.getByText(aUser.id)).toBeInTheDocument();
    expect(screen.queryByLabelText("メールアドレス")).not.toBeInTheDocument();
  });

  it("reports the first-login status, so the subject is unmistakable", () => {
    renderEdit();
    expect(screen.getByText("未完了")).toBeInTheDocument();
  });

  it("opens on that user's own display name and language", () => {
    renderEdit({ ...aUser, language: "EN" });

    expect(screen.getByLabelText("表示名")).toHaveValue("山田 花子");
    expect(screen.getByLabelText("言語")).toHaveValue("EN");
  });

  it("submits the change against that user", async () => {
    const user = userEvent.setup();
    renderEdit();

    const field = screen.getByLabelText("表示名");
    await user.clear(field);
    await user.type(field, "山田 花");
    await user.selectOptions(screen.getByLabelText("言語"), "EN");
    await user.click(screen.getByRole("button", { name: "保存" }));

    expect(updateMutate).toHaveBeenCalledWith({
      userId: aUser.id,
      name: "山田 花",
      language: "EN",
    });
  });

  it("refuses an emptied display name", async () => {
    const user = userEvent.setup();
    renderEdit();

    await user.clear(screen.getByLabelText("表示名"));
    await user.click(screen.getByRole("button", { name: "保存" }));

    expect(screen.getByRole("alert")).toHaveTextContent("表示名を入力してください。");
    expect(updateMutate).not.toHaveBeenCalled();
  });

  it("closes once the change lands", async () => {
    renderEdit();

    await act(async () => await updateOptions.onSuccess?.());

    expect(onClose).toHaveBeenCalled();
  });
});

describe("reissuing a password", () => {
  it("is offered per user, and passes that user's id", async () => {
    const user = userEvent.setup();
    renderEdit();

    await user.click(screen.getByRole("button", { name: "パスワードを再発行" }));

    expect(reissueMutate).toHaveBeenCalledWith({ userId: aUser.id });
  });

  it("warns that it invalidates the current password and sessions", () => {
    renderEdit();

    expect(screen.getByRole("button", { name: "パスワードを再発行" })).toHaveAttribute(
      "title",
      expect.stringContaining("無効になります"),
    );
  });

  it("shows the new password against the address it belongs to", () => {
    renderEdit();

    act(() => reissueOptions.onSuccess?.({ generatedPassword: "Reissued4Value567890" }));

    const notice = screen.getByRole("alert", { name: "パスワードを控えてください" });
    expect(within(notice).getByText("Reissued4Value567890")).toBeInTheDocument();
    expect(within(notice).getByText("hanako@example.com")).toBeInTheDocument();
  });

  it("returns to the form when dismissed, rather than closing the dialog", async () => {
    const user = userEvent.setup();
    renderEdit();

    act(() => reissueOptions.onSuccess?.({ generatedPassword: "Reissued4Value567890" }));
    await user.click(screen.getByRole("button", { name: "控えました" }));

    expect(screen.queryByText("Reissued4Value567890")).not.toBeInTheDocument();
    expect(screen.getByLabelText("表示名")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("offers a fresh copy control for a second reissue, not one still saying copied", async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    renderEdit();

    act(() => reissueOptions.onSuccess?.({ generatedPassword: "FirstIssued1234567890" }));
    await user.click(screen.getByRole("button", { name: "コピー" }));
    expect(screen.getByRole("button", { name: "コピーしました" })).toBeInTheDocument();

    act(() => reissueOptions.onSuccess?.({ generatedPassword: "SecondIssued098765432" }));

    expect(screen.getByRole("button", { name: "コピー" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "コピーしました" })).not.toBeInTheDocument();
  });
});
