# Webアプリケーションのセットアップ (apps/web)

## 目次

1. [プロジェクトの作成](#プロジェクトの作成)
2. [環境変数の設定](#環境変数の設定)
3. [ESLint設定](#eslint設定)
4. [開発サーバーの起動](#開発サーバーの起動)

---

## プロジェクトの作成

1. apps/webディレクトリでNext.jsプロジェクトを作成
    ```bash
    cd apps
    pnpm create next-app@latest web
    ```
    ＜解説＞
    * Next.jsの最新バージョンを使用します

2. 対話形式の質問に回答
    ```
   ✔ Would you like to use the recommended Next.js defaults? › Yes, use recommended defaults
    Creating a new Next.js app in /Users/s16865/workspace/local/product/project-template/apps/web.
    ```

## 環境変数の設定

1. .env.localを作成
    ```bash
    cd apps/web
    touch .env.example
    ```

2. 環境変数を記述
    ```env
    # API接続先
    NEXT_PUBLIC_API_URL=http://localhost:8080
    ```
    ＜解説＞
    * `NEXT_PUBLIC_`: ブラウザで利用可能な環境変数
3. .env.localにコピー
    ```bash
    cp .env.example .env.local
    ```

## ESLint設定

1. 追加パッケージをインストール
    ```bash
    cd apps/web
    pnpm add -D eslint-plugin-import eslint-import-resolver-typescript
    ```
    ＜解説＞
    * `eslint-plugin-import`: import文の順序とグループ化
    * `eslint-import-resolver-typescript`: TypeScriptのパスエイリアスを解決
    * ⚠️`eslint-plugin-tailwindcss`はTailwind CSS v4に対応していないため使用しない

2. eslint.config.mjsを編集
    Next.jsの最新バージョンでは、デフォルトで`eslint.config.mjs`（Flat Config形式）が使用されます。
    `eslint.config.mjs`を以下のように編集します：
    ```javascript
    import { defineConfig, globalIgnores } from "eslint/config";
    import nextVitals from "eslint-config-next/core-web-vitals";
    import nextTs from "eslint-config-next/typescript";

    const eslintConfig = defineConfig([
      ...nextVitals,
      ...nextTs,
      // Override default ignores of eslint-config-next.
      globalIgnores([
        // Default ignores of eslint-config-next:
        ".next/**",
        "out/**",
        "build/**",
        "next-env.d.ts",
      ]),
      {
        // TypeScriptファイルのみに型情報を適用
        files: ["**/*.ts", "**/*.tsx"],
        languageOptions: {
          parserOptions: {
            project: "./tsconfig.json",
          },
        },
        settings: {
          "import/resolver": {
            typescript: {
              alwaysTryTypes: true,
              project: "./tsconfig.json",
            },
          },
        },
        rules: {
          // === Console ===
          "no-console": ["warn", { allow: ["warn", "error"] }], // console.log は警告、warn/error は許可

          // === コードスタイル ===
          "object-curly-spacing": ["error", "always"], // { foo } のようにスペースを入れる
          "semi": ["error", "never"], // セミコロンを禁止
          "quotes": ["error", "single"], // シングルクォートを強制

          // === Import順序 ===
          "import/order": [
            "error",
            {
              groups: [
                "builtin", // Node.jsの組み込みモジュール（例: fs, path）
                "external", // 外部ライブラリ（node_modules）
                "internal", // 内部モジュール（@repo/など）
                "parent", // 親ディレクトリからのインポート
                "sibling", // 同じディレクトリまたは兄弟ディレクトリからのインポート
                "index", // カレントディレクトリのindexファイル
              ],
              "newlines-between": "always", // グループ間に改行を挿入
              alphabetize: {
                order: "asc", // 各グループ内でアルファベット順にソート
                caseInsensitive: true, // 大文字小文字を区別しない
              },
              pathGroups: [
                {
                  pattern: "@repo/**",
                  group: "internal",
                  position: "before",
                },
              ],
              pathGroupsExcludedImportTypes: ["builtin"],
            },
          ],

          // === オブジェクトキーの順序 ===
          "sort-keys": [
            "error",
            "asc",
            {
              caseSensitive: true, // 大文字小文字を区別
              natural: false, // 自然順ソートを無効化
              minKeys: 2, // 2つ以上のキーがある場合のみ適用
            },
          ],

          // === React: JSX Props順序 ===
          "react/jsx-sort-props": [
            "error",
            {
              callbacksLast: true, // コールバックを最後に
              shorthandFirst: true, // shorthandを最初に
              ignoreCase: true, // 大文字小文字を区別しない
              reservedFirst: true, // 予約語を最初に
            },
          ],

          // === TypeScript: 型安全性 ===
          "@typescript-eslint/no-explicit-any": "warn", // any型は警告
          "@typescript-eslint/no-empty-function": "error", // 空の関数を禁止
          "@typescript-eslint/no-unnecessary-type-assertion": "error", // 不要な型アサーションを禁止
          "@typescript-eslint/promise-function-async": "warn", // Promiseを返す関数はasyncに

          // === TypeScript: 命名規則 ===
          "@typescript-eslint/naming-convention": [
            "error",
            {
              selector: "variable",
              format: ["camelCase", "UPPER_CASE", "PascalCase"], // 変数: camelCase, UPPER_CASE, PascalCase
            },
            {
              selector: "function",
              format: ["camelCase", "PascalCase"], // 関数: camelCase, PascalCase
            },
            {
              selector: "typeLike",
              format: ["PascalCase"], // 型: PascalCase
            },
          ],

          // === コード品質: 比較と構文 ===
          "eqeqeq": ["error", "always"], // === と !== を強制（== と != を禁止）
          "no-return-await": "error", // 不要な return await を禁止
          "no-var": "error", // var を禁止（const/let を使用）
          "prefer-const": "error", // 再代入しない変数は const にする
          "prefer-template": "error", // 文字列結合ではなくテンプレートリテラルを使用
          "prefer-arrow-callback": "error", // コールバック関数はアロー関数にする
          "no-unneeded-ternary": "error", // 不要な三項演算子を禁止（例: x ? true : false → x）
        },
      },
    ]);

    export default eslintConfig;
    ```
    ＜解説＞
    **基本設定:**
    * Next.jsの最新バージョンでは、ESLintのFlat Config形式（`eslint.config.mjs`）がデフォルトで使用されます
    * `defineConfig`: ESLintの設定を定義するヘルパー関数
    * `nextVitals`と`nextTs`: Next.jsの推奨設定を継承
    * `globalIgnores`: 無視するファイルやディレクトリを指定
    
    **型情報の設定:**
    * `files: ["**/*.ts", "**/*.tsx"]`: TypeScriptファイルのみに型情報を適用
    * `languageOptions.parserOptions.project`: TypeScriptの型情報を利用するために必要
    * 型情報を必要とするルール（`no-unnecessary-type-assertion`、`promise-function-async`、`naming-convention`）が動作します
    * 設定ファイル（`*.config.mjs`、`*.config.js`）は`files`の対象外なので、型情報なしで通常のLintチェックが行われます
    
    **プラグイン:**
    * `eslint-config-next`が既に`import`プラグインを含んでいるため、プラグインの再定義は不要
    * `import/order`ルールを使用するために、`eslint-plugin-import`と`eslint-import-resolver-typescript`をインストールする必要があります
    
    **コードスタイル:**
    * `object-curly-spacing`: `{ }` 内にスペースを入れる
    * `semi`: セミコロンを使用しない
    * `quotes`: シングルクォート `'` を強制（ダブルクォート `"` を禁止）
    
    **Import順序:**
    * `import/order`: import文をグループ化して順序を制御
      * 外部ライブラリ（`node_modules`）が最初
      * 自分のpackages（`@repo/**`）がその後に配置
      * グループ間に改行を自動挿入
      * 各グループ内でアルファベット順にソート
    
    **React:**
    * `react/jsx-sort-props`: JSXのpropsをアルファベット順に（コールバックは最後、shorthandは最初）
    
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

3. package.jsonにlint:fixを追加
    ```json
    "scripts": {
      "dev": "next dev",
      "build": "next build",
      "start": "next start",
      "lint": "eslint",
      "lint:fix": "eslint --fix"
    }
    ```
4. Lintを実行
    ```bash
    pnpm run lint
    ```

## 開発サーバーの起動

1. 個別に起動する場合
    ```bash
    cd apps/web
    pnpm run dev
    ```
    ＜解説＞
    * デフォルトで `http://localhost:3000` で起動
    * ファイルを変更すると自動的に再読み込み

2. Turborepoから起動する場合
    ```bash
    # プロジェクトルートで
    pnpm run dev
    ```
    ＜解説＞
    * 全てのアプリケーション（web、api など）が同時に起動

3. 動作確認
    ```bash
    # ブラウザでアクセス
    open http://localhost:3000
    ```

## ビルドと本番起動

1. ビルドを実行
    ```bash
    cd apps/web
    pnpm run build
    ```

2. 本番環境で起動
    ```bash
    pnpm run start
    ```
