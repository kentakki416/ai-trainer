# Google OAuth 認証機能

## 仕様

- Google OAuth 2.0 を利用したソーシャルログイン機能を提供
- 初回ログイン時に自動的にユーザーアカウントを作成（サインアップ不要）
- 認証成功後、JWT トークンを発行してセッション管理
- ユーザー情報（email, name, avatarUrl）を Google から自動取得
- 初回登録時にデフォルトキャラクター「トレちゃん」を自動設定
- JWT は 30 日間有効（環境変数で変更可能）
- API リクエストには Authorization ヘッダーで JWT を送信
- トークン検証失敗時は 401 Unauthorized を返す
- Google アカウントと内部ユーザーの紐付けは AuthAccount テーブルで管理
- 1 ユーザーは複数の OAuth プロバイダーと紐付け可能（将来的な拡張を考慮）

## 必要な API

| エンドポイント | メソッド | 認証 | 説明 |
|--------------|---------|------|------|
| `/api/auth/google` | GET | 不要 | Google OAuth 認証を開始（Google の認証画面にリダイレクト） |
| `/api/auth/google/callback` | GET | 不要 | Google からのコールバックを処理し、JWT を返す |
| `/api/auth/me` | GET | 必要 | 現在ログイン中のユーザー情報を取得 |

## 必要な画面

本機能は API のみで、画面は含まれません。フロントエンド側で以下の画面を実装する必要があります。

- **ログイン画面**: 「Google でログイン」ボタンを配置し、`/api/auth/google` にリダイレクト
- **コールバック処理画面**: Google からのリダイレクトを受け取り、JWT をローカルストレージまたは Cookie に保存

## フロントエンド（Web）の認証設計

### 使用技術

- **フレームワーク**: Next.js 16 (App Router)
- **認証方式**: cookiesベースのセッション管理
- **状態管理**: Server Actions（`'use server'` ディレクティブ）
- **アニメーション**: lottie-react（トレちゃんのアニメーション表示）

### 認証フロー

1. **ログイン画面** (`app/(auth)/login/page.tsx`)
   - 「Googleでログイン」ボタンをクリック
   - APIサーバーの `/api/auth/google` にリダイレクト

2. **Google OAuth認証**
   - ユーザーがGoogleアカウントで認証
   - Google から APIサーバーの `/api/auth/google/callback` にリダイレクト

3. **コールバック処理** (`app/auth/callback/page.tsx`)
   - クエリパラメータから `token` を取得
   - Server Action `handleAuthCallback(token)` を呼び出し
   - JWTをhttpOnly cookieに保存（`ai_trainer_token`）
   - ホーム画面（`/`）にリダイレクト

4. **認証済みページ** (`app/page.tsx`)
   - Server Action `getCurrentUser()` でユーザー情報を取得
   - cookieからJWTを読み取り、APIサーバーに `/api/auth/me` リクエスト
   - ユーザー情報を表示

5. **ログアウト**
   - Server Action `logout()` を呼び出し
   - cookieからJWTを削除
   - ログイン画面（`/login`）にリダイレクト

### セッション管理

#### Cookie設定

```typescript
{
  httpOnly: true,        // XSS攻撃対策（JavaScriptからアクセス不可）
  secure: true,          // 本番環境ではHTTPS必須
  sameSite: 'lax',       // CSRF攻撃対策
  maxAge: 60 * 60 * 24 * 30, // 30日間有効
  path: '/',
}
```

#### 認証ユーティリティ (`lib/auth.ts`)

- `saveToken(token: string)`: JWTをcookieに保存
- `getToken()`: cookieからJWTを取得
- `removeToken()`: cookieからJWTを削除

**注意**: `'server-only'` をインポートして、サーバーサイドでのみ実行されることを保証

### Server Actions (`lib/actions/auth.ts`)

| 関数 | 説明 | 返り値 |
|------|------|--------|
| `handleAuthCallback(token: string)` | OAuthコールバック後の処理。JWTをcookieに保存し、ホーム画面にリダイレクト | void |
| `logout()` | ログアウト処理。cookieからJWTを削除し、ログイン画面にリダイレクト | void |
| `getCurrentUser()` | 現在ログイン中のユーザー情報を取得。cookieからJWTを取得し、APIサーバーに問い合わせ | User \| null |

**注意**: すべての関数に `'use server'` ディレクティブを付与

### 認証チェック (middleware.ts)

Next.js のミドルウェアで認証チェックを行い、未認証時にリダイレクト：

- **保護されたパス** (`/`): cookieに `ai_trainer_token` がない場合、`/login` にリダイレクト
- **ログインページ** (`/login`): cookieに `ai_trainer_token` がある場合、`/` にリダイレクト

### ディレクトリ構成

