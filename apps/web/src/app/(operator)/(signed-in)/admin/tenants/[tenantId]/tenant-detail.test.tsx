import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const createMutate = vi.fn();
const reissueMutate = vi.fn();
const tenantQuery = vi.fn();
const usersQuery = vi.fn();
let createOptions: {
  onSuccess?: (data: { generatedPassword: string }, variables: { email: string }) => void;
  onError?: (error: { data?: { code?: string } }) => void;
} = {};

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("~/lib/trpc-client", () => ({
  FRESH: { staleTime: 0, refetchOnMount: "always" },
  api: {
    useUtils: () => ({
      admin: {
        users: { listByTenant: { invalidate: vi.fn() } },
        tenants: { get: { invalidate: vi.fn() } },
      },
    }),
    admin: {
      tenants: { get: { useQuery: () => tenantQuery() as unknown } },
      users: {
        listByTenant: { useQuery: () => usersQuery() as unknown },
        create: {
          useMutation: (options: typeof createOptions) => {
            createOptions = options;
            return { mutate: createMutate, isPending: false };
          },
        },
        reissuePassword: {
          useMutation: () => ({ mutate: reissueMutate, isPending: false }),
        },
      },
    },
  },
}));

const { TenantDetail } = await import("./tenant-detail");

const TENANT_ID = "clabc123abc123abc123abc12";

function withTenant(overrides: Record<string, unknown> = {}) {
  tenantQuery.mockReturnValue({
    isError: false,
    data: {
      id: TENANT_ID,
      name: "株式会社サンプル",
      defaultLanguage: "JA",
      createdAt: new Date(),
      userCount: 0,
      conversationCount: 0,
      ...overrides,
    },
  });
}

function withUsers(users: unknown[]) {
  usersQuery.mockReturnValue({ isPending: false, data: users });
}

const aUser = {
  id: "cluser1user1user1user1use",
  email: "hanako@example.com",
  name: "山田 花子",
  language: "JA",
  firstLoginCompletedAt: null,
  createdAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
  createOptions = {};
  withTenant();
  withUsers([]);
});

describe("the registration form", () => {
  it("pre-selects the tenant's default language when it is Japanese", () => {
    render(<TenantDetail tenantId={TENANT_ID} />);

    expect(screen.getByLabelText("言語")).toHaveValue("JA");
  });

  it("pre-selects the tenant's default language when it is English", () => {
    withTenant({ defaultLanguage: "EN" });
    render(<TenantDetail tenantId={TENANT_ID} />);

    expect(screen.getByLabelText("言語")).toHaveValue("EN");
  });

  it("takes each tenant's own default, not the one before it", () => {
    // Moving between two tenants keeps the same route segment. Next.js remounts
    // the page component when the parameter changes, so the field starts from
    // null again — this pins that behaviour, because if it ever stopped holding,
    // an operator would silently register users in the wrong language.
    const { unmount } = render(<TenantDetail tenantId={TENANT_ID} />);
    expect(screen.getByLabelText("言語")).toHaveValue("JA");
    unmount();

    withTenant({ id: "clother1other1other1other", defaultLanguage: "EN" });
    render(<TenantDetail tenantId="clother1other1other1other" />);

    expect(screen.getByLabelText("言語")).toHaveValue("EN");
  });

  it("says the address cannot be changed later", () => {
    render(<TenantDetail tenantId={TENANT_ID} />);

    expect(screen.getByText("登録後は変更できません。")).toBeInTheDocument();
  });

  it("refuses an empty address, then an empty display name, and calls nothing", async () => {
    const user = userEvent.setup();
    render(<TenantDetail tenantId={TENANT_ID} />);

    await user.click(screen.getByRole("button", { name: "登録" }));
    expect(screen.getByRole("alert")).toHaveTextContent("メールアドレスを入力してください。");

    await user.type(screen.getByLabelText("メールアドレス"), "hanako@example.com");
    await user.click(screen.getByRole("button", { name: "登録" }));
    expect(screen.getByRole("alert")).toHaveTextContent("表示名を入力してください。");

    expect(createMutate).not.toHaveBeenCalled();
  });

  it("submits the address, display name and language", async () => {
    const user = userEvent.setup();
    render(<TenantDetail tenantId={TENANT_ID} />);

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
    const { container } = render(<TenantDetail tenantId={TENANT_ID} />);

    expect(container.querySelector("form")).toHaveAttribute("method", "post");
  });

  it("says the address is taken, without naming the tenant that holds it", () => {
    render(<TenantDetail tenantId={TENANT_ID} />);

    act(() => createOptions.onError?.({ data: { code: "CONFLICT" } }));

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("このメールアドレスは既に使用されています。");
    expect(alert.textContent).not.toContain("株式会社");
  });

  it("falls back to a generic message for any other failure", () => {
    render(<TenantDetail tenantId={TENANT_ID} />);

    act(() => createOptions.onError?.({ data: { code: "INTERNAL_SERVER_ERROR" } }));

    expect(screen.getByRole("alert")).toHaveTextContent("予期しないエラーが発生しました。");
  });
});

