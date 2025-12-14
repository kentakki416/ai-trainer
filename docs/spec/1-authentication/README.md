# ユーザー認証機能

## 概要
Google OAuth 2.0 を唯一のサインイン手段として提供し、初回ログイン画面からログイン/サインアップを統合的に行う。認証完了後は JWT によりフロント/バックエンド間でセッションを管理し、ユーザープロフィールを自動生成する。


## データベース設計

### ER図

```
┌─────────────────┐
│   User          │
├─────────────────┤
│ id (PK)         │◄──┐
│ email           │   │
│ name            │   │
│ avatarUrl       │   │
│ createdAt       │   │
│ updatedAt       │   │
└─────────────────┘   │
                      │ 1
                      │
                      │ N
        ┌─────────────┴──────────┐
        │                        │
┌───────┴──────────┐    ┌───────-┴─────────┐
│  AuthAccount     │    │  UserCharacter   │
├──────────────────┤    ├──────────────────┤
│ id (PK)          │    │ id (PK)          │
│ userId (FK)      │    │ userId (FK)      │
│ provider         │    │ characterCode(FK)│
│ providerAccountId│    │ nickName         │
│ accessToken      │    │ isActive         │
│ refreshToken     │    │ createdAt        │
│ expiresAt        │    │ updatedAt        │
│ idToken          │    └──────────────────┘
│ scope            │              │
│ tokenType        │              │ N
│ createdAt        │              │
│ updatedAt        │              │ 1
└──────────────────┘              │
                         ┌────────┴──────────┐
                         │  Character        │
                         │  (マスターデータ)   │
                         ├───────────────────┤
                         │ code (PK)         │
                         │ name              │
                         │ description       │
                         │ imageUrl          │
                         │ createdAt         │
                         │ updatedAt         │
                         └───────────────────┘
```

### テーブル定義

#### 1. User（ユーザー）

| カラム名 | 型 | 制約 | 説明 |
|---------|-----|------|------|
| id | Int | PK, AUTO_INCREMENT | ユーザーID |
| email | String | UNIQUE, NULL可 | メールアドレス |
| name | String | NULL可 | 表示名 |
| avatarUrl | String | NULL可 | プロフィール画像URL |
| createdAt | DateTime | NOT NULL | 作成日時 |
| updatedAt | DateTime | NOT NULL | 更新日時 |

#### 2. AuthAccount（認証アカウント）

| カラム名 | 型 | 制約 | 説明 |
|---------|-----|------|------|
| id | Int | PK, AUTO_INCREMENT | アカウントID |
| userId | Int | FK (User), NOT NULL | ユーザーID |
| provider | String | NOT NULL | 認証プロバイダー（"google"） |
| providerAccountId | String | NOT NULL | プロバイダー側のユーザーID |
| accessToken | String | NULL可 | アクセストークン |
| refreshToken | String | NULL可 | リフレッシュトークン |
| expiresAt | Int | NULL可 | トークン有効期限（Unix timestamp） |
| idToken | String | NULL可 | IDトークン（JWT） |
| scope | String | NULL可 | 認可スコープ |
| tokenType | String | NULL可 | トークンタイプ（"Bearer"） |
| createdAt | DateTime | NOT NULL | 作成日時 |
| updatedAt | DateTime | NOT NULL | 更新日時 |

**複合ユニークキー**: (provider, providerAccountId)

#### 3. UserCharacter（ユーザーキャラクター）

| カラム名 | 型 | 制約 | 説明 |
|---------|-----|------|------|
| id | Int | PK, AUTO_INCREMENT | ユーザーキャラクターID |
| userId | Int | FK (User), NOT NULL | ユーザーID |
| characterCode | Enum | FK (Character), NOT NULL | キャラクターコード |
| nickName | String | NOT NULL | ニックネーム |
| isActive | Boolean | DEFAULT false | アクティブ状態 |
| createdAt | DateTime | NOT NULL | 作成日時 |
| updatedAt | DateTime | NOT NULL | 更新日時 |

#### 4. Character（キャラクターマスター）

| カラム名 | 型 | 制約 | 説明 |
|---------|-----|------|------|
| code | Enum | PK | キャラクターコード（ERIKA, SAKURA, AOI） |
| name | String | NOT NULL | キャラクター名 |
| description | String | NULL可 | 説明 |
| imageUrl | String | NULL可 | 画像URL |
| createdAt | DateTime | NOT NULL | 作成日時 |
| updatedAt | DateTime | NOT NULL | 更新日時 |

---

## 認証フロー

### Google OAuth 2.0 認証フロー（詳細）