```
apps/web/
├── app/
│   ├── (auth)/
│   │   └── login/
│   │       └── page.tsx            # ログイン画面
│   ├── auth/
│   │   └── callback/
│   │       └── page.tsx            # OAuthコールバック処理
│   └── page.tsx                    # ホーム画面（認証済み）
├── lib/
│   ├── auth.ts                     # 認証ユーティリティ（saveToken, getToken, removeToken）
│   └── actions/
│       └── auth.ts                 # Server Actions（handleAuthCallback, logout, getCurrentUser）
├── middleware.ts                   # 認証チェック
└── .env.local                      # 環境変数（NEXT_PUBLIC_API_URL）
```

### 使用ライブラリ

| ライブラリ | 用途 | インストールコマンド |
|-----------|------|---------------------|
| lottie-react | トレちゃんのアニメーション表示 | `pnpm add lottie-react` |

### セキュリティ考慮事項

- **httpOnly cookie**: JavaScriptからアクセスできないため、XSS攻撃に強い
- **Secure flag**: 本番環境では必ずHTTPSを使用（`NODE_ENV === 'production'` で自動設定）
- **SameSite=Lax**: CSRF攻撃を防ぐ
- **Server Actions**: サーバーサイドで実行されるため、クライアントサイドにトークンが露出しない
- **Middleware**: すべてのリクエストで認証チェックを行い、未認証時はリダイレクト

### レスポンシブデザイン

- **PC表示（768px以上）**: 左にログインフォーム、右にLottieアニメーション（横並び）
- **モバイル表示（768px未満）**: 上部にアニメーション、下部にログインフォーム（縦並び）
- **メインカラー**: 青（`blue-500`, `blue-600`, `from-blue-50 to-blue-100`）

## 必要な DB 設計

| テーブル | 説明 | リレーション |
|---------|------|------------|
| User | ユーザーの基本情報を管理 | - |
| AuthAccount | OAuth プロバイダーとユーザーの紐付けを管理<br/>複合ユニークキー: `(provider, providerAccountId)` | User (N:1) |
| UserCharacter | ユーザーが選択したキャラクターを管理 | User (N:1), Character (N:1) |
| Character | キャラクターのマスターデータ | - |

## フロー図

### 認証フロー

```mermaid
sequenceDiagram
    participant U as ユーザー
    participant F as フロントエンド
    participant A as APIサーバー
    participant G as Google OAuth

    U->>F: ログインボタンをクリック
    F->>A: GET /api/auth/google
    A->>A: 認証URL生成
    A-->>F: Google認証画面にリダイレクト
    F->>G: ユーザーを認証画面に誘導
    U->>G: Googleアカウントでログイン
    G-->>A: GET /api/auth/google/callback?code=xxx
    A->>G: 認可コードをトークンに交換
    G-->>A: アクセストークン + ユーザー情報
    A->>A: ユーザー検索（AuthAccount）
    alt 既存ユーザー
        A->>A: ユーザー情報を取得
    else 新規ユーザー
        A->>A: User + AuthAccount + UserCharacter作成
    end
    A->>A: JWT生成
    A-->>F: JSON レスポンス（JWT + ユーザー情報）
    F->>F: JWTをストレージに保存
    F-->>U: ホーム画面に遷移
```

### 認証済み API リクエストフロー

```mermaid
sequenceDiagram
    participant F as フロントエンド
    participant M as 認証ミドルウェア
    participant C as Controller
    participant S as Service
    participant R as Repository

    F->>M: GET /api/auth/me<br/>Authorization: Bearer {JWT}
    M->>M: JWT検証
    alt JWT が有効
        M->>C: req.userIdを設定してnext()
        C->>S: getUserById(userId)
        S->>R: findById(userId)
        R-->>S: Userデータ
        S-->>C: Userデータ
        C->>C: レスポンススキーマ検証
        C-->>F: 200 OK + ユーザー情報
    else JWT が無効
        M-->>F: 401 Unauthorized
    end
```

## 注意事項

### セキュリティ

- **環境変数の管理**: `GOOGLE_CLIENT_SECRET` と `JWT_SECRET` は絶対に Git にコミットしない
- **JWT_SECRET**: 32 文字以上のランダムな文字列を使用
- **HTTPS 必須**: 本番環境では必ず HTTPS を使用し、Cookie の `Secure` フラグを有効化
- **トークンの有効期限**: JWT の有効期限を適切に設定（デフォルト 30 日）
- **CORS 設定**: 信頼できるオリジン（フロントエンドのドメイン）のみを許可
- **エラーメッセージ**: 詳細なエラー情報を返さない（攻撃者にヒントを与えない）

### パフォーマンス

- **DB インデックス**: `AuthAccount` の `(provider, providerAccountId)` に複合ユニークインデックスを設定済み
- **JWT 検証**: 毎回 DB に問い合わせず、JWT の署名検証のみで認証（ステートレス）

### 非機能要件

- **拡張性**: 将来的に他の OAuth プロバイダー（GitHub, Twitter など）を追加可能な設計
- **可用性**: Google OAuth サービスのダウンタイムに備えたエラーハンドリング
- **監査**: 認証失敗や異常なアクセスパターンをログに記録（今後実装予定）
