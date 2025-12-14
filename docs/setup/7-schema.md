# Schemaのセットアップ (packages/schema)

## 目次

1. [概要](#概要)
2. [プロジェクトの作成](#プロジェクトの作成)
3. [package.jsonの設定](#packagejsonの設定)
4. [TypeScript設定](#typescript設定)
5. [ESLint設定](#eslint設定)
6. [APIスキーマの定義](#apiスキーマの定義)
7. [各ワークスペースへのインストール](#各ワークスペースへのインストール)
8. [実装例: APIサーバーとWebアプリでのスキーマ使用](#実装例-apiサーバーとwebアプリでのスキーマ使用)

---

## 概要

`packages/schema`は、**複数のプロジェクト（web、admin、mobile、api）で共有するスキーマ**を定義するパッケージです。

### 目的

* 複数プロジェクト間で共有するスキーマを一元管理
* APIのリクエスト・レスポンスのスキーマを一元管理
* Zodを使用したランタイムバリデーション
* TypeScriptの型安全性を提供
* web、admin、mobile、apiで同じスキーマを共有

### 利点

* スキーマの重複定義を防ぐ
* フロントエンドとバックエンドでスキーマの不整合を防ぐ
* Zodによるランタイムバリデーションで実行時エラーを防ぐ
* TypeScriptの型推論でコード補完とエラー検出

### スキーマの配置方針

**`packages/schema`に配置するスキーマ:**
* 複数のプロジェクト（web、admin、mobile、api）で共有するスキーマ
* 例: APIリクエスト/レスポンス、フォームバリデーション、環境変数など

**`apps/api`内に配置するスキーマ:**
* API専用で、他のプロジェクトで使用しないスキーマ
* 例: データベーススキーマ（Prisma、TypeORMなど）、内部API用のスキーマなど

**判断基準:**
* 現在または将来的に複数のプロジェクトで使う → `packages/schema`
* API専用で、他のプロジェクトで使う予定がない → `apps/api`内

---

## プロジェクトの作成

### 1. packages/schemaディレクトリを作成

```bash
# プロジェクトルートから実行
mkdir -p packages/schema
cd packages/schema
```

### 2. package.jsonを初期化

```bash
pnpm init
```

---

## package.jsonの設定

### 1. package.jsonを編集

`package.json`を開いて、以下の内容に書き換えます。

```json
{
  "name": "@repo/api-schema",
  "version": "1.0.0",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "clean": "rm -rf dist",
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "dependencies": {
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "typescript": "^5.3.3"
  }
}
```

＜解説＞
* `name`: モノレポ内での参照名（@repo/api-schema）
* `main`: コンパイル後のエントリーポイント（dist/index.js）
* `types`: TypeScript型定義ファイルのエントリーポイント（dist/index.d.ts）
* `build`: TypeScriptをJavaScriptにコンパイル
* `dev`: ファイル変更を監視してコンパイル
* `clean`: ビルド成果物を削除

### 2. 必要なパッケージをインストール

```bash
# プロジェクトルートで実行（全ワークスペースの依存関係をインストール）
cd ../..
pnpm install
```

＜解説＞
* `zod`: スキーマバリデーションとTypeScript型生成ライブラリ
* `typescript`: TypeScriptコンパイラ
* `@types/node`: Node.jsの型定義
* プロジェクトルートで`pnpm install`を実行すると、全ワークスペースの依存関係がインストールされます

---

## TypeScript設定

### 1. packages/schemaディレクトリに移動

```bash
cd packages/schema
```

### 2. tsconfig.jsonを作成

`tsconfig.json`を作成して、以下の内容を記述します。

```json
{
  "compilerOptions": {
    // コンパイルターゲット: ES2020にコンパイル
    "target": "ES2020",
    // モジュールシステム: CommonJS（Node.js標準）
    "module": "commonjs",
    // 使用するライブラリ: ES2020の標準ライブラリ
    "lib": ["ES2020"],
    // 出力ディレクトリ: コンパイル後のファイル出力先
    "outDir": "./dist",
    // ソースコードのルートディレクトリ
    "rootDir": "./src",
    // 型定義ファイル（.d.ts）を生成
    "declaration": true,
    // 型定義ファイルのソースマップを生成
    "declarationMap": true,
    // デバッグ用のソースマップを生成
    "sourceMap": true,
    // 厳格な型チェックを有効化
    "strict": true,
    // ESモジュールとCommonJSの相互運用性を有効化
    "esModuleInterop": true,
    // ライブラリの型チェックをスキップ（ビルド時間短縮）
    "skipLibCheck": true,
    // ファイル名の大文字小文字の一貫性を強制
    "forceConsistentCasingInFileNames": true,
    // モジュール解決方法: Node.js方式
    "moduleResolution": "node",
    // JSONファイルをモジュールとしてインポート可能にする
    "resolveJsonModule": true
  },
  // コンパイル対象のファイル
  "include": ["src/**/*"],
  // コンパイル対象から除外するディレクトリ
  "exclude": ["node_modules", "dist"]
}
```

---

## ESLint設定

### 1. ESLint関連パッケージの追加

`package.json`の`devDependencies`に以下のパッケージを追加します。

```json
{
  "devDependencies": {
    "@types/node": "^20.10.0",
    "@typescript-eslint/eslint-plugin": "^8.18.2",
    "@typescript-eslint/parser": "^8.18.2",
    "eslint": "^9.17.0",
    "eslint-import-resolver-typescript": "^3.7.0",
    "eslint-plugin-import": "^2.31.0",
    "typescript": "^5.3.3"
  }
}
```

### 2. lintスクリプトの追加

`package.json`の`scripts`に以下を追加します。

```json
{
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "clean": "rm -rf dist",
    "lint": "eslint 'src/**/*.ts'",
    "lint:fix": "eslint 'src/**/*.ts' --fix",
    "test": "echo \"Error: no test specified\" && exit 1"
  }
}
```

### 3. eslint.config.jsを作成

`packages/schema/eslint.config.js`を作成して、以下の内容を記述します。

```javascript
const { defineConfig } = require('eslint/config')
const typescriptEslint = require('@typescript-eslint/eslint-plugin')
const typescriptParser = require('@typescript-eslint/parser')
const importPlugin = require('eslint-plugin-import')

module.exports = defineConfig([
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
        project: './tsconfig.json',
      },
    },
    plugins: {
      '@typescript-eslint': typescriptEslint,
      import: importPlugin,
    },
    settings: {
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: './tsconfig.json',
        },
      },
    },
    rules: {
      // === Console ===
      'no-console': ['warn', { allow: ['warn', 'error'] }], // console.log は警告、warn/error は許可

      // === 未使用変数 ===
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',  // _で始まる引数は除外
        varsIgnorePattern: '^_',  // _で始まる変数は除外
      }],

      // === コードスタイル ===
      'object-curly-spacing': ['error', 'always'],  // { foo } のようにスペースを入れる
      'semi': ['error', 'never'],                   // セミコロンを禁止
      'quotes': ['error', 'single'],                 // シングルクォートを強制
      'no-multiple-empty-lines': ['error', { max: 1, maxEOF: 0, maxBOF: 0 }], // 連続する空行は最大1行、ファイルの先頭/末尾は0行
      'padded-blocks': ['error', 'never'], // ブロックの開始/終了での空行を禁止
      'no-trailing-spaces': 'error', // 行末のスペースを禁止

      // === Import順序 ===
      'import/order': [
        'error',
        {
          groups: [
            'builtin',   // Node.jsの組み込みモジュール（例: fs, path）
            'external',  // 外部ライブラリ（node_modules）
            'internal',  // 内部モジュール（@repo/など）
            'parent',    // 親ディレクトリからのインポート
            'sibling',  // 同じディレクトリまたは兄弟ディレクトリからのインポート
            'index',    // カレントディレクトリのindexファイル
          ],
          'newlines-between': 'always', // グループ間に改行を挿入
          alphabetize: {
            order: 'asc', // 各グループ内でアルファベット順にソート
            caseInsensitive: true, // 大文字小文字を区別しない
          },
          pathGroups: [
            {
              pattern: '@repo/**',
              group: 'internal',
              position: 'before',
            },
          ],
          pathGroupsExcludedImportTypes: ['builtin'],
        },
      ],

      // === オブジェクトキーの順序 ===
      'sort-keys': ['error', 'asc', {
        caseSensitive: true,   // 大文字小文字を区別
        natural: false,        // 自然順ソートを無効化
        minKeys: 2,            // 2つ以上のキーがある場合のみ適用
      }],

      // === TypeScript: 型安全性 ===
      '@typescript-eslint/no-explicit-any': 'warn',                    // any型は警告
      '@typescript-eslint/no-empty-function': 'error',                 // 空の関数を禁止
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',     // 不要な型アサーションを禁止
      '@typescript-eslint/promise-function-async': 'warn',             // Promiseを返す関数はasyncに

      // === TypeScript: 命名規則 ===
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'variable',
          format: ['camelCase', 'UPPER_CASE', 'PascalCase'],  // 変数: camelCase, UPPER_CASE, PascalCase
        },
        {
          selector: 'function',
          format: ['camelCase', 'PascalCase'],                 // 関数: camelCase, PascalCase
        },
        {
          selector: 'typeLike',
          format: ['PascalCase'],                              // 型: PascalCase
        },
      ],

      // === コード品質: 比較と構文 ===
      'eqeqeq': ['error', 'always'],           // === と !== を強制（== と != を禁止）
      'no-return-await': 'error',              // 不要な return await を禁止
      'no-var': 'error',                       // var を禁止（const/let を使用）
      'prefer-const': 'error',                 // 再代入しない変数は const にする
      'prefer-template': 'error',              // 文字列結合ではなくテンプレートリテラルを使用
      'prefer-arrow-callback': 'error',        // コールバック関数はアロー関数にする
      'no-unneeded-ternary': 'error',          // 不要な三項演算子を禁止（例: x ? true : false → x）
    },
  },
  {
    ignores: ['node_modules/**', 'dist/**'],
  },
])
```

＜解説＞

**コードスタイル:**
* `object-curly-spacing`: `{ }` 内にスペースを入れる
* `semi`: セミコロンを使用しない
* `quotes`: シングルクォート `'` を強制（ダブルクォート `"` を禁止）
* `no-multiple-empty-lines`: 連続する空行は最大1行まで、ファイルの先頭/末尾は0行
* `padded-blocks`: ブロックの開始/終了での空行を禁止
* `no-trailing-spaces`: 行末のスペースを禁止

**Import順序:**
* `import/order`: import文をグループ化して順序を制御
  * 外部ライブラリ（`node_modules`）が最初
  * 自分のpackages（`@repo/**`）がその後に配置
  * グループ間に改行を自動挿入
  * 各グループ内でアルファベット順にソート

**TypeScript型安全性:**
* `@typescript-eslint/no-explicit-any`: any型の使用を警告
* `@typescript-eslint/no-empty-function`: 空の関数を禁止
* `@typescript-eslint/no-unnecessary-type-assertion`: 不要な型アサーションを禁止
* `@typescript-eslint/promise-function-async`: Promiseを返す関数はasyncにする
* `@typescript-eslint/naming-convention`: 命名規則（変数はcamelCase/UPPER_CASE/PascalCase、関数はcamelCase/PascalCase、型はPascalCase）

**コード品質:**
* `eqeqeq`: === と !== を強制（== と != を禁止）
* `no-var`: var禁止（const/letを使用）
* `prefer-const`: 再代入しない変数はconstにする
* `prefer-template`: テンプレートリテラル優先
* `prefer-arrow-callback`: アロー関数優先
* `no-unneeded-ternary`: 不要な三項演算子を禁止

### 4. パッケージをインストール

プロジェクトルートで`pnpm install`を実行します。

```bash
# プロジェクトルートに移動
cd ../..
pnpm install
```

### 5. Lintを実行

```bash
cd packages/schema
pnpm run lint
```

---

## APIスキーマの定義

### 1. ディレクトリ構成を作成

```bash
cd packages/schema/
mkdir -p src/api-schema
mkdir -p src/form-schema
mkdir -p src/env-schema
touch src/index.ts
touch src/api-schema/index.ts
touch src/api-schema/user.ts
```

＜解説＞
* `src/index.ts`: 全てのスキーマタイプをエクスポートするルートエントリーポイント
* `src/api-schema/index.ts`: APIスキーマ専用のエントリーポイント
* `src/api-schema/`: 個別のAPIスキーマファイル（`user.ts`など）を配置
* TypeScriptの設定（`rootDir: "./src"`）に合わせて、全てのソースコードを`src/`ディレクトリ内に配置

### 2. サンプルスキーマの定義

`src/api-schema/user.ts`を作成して、GET APIのスキーマを定義します。

```typescript
import { z } from 'zod'

// ===========================
// GET /api/user/:id
// ===========================

/**
 * ユーザー取得APIのリクエストスキーマ
 * GETリクエストのパスパラメータとして受け取る
 */
export const getUserRequestSchema = z.object({
  id: z.string().min(1, 'IDは必須です'),
})

/**
 * ユーザー取得APIのレスポンススキーマ
 */
export const getUserResponseSchema = z.object({
  id: z.string(),
  message: z.string(),
  timestamp: z.string(),
})

// TypeScript型を推論
export type GetUserRequest = z.infer<typeof getUserRequestSchema>
export type GetUserResponse = z.infer<typeof getUserResponseSchema>
```

＜解説＞
* `getUserRequestSchema`: リクエストのバリデーションスキーマ
  - `id`: 文字列で、最低1文字必要
* `getUserResponseSchema`: レスポンスのバリデーションスキーマ
  - `id`: リクエストで受け取ったIDをそのまま返す
  - `message`: メッセージ文字列
  - `timestamp`: タイムスタンプ文字列
* `z.infer<>`: ZodスキーマからTypeScript型を自動生成

### 3. APIスキーマのエントリーポイントを作成

`src/api-schema/index.ts`を作成して、APIスキーマをエクスポートします。

```typescript
// User schemas
export {
  getUserRequestSchema,
  getUserResponseSchema,
  type GetUserRequest,
  type GetUserResponse,
} from './user'

// 今後、他のAPIスキーマを追加する場合はここに追記
// export { ... } from './post'
// export { ... } from './comment'
```

＜解説＞
* `src/api-schema/index.ts`は、APIスキーマ専用のエントリーポイント
* 個別のスキーマファイル（`user.ts`など）をまとめてエクスポート

### 4. ルートエントリーポイントの作成

`src/index.ts`を作成して、全てのスキーマタイプをエクスポートします。

```typescript
// APIスキーマ
export * from './api-schema'

// 今後、他のスキーマを追加する場合はここに追記
// export * from './form-schema'
// export * from './env-schema'
```

＜解説＞
* `src/index.ts`が全てのスキーマのルートエントリーポイント
* 各スキーマタイプは独立したディレクトリ（`api-schema/`など）に配置
* ビルド後は`dist/index.js`が`package.json`の`main`フィールドで参照される
* 他のワークスペースは `@repo/api-schema` からインポート可能

### 5. ビルドを実行

```bash
pnpm run build
```

＜解説＞
* `dist/` ディレクトリにコンパイルされたファイルが生成される
* `dist/index.d.ts` に型定義ファイルが生成される

---

## 各ワークスペースへのインストール

プロジェクトルートに戻って、各ワークスペースに`@repo/api-schema`をインストールします。

```bash
# プロジェクトルートに移動
cd ../..

# apps/apiにインストール
cd apps/api
pnpm add @repo/api-schema --workspace

# apps/webにインストール
cd ../web
pnpm add @repo/api-schema --workspace

# apps/adminにインストール
cd ../admin
pnpm add @repo/api-schema --workspace

# apps/mobileにインストール
cd ../mobile
pnpm add @repo/api-schema --workspace

# プロジェクトルートに戻る
cd ../..
```

＜解説＞
* `--workspace`: モノレポ内のローカルパッケージとして追加
* 各ワークスペースの`package.json`に依存関係が追加される
* インストール後、各アプリケーションから`@repo/api-schema`をインポート可能

---

## 実装例: APIサーバーとWebアプリでのスキーマ使用

ここでは、定義した`userSchema`を実際に使用した通信の実装例を示します。

### 1. APIサーバー側の実装

`apps/api/src/index.ts`にユーザー取得APIのエンドポイントを追加します。

```typescript
import {
  getUserRequestSchema,
  getUserResponseSchema,
  type GetUserRequest,
  type GetUserResponse,
} from '@repo/api-schema'

// ユーザー取得API: GET /api/user/:id
app.get('/api/user/:id', (req: Request, res: Response) => {
  try {
    // リクエストパラメータをバリデーション
    // TypeScriptの型チェックを有効にするため、型推論された型を使用
    const requestData: GetUserRequest = {
      id: req.params.id,
    }
    const validatedRequest = getUserRequestSchema.parse(requestData)

    // 固定値のレスポンスデータを返す
    // TypeScriptの型チェックを有効にするため、型推論された型を使用
    const responseData: GetUserResponse = {
      id: validatedRequest.id,
      message: `ユーザーID ${validatedRequest.id} の情報を取得しました`,
      timestamp: new Date().toISOString(),
    }
    // バリデーションを実行（型チェック済みのデータを検証）
    const validatedResponse = getUserResponseSchema.parse(responseData)

    res.json(validatedResponse)
  } catch (error) {
    // バリデーションエラーの場合
    if (error instanceof Error) {
      res.status(400).json({
        error: 'バリデーションエラー',
        message: error.message,
      })
    } else {
      res.status(500).json({
        error: 'サーバーエラー',
        message: '予期しないエラーが発生しました',
      })
    }
  }
})

```

＜解説＞
* `GetUserRequest`と`GetUserResponse`型をインポートして、TypeScriptの型チェックを有効化
* `requestData: GetUserRequest`: リクエストデータに型を明示的に指定することで、コンパイル時に型エラーを検出
* `responseData: GetUserResponse`: レスポンスデータに型を明示的に指定することで、存在しないフィールドや型の不一致をコンパイル時に検出
* `getUserRequestSchema.parse()`: リクエストパラメータをランタイムバリデーションし、エラーの場合は例外をスロー
* `getUserResponseSchema.parse()`: レスポンスデータをランタイムバリデーションし、型安全性を確保
* バリデーションエラーは`catch`ブロックでキャッチして、適切なエラーレスポンスを返す
* 固定値のデータを返す例として、リクエストで受け取った`id`を使用してメッセージを生成

**型安全性の利点:**
* コンパイル時に型エラーを検出できる（例: 存在しないフィールド、型の不一致）
* IDEのコード補完が効く
* ランタイムバリデーションと型チェックの両方を活用できる

### 2. Webアプリ側の実装

`apps/web/app/page.tsx`を編集して、APIを呼び出す処理を追加します。

```typescript
'use client'

import { useEffect, useState } from 'react'
import { GetUserResponse } from '@repo/api-schema'

export default function Home() {
  const [userData, setUserData] = useState<GetUserResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // APIを呼び出す関数
  const fetchUser = async (userId: string) => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`http://localhost:8080/api/user/${userId}`)

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data: GetUserResponse = await response.json()
      setUserData(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ユーザー情報の取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  // コンポーネントマウント時にAPIを呼び出す（例: userId='123'）
  useEffect(() => {
    fetchUser('123')
  }, [])

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">
        <div className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left">
          <h1 className="max-w-xs text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
            ユーザー情報取得サンプル
          </h1>

          {loading && <p className="text-lg text-zinc-600 dark:text-zinc-400">読み込み中...</p>}

          {error && (
            <div className="rounded-lg bg-red-100 p-4 text-red-800 dark:bg-red-900 dark:text-red-200">
              <p className="font-semibold">エラー</p>
              <p>{error}</p>
            </div>
          )}

          {userData && (
            <div className="rounded-lg bg-zinc-100 p-6 dark:bg-zinc-800">
              <h2 className="mb-4 text-xl font-semibold text-black dark:text-zinc-50">
                ユーザー情報
              </h2>
              <div className="space-y-2 text-left">
                <p className="text-zinc-700 dark:text-zinc-300">
                  <span className="font-medium">ID:</span> {userData.id}
                </p>
                <p className="text-zinc-700 dark:text-zinc-300">
                  <span className="font-medium">メッセージ:</span> {userData.message}
                </p>
                <p className="text-zinc-700 dark:text-zinc-300">
                  <span className="font-medium">タイムスタンプ:</span> {userData.timestamp}
                </p>
              </div>
            </div>
          )}

          <button
            className="mt-4 rounded-lg bg-blue-600 px-6 py-3 text-white transition-colors hover:bg-blue-700"
            onClick={() => fetchUser('123')}
            type="button"
          >
            再取得
          </button>
        </div>
      </main>
    </div>
  )
}
```

＜解説＞
* `GetUserResponse`型を`@repo/api-schema`からインポートして、型安全性を確保
* `fetch`でAPIを呼び出し、レスポンスを`GetUserResponse`型として扱う
* エラーハンドリングとローディング状態の管理を実装
* TypeScriptの型推論により、`userData`のプロパティにアクセスする際にコード補完が効く

### 3. 動作確認

1. **アプリケーションの起動**
  ```bash
  ## ルートに移動
  pnpm run dev
  ```

2. **ブラウザで確認**
   * `http://localhost:3000`にアクセス
   * ユーザー情報が表示されることを確認
   * ブラウザの開発者ツールのネットワークタブで、APIリクエストとレスポンスを確認
