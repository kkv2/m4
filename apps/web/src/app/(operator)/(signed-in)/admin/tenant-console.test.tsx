import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const createMutate = vi.fn();
const updateMutate = vi.fn();
const listQuery = vi.fn();

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("~/lib/trpc-client", () => ({
  FRESH: { staleTime: 0, refetchOnMount: "always" },
  api: {
    useUtils: () => ({
      admin: { tenants: { list: { invalidate: vi.fn() }, get: { invalidate: vi.fn() } } },
    }),
    admin: {
      tenants: {
        list: { useQuery: () => listQuery() as unknown },
        create: { useMutation: () => ({ mutate: createMutate, isPending: false }) },
        update: { useMutation: () => ({ mutate: updateMutate, isPending: false }) },
      },
    },
  },
}));

const { TenantConsole } = await import("./tenant-console");

const aTenant = {
  id: "clabc123abc123abc123abc12",
  name: "株式会社サンプル",
  defaultLanguage: "JA",
  createdAt: new Date(),
  userCount: 3,
  conversationCount: 0,
};

function withTenants(tenants: unknown[]) {
  listQuery.mockReturnValue({ isPending: false, data: tenants });
}

beforeEach(() => {
  vi.clearAllMocks();
  withTenants([]);
});

describe("the tenant list", () => {
  it("shows an empty state rather than an error when there are no tenants", () => {
    render(<TenantConsole />);

    expect(screen.getByText("登録されているテナントはまだありません。")).toBeInTheDocument();
  });

  it("shows each tenant's identifier, user count and chat count", () => {
    withTenants([aTenant]);
    render(<TenantConsole />);

    expect(screen.getByText("株式会社サンプル")).toBeInTheDocument();
    expect(screen.getByText(aTenant.id)).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("shows a zero chat count as a number, not a blank", () => {
    withTenants([{ ...aTenant, name: "Zero", userCount: 0, conversationCount: 0 }]);
    render(<TenantConsole />);

    const cells = screen.getAllByRole("cell").map((cell) => cell.textContent);
    expect(cells).toContain("0");
  });

  it("links each row to its detail screen", () => {
    withTenants([aTenant]);
    render(<TenantConsole />);

    expect(screen.getByRole("link", { name: "詳細" })).toHaveAttribute(
      "href",
      `/admin/tenants/${aTenant.id}`,
    );
  });

  it("is written entirely in Japanese, per FR-006", () => {
    withTenants([{ ...aTenant, name: "Acme", defaultLanguage: "EN", userCount: 1 }]);
    render(<TenantConsole />);

    expect(screen.getByRole("heading", { name: "テナント" })).toBeInTheDocument();
    for (const column of [
      "表示名",
      "テナント ID",
      "デフォルト言語",
      "ユーザー数",
      "チャット数",
      "操作",
    ]) {
      expect(screen.getByRole("columnheader", { name: column })).toBeInTheDocument();
    }
    // An English-default tenant still has its language rendered in Japanese.
    expect(screen.getByRole("cell", { name: "英語" })).toBeInTheDocument();
  });
});

describe("registering a tenant", () => {
  it("keeps the form out of the way until it is asked for", () => {
    render(<TenantConsole />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("表示名")).not.toBeInTheDocument();
  });

  it("opens an empty registration dialog", async () => {
    const user = userEvent.setup();
    render(<TenantConsole />);

    await user.click(screen.getByRole("button", { name: "テナントを登録" }));

    const dialog = screen.getByRole("dialog", { name: "テナントを登録" });
    expect(within(dialog).getByLabelText("表示名")).toHaveValue("");
    // FR-011: the field starts on Japanese.
    expect(within(dialog).getByLabelText("デフォルト言語")).toHaveValue("JA");
  });

  it("closes again without registering anything", async () => {
    const user = userEvent.setup();
    render(<TenantConsole />);

    await user.click(screen.getByRole("button", { name: "テナントを登録" }));
    await user.click(screen.getByRole("button", { name: "キャンセル" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(createMutate).not.toHaveBeenCalled();
  });
});

describe("editing a tenant", () => {
  it("opens on that tenant's current values", async () => {
    const user = userEvent.setup();
    withTenants([{ ...aTenant, defaultLanguage: "EN" }]);
    render(<TenantConsole />);

    await user.click(screen.getByRole("button", { name: "編集" }));

    const dialog = screen.getByRole("dialog", { name: "テナントを編集" });
    expect(within(dialog).getByLabelText("表示名")).toHaveValue("株式会社サンプル");
    expect(within(dialog).getByLabelText("デフォルト言語")).toHaveValue("EN");
  });

  it("shows the identifier, so the wrong of two same-named tenants is catchable", async () => {
    const user = userEvent.setup();
    withTenants([aTenant]);
    render(<TenantConsole />);

    await user.click(screen.getByRole("button", { name: "編集" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(aTenant.id)).toBeInTheDocument();
    expect(within(dialog).getByText("この項目は変更できません。")).toBeInTheDocument();
  });

  it("submits the edit against that tenant", async () => {
    const user = userEvent.setup();
    withTenants([aTenant]);
    render(<TenantConsole />);

    await user.click(screen.getByRole("button", { name: "編集" }));
    const field = screen.getByLabelText("表示名");
    await user.clear(field);
    await user.type(field, "株式会社リネーム");
    await user.selectOptions(screen.getByLabelText("デフォルト言語"), "EN");
    await user.click(screen.getByRole("button", { name: "保存" }));

    expect(updateMutate).toHaveBeenCalledWith({
      tenantId: aTenant.id,
      name: "株式会社リネーム",
      defaultLanguage: "EN",
    });
    expect(createMutate).not.toHaveBeenCalled();
  });
});
