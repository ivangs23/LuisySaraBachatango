import type { Dictionary } from '@/utils/i18n/types'

export const ja: Dictionary = {
  header: {
    courses: "コース", events: "イベント", music: "音楽", community: "コミュニティ", about: "私達について", login: "ログイン", profile: "プロフィール", dashboard: "ダッシュボード", logout: "ログアウト"
  },
  common: {
    processing: "処理中...",
    subscribeNow: "今すぐ登録",
    login: "ログイン"
  },
  footer: {
    description: "ルイスとサラと一緒にバチャタンゴを学びましょう。バチャータの官能性とタンゴの優雅さの完璧な融合。",
    explore: "探索", home: "ホーム", contact: "お問い合わせ", notice: "法的通知",
    legal: "法的事項", terms: "利用規約", privacy: "プライバシーポリシー", cookies: "クッキーポリシー", rights: "全著作権所有。", blog: "ブログ"
  },
  hero: {
    title: "バチャタンゴの芸術をマスターする",
    subtitle: "最高のインストラクター、ルイスとサラから学びましょう。独占コース、洗練されたテクニック、そして情熱を一歩一歩。",
    cta: "コースを見る",
    sampleClass: "サンプルクラスを見る",
    scrollLabel: "スクロールして詳細を見る",
    stats: { years: "ダンス歴", students: "受講生", countries: "訪問国" }
  },
  features: {
    monthly: { title: "完全コース", desc: "初心者から上級者まで、最初から最後まで学べる総合プログラム。一度のお支払いで生涯アクセス可能。" },
    exclusive: { title: "独占コンテンツ", desc: "他では見られないテクニック、音楽性、コネクションの秘密。" },
    access: { title: "24時間365日アクセス", desc: "いつでも利用可能な学習プラットフォーム。" }
  },
  testimonials: {
    title: "生徒の声",
    t1: { quote: "画面越しにこんな風につながることを学べるとは思いませんでした。", role: "生徒" },
    t2: { quote: "バチャタンゴは発見でした。", role: "アマチュアダンサー" },
    t3: { quote: "自宅練習に最適。", role: "ダンスカップル" }
  },
  faq: {
    title: "よくある質問",
    q1: { q: "経験は必要ですか？", a: "必要ありません。" },
    q2: { q: "コースへのアクセス方法は？", a: "登録後すぐにアクセスできます。" },
    q3: { q: "キャンセルは可能ですか？", a: "はい、いつでも可能です。" },
    q4: { q: "パートナーがいなくても大丈夫？", a: "もちろんです。" }
  },
  newsletter: {
    title: "コミュニティに参加", desc: "独占的なダンスのヒントを受け取る。", placeholder: "メールアドレス", button: "登録する"
  },
  events: {
    title: "アジェンダ＆イベント", desc: "次に行く場所をチェック。", details: "詳細",
    create: "新しいイベント",
    edit: "編集",
    delete: "削除",
    deleteConfirm: "このイベントを削除しますか？",
    draft: "下書き",
    empty: { title: "新しい日程を準備中です", text: "近日中にまたチェックしてください。次の開催情報はSNSでお知らせします。" },
    upcoming: { eyebrow: "アジェンダ", heading: "次の開催地", pill: "まもなく", singular: "まもなく開催", plural: "今後の予定" },
    past: { eyebrow: "アーカイブ", heading: "過去の日程", pill: "終了" }
  },
  music: { title: "プレイリスト", desc: "音楽はダンスの心臓です。" },
  blog: {
    title: "ブログ＆記事", desc: "考察、テクニック、文化。", readMore: "続きを読む",
    items: {
      a1: { t: "バチャタンゴとは何か？", c: "歴史", e: "この融合の起源を発見する。" },
      a2: { t: "姿勢の5つのよくある間違い", c: "テクニック", e: "良いコネクションの基礎。" },
      a3: { t: "タンゴ対バチャータの音楽性", c: "音楽性", e: "強いビートとメロディーを理解する。" }
    }
  },
  contact: {
    title: "予約", desc: "あなたの街に私たちを呼びたいですか？",
    form: {
      name: "名前 / 主催者", namePlace: "あなたの名前",
      email: "メール", type: "イベントタイプ", types: { fest: "フェスティバル", work: "ワークショップ", show: "ショー", other: "その他" },
      message: "詳細", messagePlace: "詳しく教えてください...", submit: "送信"
    }
  },
  about: {
    heroTitle: "情熱と優雅さ", heroSubtitle: "ルイスとサラの物語", bioTitle: "ダンス以上のつながり",
    bio1: "ルイスとサラはバチャータとタンゴの融合のパイオニアです。",
    bio2: "彼らの旅はマドリードで始まりました。",
    stats: { s1: "年の経験", s2: "オンラインの生徒", s3: "訪問した国", s4: "国際チャンピオン" },
    quote: "バチャタンゴはただのステップではありません、感じることです。", cta: "今日から踊り始めよう"
  },
  communityPage: {
    joinTitle: "コミュニティに参加",
    joinDesc: "独占的な議論に参加するには、登録と購読が必要です。",
    alreadyAccount: "すでにアカウントをお持ちですか？",
    login: "ログイン",
    title: "コミュニティ",
    create: "投稿を作成"
  },
  coursesPage: {
    title: "利用可能なコース",
    create: "+ コースを作成",
    empty: "現在公開されているコースはありません。",
    emptySub: "すぐに新しいクラスをチェックしに来てください！",
    view: "クラスを見る",
    viewMore: "もっと見る →",
    buy: "購入する →",
    hasAccess: "✓ アクセス権があります",
    priceNA: "価格未設定",
    completeCourses: "完全コース",
    completeSub: "固定価格・永久アクセス",
    monthlyClasses: "月次クラス",
    monthlySub: "月4クラス・サブスクリプションまたは月別個別購入",
    filterAll: "すべて",
    months: ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"]
  },
  lesson: {
    backToCourse: "← コースに戻る",
    courseLessons: "コースのレッスン",
    lockedContent: "ロックされたコンテンツ",
    lockedMessage: "このビデオはプレミアム会員専用です。",
    getPremium: "プレミアムを取得",
    editLesson: "✎ レッスンを編集",
    exclusiveContent: "このレッスンのコンテンツはプレミアム会員専用です。",
    description: "説明",
    musicalResources: "音楽リソース",
    assignment: "課題",
    comments: "コメント",
    resourcesComingSoon: "音楽リソース近日公開...",
    assignmentNoTask: "先生はこのレッスンにタスクを割り当てていません。",
    assignmentNoTaskAdmin: "このレッスンにはまだタスクがありません。「レッスンを編集」から追加してください。",
    assignmentReviewed: "✓ 課題採点済み",
    assignmentGradeLabel: "評価：",
    assignmentResponseLabel: "あなたの回答（テキスト）",
    assignmentFileLabel: "ファイルを添付（任意）",
    assignmentResponsePlaceholder: "ここに回答を書いてください...",
    assignmentSubmitBtn: "提出する",
    assignmentUpdateBtn: "提出を更新",
    assignmentUploading: "ファイルをアップロード中...",
    assignmentSending: "送信中...",
    assignmentSuccess: "提出が正常に送信されました！",
    assignmentViewSubmissions: "すべての提出を見る",
    previousLesson: "前へ",
    nextLesson: "次へ",
    lessonNavigation: "レッスン切り替え"
  },
  dashboard: {
    title: "マイコース",
    viewClass: "クラスを見る",
    empty: "まだコースがありません。",
    emptySub: "カタログを見て、今日から踊り始めましょう。",
    discover: "新着コース",
    exploreAll: "すべてのコースを見る →"
  },
  login: {
    title: "ログイン",
    subtitle: "ルイスとサラの独占プラットフォームにアクセス",
    email: "メール",
    password: "パスワード",
    submit: "ログイン",
    noAccount: "アカウントがない？登録する",
    forgotPassword: "パスワードをお忘れですか？",
    or: "または",
    panelEyebrow: "プライベートアクセス",
    panelTitle: "踊ることは体で",
    panelTitleEmphasis: "思い出す",
    panelTitleSuffix: "こと。",
    panelLead: "アカデミーに戻りましょう：新しいクラス、活発なコミュニティ、ルイスとサラのアーカイブ全体があなたを待っています。",
    panelFeatures: ["高画質ビデオクラス", "ダンサーコミュニティとイベント", "あなたの進捗、レッスンごとに保存"],
    panelQuote: "バチャータは学ぶものではなく、感じるものです。でも練習が必要です。",
    cardEyebrow: "ログイン"
  },
  signup: {
    title: "登録する",
    subtitle: "プラットフォームにアクセスするためのアカウントを作成",
    email: "メール",
    fullName: "氏名",
    fullNamePlaceholder: "山田太郎",
    password: "パスワード",
    submit: "登録する",
    hasAccount: "すでにアカウントをお持ちですか？ログイン",
    forgotPassword: "パスワードをお忘れですか？",
    or: "または",
    panelEyebrow: "アカデミーに参加",
    panelTitle: "最初の",
    panelTitleEmphasis: "クラス",
    panelTitleSuffix: "は一歩から始まります。",
    panelLead: "アカウントを作成して、クラス、月間チャレンジ、ルイス・イ・サラ・バチャタンゴコミュニティへのアクセスを開放しましょう。",
    panelFeatures: ["全レベルのクラスへのアクセス", "イベント、集まり、厳選された音楽", "温かくて親しみやすいコミュニティ"],
    panelQuote: "ゆっくり踊ることで、素早く理解できる。",
    cardEyebrow: "アカウント作成"
  },
  forgotPassword: {
    title: "パスワードの回復",
    subtitle: "回復リンクを受け取るためにメールアドレスを入力",
    email: "メール",
    submit: "リンクを送る",
    backToLogin: "ログインに戻る",
    panelEyebrow: "アクセスを回復",
    panelTitle: "数ステップで",
    panelTitleEmphasis: "フロア",
    panelTitleSuffix: "に戻りましょう。",
    panelLead: "進捗を失わずに新しいパスワードを作成できるよう、メールに安全なリンクを送ります。",
    panelFeatures: ["リンクは限られた時間有効です", "アカウントとクラスは無傷のままです", "届かない場合はスパムフォルダを確認してください"],
    cardEyebrow: "回復する"
  },
  profile: {
    title: "マイプロフィール",
    editProfile: "プロフィールを編集",
    accountInfo: "アカウント情報",
    email: "メール",
    subscription: "サブスクリプション",
    status: "ステータス",
    active: "アクティブ",
    inactive: "非アクティブ",
    activeUntil: "サブスクリプションは",
    noActiveSubscription: "現在アクティブなサブスクリプションがありません。",
    dangerZone: "危険ゾーン",
    undoableWarning: "これらの操作は元に戻せません。",
    logout: "ログアウト",
    deleteAccount: "アカウントを削除"
  },
  pricing: {
    title: "サブスクリプション",
    subtitle: "月額サブスクリプションでルイスとサラのバチャータコースにアクセス。毎月4つの新しいクラスが含まれます。",
    comingSoon: "近日公開",
    mostPopular: "最人気",
    perMonth: "/月",
    note: "過去の月にアクセスしたいですか？コースページから個別に購入できます。"
  },
  errors: {
    invalid_credentials: "認証情報が正しくありません。メールとパスワードを確認してください。",
    signup_failed: "アカウントの作成に失敗しました。もう一度お試しください。",
    invalid_email: "メールアドレスが無効です。",
    password_too_short: "パスワードは8文字以上である必要があります。",
    reset_failed: "リンクの送信に失敗しました。もう一度お試しください。",
    rate_limit: "試行回数が多すぎます。1分待ってから再試行してください。",
    unknown: "エラーが発生しました。もう一度お試しください。"
  },
  messages: {
    email_confirmation: "登録プロセスを続けるにはメールを確認してください。",
    email_reset: "パスワードリセットプロセスを続けるにはメールを確認してください。",
    account_deleted: "アカウントが正常に削除されました。"
  }
}
