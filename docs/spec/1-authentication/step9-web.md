## Step 9: Web - Server Actions

### 目的
Server Actionsを使った認証フローを実装し、cookiesベースのセッション管理を行う。

### 実装箇所
- `apps/web/lib/actions/auth.ts`
- `apps/web/lib/auth.ts`

### 実装手順

#### 6-1. 認証ユーティリティ作成

**ファイル**: `apps/web/lib/auth.ts`

```typescript
import 'server-only'

import { cookies } from 'next/headers'

const TOKEN_KEY = 'ai_trainer_token'

export async function saveToken(token: string): Promise<void> {
  ;(await cookies()).set(TOKEN_KEY, token, {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 30, // 30日
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  })
}

export async function getToken(): Promise<string | null> {
  const cookieStore = await cookies()
  const cookie = cookieStore.get(TOKEN_KEY)
  return cookie?.value || null
}

export async function removeToken(): Promise<void> {
  ;(await cookies()).delete(TOKEN_KEY)
}
```

#### 6-2. Auth Server Actions作成

**ファイル**: `apps/web/lib/actions/auth.ts`

```typescript
'use server'

import { redirect } from 'next/navigation'

import { getToken, removeToken, saveToken } from '../auth'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'

export async function handleAuthCallback(token: string) {
  if (!token) {
    redirect('/login?error=no_token')
  }

  await saveToken(token)
  redirect('/')
}

export async function logout() {
  await removeToken()
  redirect('/login')
}

export async function getCurrentUser() {
  const token = await getToken()

  if (!token) {
    return null
  }

  try {
    const response = await fetch(`${API_URL}/api/auth/me`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      await removeToken()
      return null
    }

    return response.json()
  } catch {
    await removeToken()
    return null
  }
}
```

#### 6-3. Lottieライブラリのインストール

```bash
cd apps/web
pnpm add lottie-react
```

---

## Step 7: Web - ページ実装

### 目的
ログイン画面、コールバック画面、ホーム画面を実装する。

### 実装箇所
- `apps/web/app/(auth)/login/page.tsx`
- `apps/web/app/auth/callback/page.tsx`
- `apps/web/app/page.tsx`
- `apps/web/middleware.ts`

### 実装手順

#### 7-1. ログイン画面

**ファイル**: `apps/web/app/(auth)/login/page.tsx`

```typescript
'use client'

import { useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'

// Lottieを動的インポート（SSR無効化）
const Lottie = dynamic(() => import('lottie-react'), { ssr: false })

export default function LoginPage() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')

  const handleGoogleLogin = () => {
    window.location.href = `${API_URL}/api/auth/google`
  }

  // 仮のアニメーションデータ
  // TODO: 実際のトレちゃんアニメーションに置き換える
  const animationData = {
    assets: [],
    ddd: 0,
    fr: 30,
    h: 500,
    ip: 0,
    layers: [],
    nm: 'Sample',
    op: 60,
    v: '5.7.4',
    w: 500,
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100">
      <div className="w-full max-w-6xl px-4">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-12">
          {/* 左側: ログインフォーム */}
          <div className="flex flex-col justify-center space-y-8">
            <div className="text-center md:text-left">
              <h1 className="text-5xl font-bold text-blue-600">AI Trainer</h1>
              <p className="mt-4 text-lg text-gray-700">
                目標達成をサポートするあなたの相棒
              </p>
            </div>

            <div className="space-y-4">
              {error && (
                <div className="rounded-lg bg-red-50 p-4 ring-1 ring-red-200">
                  <p className="text-sm text-red-800">
                    {error === 'auth_failed'
                      ? '認証に失敗しました。もう一度お試しください。'
                      : 'エラーが発生しました。'}
                  </p>
                </div>
              )}

              <button
                className="flex w-full items-center justify-center gap-3 rounded-lg bg-white px-6 py-4 text-base font-semibold text-gray-900 shadow-lg ring-1 ring-gray-300 transition-all hover:bg-gray-50 hover:shadow-xl"
                onClick={handleGoogleLogin}
                type="button"
              >
                <svg className="h-6 w-6" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                Googleでログイン
              </button>

              <p className="text-center text-sm text-gray-600">
                ログインすることで、
                <a className="text-blue-600 hover:underline" href="/terms">
                  利用規約
                </a>
                と
                <a className="text-blue-600 hover:underline" href="/privacy">
                  プライバシーポリシー
                </a>
                に同意したことになります。
              </p>
            </div>
          </div>

          {/* 右側: Lottieアニメーション（PCのみ表示） */}
          <div className="hidden items-center justify-center md:flex">
            <div className="w-full max-w-md">
              <Lottie animationData={animationData} loop={true} style={{ height: 'auto', width: '100%' }} />
              <p className="mt-4 text-center text-gray-600">
                トレちゃんがあなたの目標達成をサポート！
              </p>
            </div>
          </div>

          {/* モバイル: アニメーションを上部に表示 */}
          <div className="flex items-center justify-center md:hidden">
            <div className="w-full max-w-xs">
              <Lottie animationData={animationData} loop={true} style={{ height: 'auto', width: '100%' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
```

