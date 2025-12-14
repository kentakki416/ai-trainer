# ルートプロジェクトのセットアップ

## 目次

1. [プロジェクトの開始方法](#プロジェクトの開始方法)
2. [pnpm workspaceの設定](#pnpm-workspaceの設定)
3. [Turborepoの設定](#turborepoの設定)
4. [package.jsonの設定](#packagejsonの設定)
5. [.gitignoreの設定](#gitignoreの設定)
6. [Dockerの構築](#dockerの構築)

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

## Dockerの構築

1. docker-compose.yamlを作成
    ```bash
    touch docker-compose.yaml
    ```
2. PostgreSQLとRedisの設定を記述
    ```yaml
    version: '3.8'

    services:
      postgres:
        image: postgres:16-alpine
        container_name: project-template-postgres
        restart: unless-stopped
        environment:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: project_template_dev
          POSTGRES_INITDB_ARGS: '--encoding=UTF-8 --locale=C'
          TZ: Asia/Tokyo
        ports:
          - '5432:5432'
        volumes:
          - postgres_data:/var/lib/postgresql/data
          - ./docker/init:/docker-entrypoint-initdb.d
        healthcheck:
          test: ['CMD-SHELL', 'pg_isready -U postgres']
          interval: 10s
          timeout: 5s
          retries: 5
        networks:
          - app-network

      redis:
        image: redis:7-alpine
        container_name: project-template-redis
        restart: unless-stopped
        command: redis-server --appendonly yes
        ports:
          - '6379:6379'
        volumes:
          - redis_data:/data
        healthcheck:
          test: ['CMD', 'redis-cli', 'ping']
          interval: 10s
          timeout: 5s
          retries: 5
        networks:
          - app-network

    volumes:
      postgres_data:
        driver: local
      redis_data:
        driver: local

    networks:
      app-network:
        driver: bridge
    ```
    ＜解説＞
    * `postgres`: PostgreSQL 16データベース
      * `POSTGRES_DB`: データベース名
      * `volumes`: データの永続化とSQL初期化スクリプトのマウント
      * `healthcheck`: コンテナの健全性チェック
    * `redis`: Redisキャッシュサーバー
      * `command`: AOF永続化モードで起動
      * `volumes`: データの永続化
    * `networks`: サービス間通信用のネットワーク

3. .dockerignoreを作成
    ```bash
    touch .dockerignore
    ```
4. .dockerignoreに以下を追加    
    ```.dockerignore
    # Dependencies
    node_modules/
    .pnp
    .pnp.js

    # Testing
    coverage/

    # Build output
    .next/
    out/
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
    .env*.local
    secret

    # Turbo
    .turbo/

    # Git
    .git
    .gitignore

    # IDE
    .vscode/
    .idea/
    *.swp
    *.swo
    *~

    # Docker
    Dockerfile
    docker-compose*.yml
    .dockerignore

    # Documentation
    README.md
    docs/

    # CI/CD
    .github/
    .gitlab-ci.yml

    # Terraform
    packages/terraform/
    ```
5. .gitignoreにDocker関連の設定を追加
    ```gitignore
    ...
    
    # Docker
    docker-compose.override.yml
    *.log
    ```

6. Dockerコンテナの起動
    ```bash
    # コンテナを起動
    docker compose up -d

    # 状態を確認
    docker compose ps

    # 停止
    docker compose down
    ```