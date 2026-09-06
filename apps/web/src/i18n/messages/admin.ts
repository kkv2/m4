/**
 * Operator console copy. Japanese only, by requirement (FR-006): the console is
 * rendered entirely in Japanese regardless of any browser or account preference,
 * and offers no language control.
 *
 * Deliberately not part of `Messages`. That type is the contract every language
 * must satisfy, and adding console keys to it would oblige `en.ts` to translate
 * screens that are never shown in English.
 */
export const admin = {
  consoleName: "M4 運営コンソール",
  signIn: {
    title: "運営コンソールにログイン",
    emailLabel: "メールアドレス",
    passwordLabel: "パスワード",
    submit: "ログイン",
    // One message for every cause — wrong password, unknown address — so that a
    // caller cannot learn whether an address is registered (FR-022).
    failed: "メールアドレスまたはパスワードが正しくありません。",
    throttled: "ログインの試行回数が上限に達しました。しばらく時間をおいてから再度お試しください。",
    unexpectedError: "予期しないエラーが発生しました。時間をおいて再度お試しください。",
  },
  nav: {
    tenants: "テナント",
    signOut: "ログアウト",
  },
  tenants: {
    heading: "テナント",
    registerHeading: "テナントを登録",
    nameLabel: "表示名",
    namePlaceholder: "株式会社サンプル",
    defaultLanguageLabel: "デフォルト言語",
    submit: "登録",
    nameRequired: "表示名を入力してください。",
    registered: "テナントを登録しました。",
    empty: "登録されているテナントはまだありません。",
    columnName: "表示名",
    columnId: "テナント ID",
    columnLanguage: "デフォルト言語",
    columnUsers: "ユーザー数",
    columnChats: "チャット数",
    detail: "詳細",
    backToList: "テナント一覧へ戻る",
    notFound: "そのテナントは存在しません。",
  },
  users: {
    heading: "ユーザー",
    registerHeading: "ユーザーを登録",
    emailLabel: "メールアドレス",
    emailPlaceholder: "user@example.com",
    emailImmutable: "登録後は変更できません。",
    nameLabel: "表示名",
    namePlaceholder: "山田 太郎",
    languageLabel: "言語",
    submit: "登録",
    emailRequired: "メールアドレスを入力してください。",
    nameRequired: "表示名を入力してください。",
    emailTaken: "このメールアドレスは既に使用されています。",
    empty: "このテナントにはまだユーザーがいません。",
    columnName: "表示名",
    columnEmail: "メールアドレス",
    columnId: "ユーザー ID",
    columnLanguage: "言語",
    columnFirstLogin: "初回ログイン",
    firstLoginDone: "完了",
    firstLoginPending: "未完了",
    reissue: "パスワードを再発行",
    reissueConfirm:
      "このユーザーのパスワードを再発行します。現在のパスワードとログイン中のセッションは無効になります。",
  },
  credential: {
    heading: "パスワードを控えてください",
    // FR-003: shown once, unreadable afterwards. The operator hands it over out
    // of band, so if it is lost the only recovery is a reissue.
    onceOnly: "このパスワードは一度だけ表示されます。閉じると二度と確認できません。",
    emailLabel: "メールアドレス",
    passwordLabel: "パスワード",
    copy: "コピー",
    copied: "コピーしました",
    dismiss: "控えました",
  },
  language: {
    JA: "日本語",
    EN: "英語",
  },
} as const;