#### 7-2. OAuth コールバック画面

**ファイル**: `apps/web/app/auth/callback/page.tsx`

```typescript
'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'

import { handleAuthCallback } from '@/lib/actions/auth'

export default function AuthCallbackPage() {
  const searchParams = useSearchParams()

  useEffect(() => {
    const token = searchParams.get('token')

    if (token) {
      handleAuthCallback(token)
    }
  }, [searchParams])

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100">
      <div className="text-center">
        <div className="mb-4 inline-block h-12 w-12 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
        <p className="text-lg text-gray-700">ログイン中...</p>
      </div>
    </div>
  )
}
```

#### 7-3. ホーム画面

**ファイル**: `apps/web/app/page.tsx`

```typescript
import { redirect } from 'next/navigation'

import { getCurrentUser, logout } from '@/lib/actions/auth'

export default async function HomePage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100">
      <header className="bg-white shadow-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-6 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-blue-600">AI Trainer</h1>
          <form action={logout}>
            <button
              className="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white shadow-md transition-all hover:bg-red-600 hover:shadow-lg sm:text-base"
              type="submit"
            >
              ログアウト
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-lg bg-white p-6 shadow-lg">
          <h2 className="mb-4 text-2xl font-bold text-gray-900">プロフィール</h2>
          <div className="space-y-3">
            <p className="text-gray-700">
              <span className="font-semibold">名前:</span> {user.name}
            </p>
            <p className="text-gray-700">
              <span className="font-semibold">メールアドレス:</span> {user.email}
            </p>
            {user.avatar_url && (
              <div>
                <span className="font-semibold text-gray-700">アイコン:</span>
                <img
                  alt={user.name}
                  className="mt-2 h-16 w-16 rounded-full shadow-md"
                  src={user.avatar_url}
                />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
```

#### 7-4. ミドルウェア（認証チェック）

**ファイル**: `apps/web/middleware.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const token = request.cookies.get('ai_trainer_token')

  // ログインページへのアクセス時、既にログイン済みならホームへ
  if (request.nextUrl.pathname.startsWith('/login')) {
    if (token) {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  // 保護されたパス（ホーム画面）へのアクセス時、未ログインならログインページへ
  if (request.nextUrl.pathname === '/') {
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/', '/login'],
}
```

#### 7-5. 環境変数設定

**ファイル**: `apps/web/.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:8080
```

### 動作確認

```bash
# Webアプリ起動
cd apps/web
pnpm dev

# ブラウザで http://localhost:3000 にアクセス
# 1. 未ログインの場合、自動的に /login へリダイレクト
# 2. 「Googleでログイン」ボタンをクリック
# 3. Google認証画面で認証
# 4. ホーム画面にリダイレクトされ、ユーザー情報が表示される
```

