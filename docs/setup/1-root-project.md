# ルートプロジェクトのセットアップ

## 目次

1. [プロジェクトの開始方法](#プロジェクトの開始方法)
2. [pnpm workspaceの設定](#pnpm-workspaceの設定)
3. [Turborepoの設定](#turborepoの設定)
4. [package.jsonの設定](#packagejsonの設定)
5. [.gitignoreの設定](#gitignoreの設定)

---

## プロジェクトの開始方法

1. packge.jsonの用意
    ```bash
    npm init -y
    ```
2. pnpmによるnode_moduelsの構築
    ```bash
    pnpm install
    ```

3. Turborepoのインストール
    ```bash
    pnpm add -D turbo
    ```
4. ディレクトリの作成
    ```bash
    mkdir -p apps packages
    ```

## pnpm workspaceの設定
1. pnpm-workspace.yamlを作成
    ```bash
    touch pnpm-workspace.yaml
    ```
2. workspaceの設定を記述
    ```yaml
    packages:
      - "apps/*"
      - "packages/*"
    ```
    ＜解説＞
    * apps配下のディレクトリとpackages配下のディレクトリをワークスペースとして設定

## Turborepoの設定

1. turbo.jsonを作成
    ```bash
    touch turbo.json
    ```
2. Turborepoの設定を記述
    ```json
    {
      "$schema": "https://turbo.build/schema.json",
      "globalDependencies": ["**/.env.*local"],
      "tasks": {
        "build": {
          "dependsOn": ["^build"],
          "outputs": [".next/**", "!.next/cache/**", "dist/**", "build/**"]
        },
        "start": {
          "dependsOn": ["build"],
          "cache": false,
          "persistent": true
        },
        "dev": {
          "cache": false,
          "persistent": true
        },
        "lint": {
          "dependsOn": ["^lint"]
        },
        "test": {
          "dependsOn": ["^build"]
        },
        "clean": {
          "cache": false
        }
      }
    }
    ```
    ＜解説＞
    * `$schema`: JSONスキーマのチェック（エディタでの補完・バリデーションを有効化）
    * `globalDependencies`: 指定したファイルが変更されると、全キャッシュを無効化
    * `tasks`: 各タスクを設定（Turbo 2.0以降、`pipeline`から`tasks`に変更）
      * `cache`: 実行結果をキャッシュするかどうか（デフォルト:true）
      * `persistent`: タスクが終了せずに永続的に実行され続ける（開発サーバーなど）
      * `dependsOn`:  タスクの依存関係を定義
        * `["^build"]`: 依存パッケージの同名タスクを先に実行（^付き）
        * `["build"]`: 同じパッケージ内のタスクを先に実行（^なし）
      * `outputs`: タスクの実行結果として生成されるファイル/ディレクトリを指定

## package.jsonの設定
1. scriptsとその他の設定を追加
    ```json
    {
      "name": "@cyberagent-npm/project-template",
      "version": "1.0.0",
      "private": true,
      "description": "Monorepo with Turborepo + pnpm",
      "scripts": {
        "dev": "turbo run dev",
        "build": "turbo run build",
        "start": "turbo run start",
        "lint": "turbo run lint",
        "test": "turbo run test"
      },
      "devDependencies": {
        "turbo": "^2.1.3"
      },
      "packageManager": "pnpm@9.0.0",
      "engines": {
        "node": ">=18.0.0",
        "pnpm": ">=9.0.0"
      }
    }
    ```
    ＜解説＞
    * `scripts`: Turborepoのコマンドを設定
      * `dev`: 開発サーバーを起動
      * `build`: プロジェクトをビルド
      * `start`: 本番環境でアプリケーションを起動（ビルド後）
      * `lint`: コードの静的解析
      * `test`: テストを実行
    * `devDependencies`: 開発時に必要なパッケージ（turbo）
    * `packageManager`: 使用するパッケージマネージャーとバージョン（必須）
    * `engines`: 必要なNode.jsとpnpmのバージョン

## .gitignoreの設定
1. .gitignoreを作成
    ```bash
    touch .gitignore
    ```
2. gitで管理しないファイルを指定
    ```gitignore
    # Dependencies
    node_modules/
    .pnp
    .pnp.js

    # Testing
    coverage/

    # Next.js
    .next/
    out/

    # Production
    dist/
    build/

    # Misc
    .DS_Store
    *.pem

    # Debug
    npm-debug.log*
    yarn-debug.log*
    yarn-error.log*
    pnpm-debug.log*

    # Local env files
    .env
    .env*.local

    # Turbo
    .turbo/

    # Vercel
    .vercel

    # Terraform
    *.tfstate
    *.tfstate.backup
    .terraform/
    .terraform.lock.hcl
    *.tfvars

    # IDE
    .vscode/
    .idea/
    *.swp
    *.swo
    *~

    # OS
    .DS_Store
    Thumbs.db
    ```
    ＜解説＞
    * `node_modules/`: pnpmでインストールした依存パッケージ
    * `.next/`, `dist/`, `build/`: ビルド成果物
    * `.turbo/`: Turborepoのキャッシュ
    * `.env*.local`: ローカル環境変数ファイル
    * `*.tfstate`: Terraformの状態ファイル
    * `.DS_Store`: macOSのシステムファイル
