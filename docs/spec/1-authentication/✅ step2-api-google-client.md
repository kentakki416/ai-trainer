# Step 2: API - Google OAuth Client

## 目的
Google OAuth 認証を行うためのクライアントを実装する。このクライアントは、Google の認証 URL 生成とユーザー情報取得を担当します。

## 実装手順

### 依存パッケージインストール

Google OAuth 認証と JWT トークン生成に必要なパッケージをインストールします：

```bash
cd apps/api
pnpm add google-auth-library jsonwebtoken
pnpm add -D @types/jsonwebtoken
```

**パッケージの説明**:
- `google-auth-library`: Google の公式 OAuth2 クライアントライブラリ
- `jsonwebtoken`: JWT トークンの生成・検証ライブラリ
- `@types/jsonwebtoken`: jsonwebtoken の TypeScript 型定義

### Google OAuth Client 作成

**ファイル**: `apps/api/src/client/google-auth.ts`

```typescript
import { OAuth2Client } from 'google-auth-library'

export type GoogleUserInfo = {
  email: string
  id: string
  name: string
  picture?: string
}

type GoogleUserInfoResponse = {
  email: string
  family_name?: string
  given_name?: string
  id: string
  locale?: string
  name: string
  picture?: string
  verified_email?: boolean
}

export type GoogleAuthUrlOptions = {
  accessType?: 'offline' | 'online'
  prompt?: 'none' | 'consent' | 'select_account'
  scope?: string[]
  state?: string
}

export class GoogleOAuthClient {
  private oauth2Client: OAuth2Client

  constructor(
    clientId: string,
    clientSecret: string,
    callbackUrl: string
  ) {
    this.oauth2Client = new OAuth2Client(clientId, clientSecret, callbackUrl)
  }

  public generateAuthUrl(options?: GoogleAuthUrlOptions): string {
    return this.oauth2Client.generateAuthUrl({
      access_type: options?.accessType ?? 'offline',
      prompt: options?.prompt ?? 'consent',
      scope: options?.scope ?? [
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
      ],
      state: options?.state,
    })
  }

  public async getUserInfo(code: string): Promise<GoogleUserInfo> {
    const { tokens } = await this.oauth2Client.getToken(code)
    this.oauth2Client.setCredentials(tokens)

    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    })

    const data = await response.json() as GoogleUserInfoResponse

    return {
      email: data.email,
      id: data.id,
      name: data.name,
      picture: data.picture,
    }
  }
}
```

**実装のポイント**:

1. **型定義**
   - `GoogleUserInfo`: 外部に公開するユーザー情報の型（必要最小限のフィールド）
   - `GoogleUserInfoResponse`: Google API からのレスポンス型（内部使用）
   - `GoogleAuthUrlOptions`: 認証 URL 生成のオプション型（型安全な Google 固有のパラメータ）
   - Interface ではなく type を使用することで、プロバイダー固有の型安全性を確保

2. **設計思想**
   - 将来的に GitHub OAuth などの他のプロバイダーを追加する場合、それぞれ独立したクラスとして実装
   - 各プロバイダーは異なるパラメータを持つため、無理に抽象化せず型安全性を優先
   - テストは Jest などのモックライブラリで対応可能

3. **generateAuthUrl メソッド**
   - Google の認証画面 URL を生成
   - オプション引数で柔軟にパラメータを指定可能
   - `accessType`: 'offline' でリフレッシュトークンを取得（デフォルト）
   - `prompt`: 同意画面の表示方法を指定（デフォルト: 'consent'）
   - `scope`: 取得する権限を指定（デフォルト: email と profile）

4. **getUserInfo メソッド**
   - 認証コードからアクセストークンを取得
   - Google OAuth2 v2 API を使用してユーザー情報を取得
   - レスポンスに型アサーションを適用して型安全性を確保



### 環境変数の設定

Google OAuth を使用するには、Google Cloud Console で OAuth 2.0 クライアント ID を作成し、以下の環境変数を設定する必要があります。

**ファイル**: `apps/api/.env.local`

```bash
# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:8080/api/auth/google/callback

# JWT
JWT_SECRET=your-jwt-secret-key-here
JWT_EXPIRATION=30d

# Frontend
FRONTEND_URL=http://localhost:3000
```

**重要**:
- `.env.local` ファイルは `.gitignore` に含まれているため、Git にコミットされません
- 本番環境では、環境変数を安全に管理してください（AWS Secrets Manager、環境変数設定など）

### Google Cloud Console での設定

1. [Google Cloud Console](https://console.cloud.google.com/) にアクセス
2. プロジェクトを作成（または既存のプロジェクトを選択）
3. 「APIとサービス」→「認証情報」に移動
4. 「認証情報を作成」→「OAuth 2.0 クライアント ID」を選択
5. アプリケーションの種類: 「ウェブアプリケーション」
6. 承認済みのリダイレクト URI: `http://localhost:8080/api/auth/google/callback` を追加
7. クライアント ID とクライアントシークレットをコピーして `.env.local` に設定

## セキュリティに関する注意事項

### Client Secret の管理
- `GOOGLE_CLIENT_SECRET` は絶対に公開リポジトリにコミットしないこと
- `.env.local` ファイルを `.gitignore` に追加していることを確認

### リダイレクト URI の検証
- Google Cloud Console で設定したリダイレクト URI と、実際のコールバック URL が一致していることを確認
- 本番環境では HTTPS を使用すること

### スコープの最小化
- 必要最低限のスコープのみを要求する
- 現在は `email` と `profile` のみを要求

## 動作確認

このステップでは、まだ実際にクライアントを使用しません。次のステップ（Service 層）で使用されます。コンパイルエラーが発生しないことを確認してください：

```bash
cd apps/api
pnpm build
```

ビルドが成功すれば OK です。