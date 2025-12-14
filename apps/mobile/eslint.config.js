// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config')
const expoConfig = require('eslint-config-expo/flat')
const tailwindcss = require('eslint-plugin-tailwindcss')

module.exports = defineConfig([
  expoConfig,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parserOptions: {
        ecmaVersion: 2020,
        project: './tsconfig.json',
        sourceType: 'module',
      },
    },
    plugins: {
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
      'no-multiple-empty-lines': ['error', { max: 1, maxBOF: 0, maxEOF: 0 }], // 連続する空行は最大1行、ファイルの先頭/末尾は0行
      'padded-blocks': ['error', 'never'],          // ブロックの開始/終了での空行を禁止
      'no-trailing-spaces': 'error',                // 行末のスペースを禁止
      
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