```
┌─────────┐                 ┌─────────┐                 ┌──────────┐
│ Browser │                 │ API     │                 │ Google   │
│ (Next.js)│                │ Server  │                 │ OAuth    │
└────┬────┘                 └────┬────┘                 └────┬─────┘
     │                           │                           │
     │ 1. GET /login             │                           │
     │──────────────────────────>│                           │
     │                           │                           │
     │ 2. Redirect to            │                           │
     │    /api/auth/google       │                           │
     │<──────────────────────────│                           │
     │                           │                           │
     │ 3. GET /api/auth/google   │                           │
     │──────────────────────────>│                           │
     │                           │                           │
     │                           │ 4. Generate Auth URL      │
     │                           │    (scope, redirect_uri)  │
     │                           │                           │
     │ 5. Redirect to Google     │                           │
     │    (https://accounts.google.com/o/oauth2/v2/auth)    │
     │<──────────────────────────│                           │
     │                                                       │
     │ 6. User Login & Consent                               │
     │──────────────────────────────────────────────────────>│
     │                                                       │
     │ 7. Redirect to callback                               │
     │    /api/auth/callback?code=xxx                        │
     │<──────────────────────────────────────────────────────│
     │                                                       │
     │ 8. GET /api/auth/callback?code=xxx                    │
     │──────────────────────────────────────────────────────>│
     │                           │                           │
     │                           │ 9. Exchange code for token│
     │                           │──────────────────────────>│
     │                           │                           │
     │                           │ 10. Return tokens         │
     │                           │    (access_token, etc)    │
     │                           │<──────────────────────────│
     │                           │                           │
     │                           │ 11. Get user info         │
     │                           │──────────────────────────>│
     │                           │                           │
     │                           │ 12. Return user data      │
     │                           │<──────────────────────────│
     │                           │                           │
     │                           │ 13. Check if user exists  │
     │                           │    (findByProvider)       │
     │                           │                           │
     │                           │ 14. Create/Update User    │
     │                           │    & AuthAccount in DB    │
     │                           │                           │
     │                           │ 15. Generate JWT          │
     │                           │    (userId, email, etc)   │
     │                           │                           │
     │ 16. Set Cookie (JWT)      │                           │
     │    & Redirect to /home    │                           │
     │<──────────────────────────│                           │
     │                           │                           │
```

### 認証フロー詳細

#### 1. ログイン開始
- ユーザーが「Googleでログイン」ボタンをクリック
- `/api/auth/google` にリダイレクト

#### 2. Google認証URL生成
- APIサーバーがGoogle OAuth 2.0の認証URLを生成
- スコープ: `openid email profile`
- リダイレクトURI: `/api/auth/callback`
- Googleの認証画面にリダイレクト

#### 3. ユーザー認証
- ユーザーがGoogleアカウントでログイン
- アプリへのアクセス許可を付与

#### 4. コールバック処理
- GoogleがコールバックURL (`/api/auth/callback?code=xxx`) にリダイレクト
- APIサーバーが認可コードをアクセストークンに交換
- Googleからユーザー情報を取得

#### 5. ユーザー登録/ログイン
- `AuthAccount.findByProvider()` でユーザーの存在確認
- **既存ユーザー**: ログイン処理
- **新規ユーザー**: User作成 + AuthAccount作成

#### 6. JWT発行
- ユーザー情報を元にJWTを生成
- ペイロード: `{ userId, email, name }`
- 有効期限: 7日間

#### 7. セッション確立
- JWTをHTTP-Only Cookieに保存
- ホーム画面 (`/home`) にリダイレクト

---

## API仕様

### 認証関連API一覧

| エンドポイント | メソッド | 認証 | 説明 |
|--------------|---------|------|------|
| `/api/auth/google` | GET | 不要 | Google OAuth 認証開始 |
| `/api/auth/callback` | GET | 不要 | OAuth コールバック処理 |
| `/api/auth/me` | GET | 必要 | 現在のユーザー情報取得 |
| `/api/auth/logout` | POST | 必要 | ログアウト |

---

### 1. Google OAuth 認証開始

**エンドポイント**: `GET /api/auth/google`

**説明**: Google OAuth 2.0 の認証フローを開始します。

**リクエスト**: なし

**レスポンス**: Google の認証画面にリダイレクト

**実装**:
- Controller: `GoogleAuthController`
- Service: `googleOAuthService.getAuthUrl()`
- Client: `GoogleOAuthClient.generateAuthUrl()`

---

### 2. OAuth コールバック

**エンドポイント**: `GET /api/auth/callback`

**説明**: Google からのコールバックを処理し、ユーザー登録/ログインを実行します。

**リクエスト**:
```typescript
// Query Parameters
{
  code: string  // Google から返された認可コード
}
```

**レスポンス**:
- 成功: JWT を Cookie にセットし、`/home` にリダイレクト
- 失敗: エラーメッセージと共に `/login` にリダイレクト

**スキーマ**: `GoogleCallbackRequestSchema`, `GoogleCallbackResponseSchema`

