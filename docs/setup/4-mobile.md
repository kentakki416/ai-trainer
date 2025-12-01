# ネイティブアプリケーションのセットアップ (apps/mobile)

## 目次

1. [プロジェクトの作成](#プロジェクトの作成)
2. [環境変数の設定](#環境変数の設定)
3. [ESLint設定](#eslint設定)
4. [開発サーバーの起動](#開発サーバーの起動)

---

## プロジェクトの作成

1. apps/mobileディレクトリでReact Nativeプロジェクトを作成
    ```bash
    cd apps
    pnpm dlx create-expo-app@latest mobile
    ```

## 環境変数の設定

1. .env.exampleを作成
    ```bash
    cd apps/mobile
    touch .env.example
    ```

2. 環境変数を記述
    ```env
    # API接続先
    EXPO_PUBLIC_API_URL=http://localhost:8080
    ```
    ＜解説＞
    * `EXPO_PUBLIC_`: アプリ内で利用可能な環境変数

3. .env.localにコピー
    ```bash
    cp .env.example .env.local
    ```

## ESLint設定

1. 追加パッケージをインストール
    ```bash
    cd apps/mobile
    pnpm add -D @typescript-eslint/eslint-plugin @typescript-eslint/parser eslint-plugin-import eslint-import-resolver-typescript eslint-plugin-tailwindcss tailwindcss@^3.4.0
    ```
    ＜解説＞
    * `@typescript-eslint/eslint-plugin`: TypeScript用ESLintルール
    * `@typescript-eslint/parser`: TypeScriptパーサー（型情報を有効にするために必要）
    * `eslint-plugin-import`: import文の順序とグループ化
    * `eslint-import-resolver-typescript`: TypeScriptのパスエイリアスを解決
    * `eslint-plugin-tailwindcss`: Tailwind CSSクラス名の検証（NativeWindを使用する場合）
    * `tailwindcss@^3.4.0`: Tailwind CSS v3（eslint-plugin-tailwindcss が v4 に対応していないため）

2. eslint.config.jsを更新
    ```javascript
    // https://docs.expo.dev/guides/using-eslint/
    const { defineConfig } = require('eslint/config')
    const expoConfig = require('eslint-config-expo/flat')
    const tailwindcss = require('eslint-plugin-tailwindcss')
    const typescriptParser = require('@typescript-eslint/parser')
    const typescriptEslint = require('@typescript-eslint/eslint-plugin')

    module.exports = defineConfig([
      expoConfig,
      {
        files: ['**/*.ts', '**/*.tsx'],
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
          'tailwindcss': tailwindcss,
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
          'no-console': ['warn', { allow: ['warn', 'error'] }],  // console.log は警告、warn/error は許可
          
          // 未使用変数（Expoデフォルトで有効なのでスキップ）
          
          // === コードスタイル ===
          'object-curly-spacing': ['error', 'always'],  // { foo } のようにスペースを入れる
          'semi': ['error', 'never'],                   // セミコロンを禁止
          'quotes': ['error', 'single'],                 // シングルクォートを強制
          
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
          
          // === React: JSX Props順序 ===
          'react/jsx-sort-props': ['error', {
            callbacksLast: true,     // コールバックを最後に
            shorthandFirst: true,    // shorthandを最初に
            ignoreCase: true,        // 大文字小文字を区別しない
            reservedFirst: true,     // 予約語を最初に
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
              filter: {
                regex: '^unstable_',  // Expo Routerのunstable_で始まる変数は除外
                match: false,
              },
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
          
          // === Tailwind CSS (NativeWindを使用する場合) ===
          'tailwindcss/classnames-order': 'error',      // クラス名をアルファベット順に
          'tailwindcss/no-custom-classname': 'error',   // 存在しないクラス名をエラー
        },
      },
      {
        ignores: ['dist/*'],
      },
    ])
    ```
    ＜解説＞
    **コードスタイル:**
    * `object-curly-spacing`: `{ }` 内にスペースを入れる
    * `semi`: セミコロンを使用しない
    * `quotes`: シングルクォート `'` を強制（ダブルクォート `"` を禁止）
    
    **プラグイン:**
    * `eslint-config-expo`が既に`import`プラグインを含んでいるため、プラグインの再定義は不要
    * `import/order`ルールを使用するために、`eslint-plugin-import`と`eslint-import-resolver-typescript`をインストールする必要があります
    
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
    * **Note**: これらのルールは`parserOptions.project: './tsconfig.json'`を設定することで型情報を利用できます
    
    **コード品質:**
    * `eqeqeq`: === と !== を強制（== と != を禁止）
    * `no-var`: var禁止（const/letを使用）
    * `prefer-const`: 再代入しない変数はconstにする
    * `prefer-template`: テンプレートリテラル優先
    * `prefer-arrow-callback`: アロー関数優先
    * `no-unneeded-ternary`: 不要な三項演算子を禁止
    
    **Tailwind CSS:**
    * `tailwindcss/classnames-order`: Tailwind CSSクラス名をアルファベット順に並び替え
    * `tailwindcss/no-custom-classname`: 存在しないTailwind CSSクラス名をエラー

3. Lintを実行
    ```bash
    pnpm run lint
    ```

4. Lint自動修正を実行
    ```bash
    pnpm run lint:fix
    ```
    ＜解説＞
    * セミコロン、クォート、import順序など、自動修正可能なエラーを一括修正

## 開発サーバーの起動

1. 個別に起動する場合
    ```bash
    cd apps/mobile
    pnpm run start
    ```
    ＜解説＞
    * Expo Dev Serverが起動します
    * QRコードが表示されます

2. Turborepoから起動する場合
    ```bash
    # プロジェクトルートで
    pnpm run dev
    ```
    ＜解説＞
    * 全てのアプリケーション（web、api、mobile など）が同時に起動

3. 動作確認

    **iOSシミュレーターで起動（Macのみ）**
    ```bash
    # Expo Dev Serverが起動している状態で
    # ターミナルで "i" を押す
    # または
    pnpm run ios
    ```

    **Androidエミュレーターで起動**
    ```bash
    # Expo Dev Serverが起動している状態で
    # ターミナルで "a" を押す
    # または
    pnpm run android
    ```

## ビルド（オプション）

1. EAS Build の設定（初回のみ）
    ```bash
    cd apps/mobile
    pnpm add -D eas-cli
    npx eas build:configure
    ```

2. 開発用ビルド
    ```bash
    # iOS
    npx eas build --profile development --platform ios

    # Android
    npx eas build --profile development --platform android
    ```
    ＜解説＞
    * EAS（Expo Application Services）を使用
    * Expoアカウントが必要です
    * 本番ビルドは別途設定が必要