describe("the generated password", () => {
  it("is shown once, with a warning that it cannot be read back", () => {
    render(<TenantDetail tenantId={TENANT_ID} />);

    act(() => {
      createOptions.onSuccess?.(
        { generatedPassword: "S3cretGeneratedValue123" },
        { email: "hanako@example.com" },
      );
    });

    const notice = screen.getByRole("alert", { name: "パスワードを控えてください" });
    expect(within(notice).getByText("S3cretGeneratedValue123")).toBeInTheDocument();
    expect(within(notice).getByText(/一度だけ表示されます/)).toBeInTheDocument();
  });

  it("disappears once dismissed, and does not come back", async () => {
    const user = userEvent.setup();
    render(<TenantDetail tenantId={TENANT_ID} />);

    act(() => {
      createOptions.onSuccess?.(
        { generatedPassword: "S3cretGeneratedValue123" },
        { email: "hanako@example.com" },
      );
    });
    await user.click(screen.getByRole("button", { name: "控えました" }));

    expect(screen.queryByText("S3cretGeneratedValue123")).not.toBeInTheDocument();
  });

  it("is not rendered at all before a registration happens", () => {
    render(<TenantDetail tenantId={TENANT_ID} />);

    expect(
      screen.queryByRole("alert", { name: "パスワードを控えてください" }),
    ).not.toBeInTheDocument();
  });
});

describe("the user list", () => {
  it("shows an empty state rather than an error", () => {
    render(<TenantDetail tenantId={TENANT_ID} />);

    expect(screen.getByText("このテナントにはまだユーザーがいません。")).toBeInTheDocument();
  });

  it("shows each user's identifier, address and first-login status", () => {
    withUsers([aUser]);
    render(<TenantDetail tenantId={TENANT_ID} />);

    expect(screen.getByRole("cell", { name: "山田 花子" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "hanako@example.com" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: aUser.id })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "未完了" })).toBeInTheDocument();
  });

  it("shows a completed first login as completed", () => {
    withUsers([{ ...aUser, firstLoginCompletedAt: new Date() }]);
    render(<TenantDetail tenantId={TENANT_ID} />);

    expect(screen.getByRole("cell", { name: "完了" })).toBeInTheDocument();
  });

  it("renders the email address as text, never as an input", () => {
    withUsers([aUser]);
    render(<TenantDetail tenantId={TENANT_ID} />);

    const row = screen.getByRole("cell", { name: "hanako@example.com" });
    expect(within(row).queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("offers a reissue per user, and passes that user's id", async () => {
    const user = userEvent.setup();
    withUsers([aUser]);
    render(<TenantDetail tenantId={TENANT_ID} />);

    await user.click(screen.getByRole("button", { name: "パスワードを再発行" }));

    expect(reissueMutate).toHaveBeenCalledWith({ userId: aUser.id }, expect.anything());
  });

  it("warns that a reissue invalidates the current password and sessions", () => {
    withUsers([aUser]);
    render(<TenantDetail tenantId={TENANT_ID} />);

    expect(screen.getByRole("button", { name: "パスワードを再発行" })).toHaveAttribute(
      "title",
      expect.stringContaining("無効になります"),
    );
  });
});

describe("the tenant summary", () => {
  it("shows the identifier and both counts", () => {
    withTenant({ userCount: 3, conversationCount: 0 });
    render(<TenantDetail tenantId={TENANT_ID} />);

    expect(screen.getByText(TENANT_ID)).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("says so when the tenant does not exist", () => {
    tenantQuery.mockReturnValue({ isError: true, data: undefined });
    render(<TenantDetail tenantId={TENANT_ID} />);

    expect(screen.getByText("そのテナントは存在しません。")).toBeInTheDocument();
  });

  it("links back to the tenant list", () => {
    render(<TenantDetail tenantId={TENANT_ID} />);

    expect(screen.getByRole("link", { name: "テナント一覧へ戻る" })).toHaveAttribute(
      "href",
      "/admin",
    );
  });
});
