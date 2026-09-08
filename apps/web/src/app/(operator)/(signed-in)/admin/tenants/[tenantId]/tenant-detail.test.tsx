import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const tenantQuery = vi.fn();
const usersQuery = vi.fn();

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
        tenants: { get: { invalidate: vi.fn() }, list: { invalidate: vi.fn() } },
      },
    }),
    admin: {
      tenants: {
        get: { useQuery: () => tenantQuery() as unknown },
        create: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
        update: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      },
      users: {
        listByTenant: { useQuery: () => usersQuery() as unknown },
        create: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
        update: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
        reissuePassword: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
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
  withTenant();
  withUsers([]);
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

    const cell = screen.getByRole("cell", { name: "hanako@example.com" });
    expect(within(cell).queryByRole("textbox")).not.toBeInTheDocument();
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

  it("edits the tenant in a dialog of its own", async () => {
    const user = userEvent.setup();
    render(<TenantDetail tenantId={TENANT_ID} />);

    await user.click(screen.getByRole("button", { name: "編集" }));

    expect(screen.getByRole("dialog", { name: "テナントを編集" })).toBeInTheDocument();
  });
});

describe("the screen itself", () => {
  it("carries no form until one is asked for", () => {
    withUsers([aUser]);
    const { container } = render(<TenantDetail tenantId={TENANT_ID} />);

    // The whole point of the dialogs: a screen listing several users no longer
    // has a form on it that could belong to any of them.
    expect(container.querySelector("form")).toBeNull();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens registration on the tenant's default language", async () => {
    const user = userEvent.setup();
    withTenant({ defaultLanguage: "EN" });
    render(<TenantDetail tenantId={TENANT_ID} />);

    await user.click(screen.getByRole("button", { name: "ユーザーを登録" }));

    // FR-016.
    const dialog = screen.getByRole("dialog", { name: "ユーザーを登録" });
    expect(within(dialog).getByLabelText("言語")).toHaveValue("EN");
  });

  it("waits for the tenant before offering registration, so the default is real", () => {
    tenantQuery.mockReturnValue({ isError: false, data: undefined });
    render(<TenantDetail tenantId={TENANT_ID} />);

    expect(screen.getByRole("button", { name: "ユーザーを登録" })).toBeDisabled();
  });

  it("edits one named user, not whichever form happens to be on screen", async () => {
    const user = userEvent.setup();
    withUsers([aUser, { ...aUser, id: "cluser2user2user2user2use", email: "taro@example.com" }]);
    render(<TenantDetail tenantId={TENANT_ID} />);

    const row = screen.getByRole("row", { name: /taro@example.com/ });
    await user.click(within(row).getByRole("button", { name: "編集" }));

    // Both users are on the list; the dialog says which of them it is about.
    const dialog = screen.getByRole("dialog", { name: "ユーザーを編集" });
    expect(within(dialog).getByText("taro@example.com")).toBeInTheDocument();
    expect(within(dialog).queryByText("hanako@example.com")).not.toBeInTheDocument();
  });
});
