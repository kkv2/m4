/**
 * Japanese messages, and the source of truth for the message key type.
 * `en.ts` is typed against this object, so a missing translation is a
 * compile error rather than a blank on screen.
 *
 * The operator console is Japanese-only (FR-006) and reads these directly,
 * without going through the language provider.
 */
export const ja = {
  common: {
    productName: "M4",
    signOut: "ログアウト",
    save: "保存",
    cancel: "キャンセル",
    submit: "送信",
    loading: "読み込み中…",
    unexpectedError: "予期しないエラーが発生しました。時間をおいて再度お試しください。",
  },
  signIn: {
    title: "ログイン",
    emailLabel: "メールアドレス",
    passwordLabel: "パスワード",
    submit: "ログイン",
    // One message for every failure cause: wrong password, unknown address,
    // throttled. FR-022 and FR-022e.
    failed: "メールアドレスまたはパスワードが正しくありません。",
    throttled: "ログインの試行回数が上限に達しました。しばらく時間をおいてから再度お試しください。",
    switchLanguage: "English",
  },
  firstLogin: {
    languageTitle: "表示言語を選んでください",
    languageDescription: "後から設定画面で変更できます。",
    languageSubmit: "次へ",
    passwordTitle: "パスワードを変更してください",
    passwordDescription: "運営から配布されたパスワードを、ご自身のパスワードに置き換えてください。",
    newPasswordLabel: "新しいパスワード",
    passwordSubmit: "設定して開始",
  },
  password: {
    tooShort: "パスワードは {minimumLength} 文字以上にしてください。",
    tooCommon: "よく使われるパスワードです。推測されにくいものにしてください。",
    matchesEmail: "メールアドレスと同じパスワードは使用できません。",
    matchesDisplayName: "表示名と同じパスワードは使用できません。",
    sameAsIssued: "配布されたパスワードとは異なるものにしてください。",
    currentIncorrect: "現在のパスワードが正しくありません。",
    sameAsCurrent: "現在のパスワードとは異なるものにしてください。",
  },
  settings: {
    title: "設定",
    userIdLabel: "ユーザー ID",
    emailLabel: "メールアドレス",
    readOnlyNote: "この項目は変更できません。",
    displayNameLabel: "表示名",
    languageLabel: "言語",
    currentPasswordLabel: "現在のパスワード",
    newPasswordLabel: "新しいパスワード",
    changePassword: "パスワードを変更",
    saved: "変更を保存しました。",
    shortcutHint: "⌘ + , でも開けます",
    close: "閉じる",
  },
  app: {
    welcome: "ようこそ",
    // The application itself arrives with issue #23; until then the shell says
    // plainly that first login worked and nothing is broken.
    nothingHereYet: "チャット機能は近日公開です。ログインは完了しています。",
    settings: "設定",
  },
  language: {
    ja: "日本語",
    en: "English",
  },
};

/**
 * The key structure every language must provide. Values are widened to `string`
 * on purpose — the guarantee worth having is that no key is missing, not that
 * two languages say the same words.
 */
export type Messages = typeof ja;