**確認項目**:
- ✅ ログイン画面が表示される
- ✅ **PC表示（768px以上）**: 左にログインフォーム、右にLottieアニメーションが表示される
- ✅ **モバイル表示（768px未満）**: 上部にアニメーション、下部にログインフォームが縦並びで表示される
- ✅ メインカラーが青（`text-blue-600`、`from-blue-50 to-blue-100`）である
- ✅ Googleボタンをクリックすると認証画面へ遷移
- ✅ 認証後、cookiesにトークンが保存される
- ✅ ホーム画面（`/`）にリダイレクトされ、ユーザー情報が表示される
- ✅ ログアウトボタンでログアウトできる
- ✅ レスポンシブデザインが適切に動作する

---

## ✅ 完了チェックリスト

すべてのステップが完了したら、以下を確認してください：

### データベース
- [ ] `users` テーブルが作成されている
- [ ] `accounts` テーブルが作成されている（複数プロバイダー対応）
- [ ] `characters` テーブルが作成されている
- [ ] `user_characters` テーブルが作成されている
- [ ] `CharacterCode` Enumが作成されている
- [ ] インデックスが正しく設定されている
- [ ] マイグレーションが正常に実行されている
- [ ] シードデータ（トレちゃん、マスターのマスターデータ）が投入されている

### API（アーキテクチャ）
- [ ] Repository層が実装されている（`repository/mysql/user.ts`, `account.ts`, `user-character.ts`）
- [ ] Client層が実装されている（`client/google-oauth.ts`）
- [ ] Service層が実装されている（`service/auth.ts`）
- [ ] Controller層が実装されている（`controller/auth/`）
- [ ] Route層が実装されている（`route/auth-route.ts`）
- [ ] `index.ts`でDIが正しく行われている（`AccountRepository`を含む）
- [ ] Middlewareが分離されている（`middleware/auth.ts`, `error-handler.ts`）

### API（機能）
- [ ] Google OAuthログインが動作する
- [ ] JWTトークンが正常に発行される
- [ ] `/api/auth/me` でユーザー情報を取得できる
- [ ] 認証ミドルウェアが機能している
- [ ] 新規ユーザー作成時に`accounts`テーブルにレコードが作成される
- [ ] 既存ユーザーログイン時に正しくユーザーが取得される

### Web（アーキテクチャ）
- [ ] Server Actionsを使っている（`lib/actions/auth.ts`）
- [ ] cookiesベースのセッション管理ができている（`lib/auth.ts`）
- [ ] Route Groupsを使っている（`app/(auth)/login/`）
- [ ] middlewareで認証チェックができている

### Web（機能）
- [ ] ログイン画面からGoogleログインできる
- [ ] 認証後、cookiesにトークンが保存される
- [ ] ホーム画面でユーザー情報が表示される（Server Componentで取得）
- [ ] ログアウトボタンでログアウトできる
- [ ] 未認証時、自動的にログイン画面へリダイレクトされる

### デザイン・レスポンシブ
- [ ] メインカラーが青（`blue-500`、`blue-600`）である
- [ ] 全ページでレスポンシブ対応されている
- [ ] ログイン画面がPC/モバイルで適切なレイアウトになっている
  - [ ] PC: 左にフォーム、右にLottieアニメーション
  - [ ] モバイル: 縦並びレイアウト
- [ ] Lottieアニメーションが正しく表示される
- [ ] モバイル表示（768px未満）で正しくレイアウトが変わる

### コーディング規約
- [ ] セミコロンなし
- [ ] シングルクォート使用
- [ ] インポート順序が正しい（builtin → external → @repo → relative）
- [ ] オブジェクトキーがアルファベット順
- [ ] ESLintエラーがない

---

## 📝 補足: アーキテクチャ参照

### API Server アーキテクチャ
- 参照: `apps/api/README.md`
- 層の分離: Controller → Service → Repository/Client
- DI: `index.ts`でまとめて初期化
- Interfaceと実装を同じファイルに書く

### Web Application アーキテクチャ
- 参照: `apps/web/README.md`
- Server Actionsを使う（フォーム送信、ページ内完結の処理）
- API Route Handlersは外部公開APIやWebhookのみ
- cookiesベースのセッション管理（`'use server'`でserver-only）