**実装**:
- Controller: `GoogleCallbackController`
- Service: `googleOAuthService.handleCallback()`
- Repository: `userRepository`, `authAccountRepository`
- Client: `GoogleOAuthClient.getUserInfo()`

**処理フロー**:
1. 認可コードをアクセストークンに交換
2. Googleからユーザー情報を取得
3. `AuthAccount.findByProvider()` でユーザー検索
4. 新規ユーザーの場合: User + AuthAccount を作成
5. 既存ユーザーの場合: AuthAccount のトークンを更新
6. JWTを生成
7. HTTP-Only Cookie にJWTを保存
8. `/home` にリダイレクト

---

### 3. 現在のユーザー情報取得

**エンドポイント**: `GET /api/auth/me`

**説明**: JWT から現在ログイン中のユーザー情報を取得します。

**リクエスト**:
```typescript
// Headers
{
  Cookie: "token=<JWT>"  // または Authorization: Bearer <JWT>
}
```

**レスポンス**:
```typescript
{
  avatarUrl: string | null
  email: string | null
  id: number
  name: string | null
}
```

**スキーマ**: `GetCurrentUserResponseSchema`

**実装**:
- Controller: `GetCurrentUserController`
- Service: `authService.getCurrentUser()`
- Repository: `userRepository.findById()`
- Middleware: `authMiddleware` (JWT検証)

**エラー**:
- 401 Unauthorized: JWTが無効または期限切れ

---

### 4. ログアウト

**エンドポイント**: `POST /api/auth/logout`

**説明**: ログアウトし、JWT Cookie を削除します。

**リクエスト**: なし

**レスポンス**:
```typescript
{
  message: string  // "ログアウトしました"
}
```

**スキーマ**: `LogoutResponseSchema`

**実装**:
- Controller: `LogoutController`
- Cookie削除処理

---

## セキュリティ考慮事項

### 環境変数管理
- `GOOGLE_CLIENT_ID`: Google Cloud Consoleで取得
- `GOOGLE_CLIENT_SECRET`: Google Cloud Consoleで取得（秘密情報）
- `JWT_SECRET`: ランダムな文字列（32文字以上推奨）
- `GOOGLE_REDIRECT_URI`: `http://localhost:8080/api/auth/callback`（本番では HTTPS）

### JWT設定
- **有効期限**: 7日間
- **保存場所**: HTTP-Only Cookie（XSS対策）
- **署名アルゴリズム**: HS256

### CORS設定
- **開発環境**: `http://localhost:3000`（Next.js）を許可
- **本番環境**: 信頼できるオリジンのみ許可

### HTTPS必須
- 本番環境では必ずHTTPSを使用
- Cookie の `Secure` フラグを有効化

---

## Google OAuth設定

### Google Cloud Console設定手順

1. **プロジェクト作成**
   - Google Cloud Console にアクセス
   - 新しいプロジェクトを作成

2. **OAuth 2.0 クライアントID作成**
   - 「APIとサービス」→「認証情報」
   - 「認証情報を作成」→「OAuth クライアント ID」
   - アプリケーションの種類: 「ウェブアプリケーション」

3. **リダイレクトURI設定**
   - 承認済みのリダイレクト URI:
     - 開発: `http://localhost:8080/api/auth/callback`
     - 本番: `https://yourdomain.com/api/auth/callback`

4. **スコープ設定**
   - `openid`
   - `email`
   - `profile`

5. **認証情報取得**
   - クライアントID とクライアントシークレットをコピー
   - `.env.local` に保存

---

## 関連ドキュメント
- [API仕様書](../api/api-specification.md)
- [データベーススキーマ](../database/database-schema.md)

# 1. 認証機能 - 実装ガイド

このドキュメントは、認証機能を**ステップ単位で動作確認しながら実装する**ためのガイドです。

## 🎨 デザイン要件

### 全体
- **レスポンシブ対応**: すべてのページでPC・タブレット・モバイルに対応
- **メインカラー**: 青（`#3B82F6` / Tailwind CSS `blue-500`をベースカラーとして使用）

### ログイン画面
**PC表示（768px以上）**:
- 左側: Googleログイン/アカウント登録ボタン
- 右側: Lottieアニメーション（トレちゃん）
- 2カラムレイアウト

**モバイル表示（768px未満）**:
- 縦並びレイアウト
- 上部: タイトルとLottieアニメーション
- 下部: Googleログイン/アカウント登録ボタン

## 🔐 セキュリティ考慮事項

各ステップのドキュメント内で、セキュリティに関する注意事項が記載されています。特に以下の点に注意してください：

- JWT_SECRET などの環境変数の適切な管理
- CORS 設定の本番環境への適用
- HTTPS の使用（本番環境）
- トークンの安全な管理（URL パラメータではなく、セッションクッキーや Authorization Code Flow の検討）

---