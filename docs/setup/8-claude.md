# Claude Codeのセットアップ

## 目次

1. [claudeセットアップ](#claudeセットアップ)
2. [MCPサーバーの設定](#mcpサーバーの設定)
3. [Agentsの設定](#agentsの設定)
4. [Skillsの設定](#skillsの設定)
5. [Hooksの設定](#hooksの設定)
6. [AIと開発するサンプル](#aiと開発するサンプル)
7. [Tips](#tips)

---

## claudeセットアップ

`CLAUDE.md`ファイルを生成します。

```bash
# claude cliを起動
claude

# CLAUDE.mdを作成
/init

# .claudeディレクトリを作成
mkdir -p .claude
```

### CLAUDE.mdファイル

CLAUDE.mdは、Claude Codeがプロジェクトの規約やルールを学習するためのファイルです。

**配置場所:**

* `./CLAUDE.md` （プロジェクトルート）
* `./.claude/CLAUDE.md` （.claudeディレクトリ内）

**役割:**

* コーディング規約や命名規則を定義
* プロジェクト固有のコマンドやワークフローを記述
* アーキテクチャや設計方針を共有

**モジュール化:**

大規模プロジェクトでは、CLAUDE.mdを分割できます。

```markdown
# Main CLAUDE.md

@docs/coding-standards.md
@docs/api-guidelines.md
@docs/testing-guide.md
```

**解説:**

* `@path/to/file.md`構文で外部ファイルをインポート
* ドキュメントを整理しやすくなる
* Claude Codeは自動的にインポートファイルを読み込む
* プロジェクトタイプ別の規約を分離して管理可能

---

## MCPサーバーの設定

MCP（Model Context Protocol）は、Claude Codeと外部ツールを連携させるための仕組みです。

### 1. .mcp.jsonの作成

```bash
touch .mcp.json
```

### 2. .mcp.jsonに追記

```json
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": [
        "-y",
        "@upstash/context7-mcp"
      ]
    },
    "aws-knowledge-mcp-server": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://knowledge-mcp.global.api.aws"
      ]
    },
    "github": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-github"
      ],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "${env:GITHUB_PAT}"
      }
    },
    "playwright": {
      "command": "npx",
      "args": [
        "@playwright/mcp@latest"
      ]
    },
    "serena": {
      "command": "uvx",
      "args": [
        "--from",
        "git+https://github.com/oraios/serena",
        "serena",
        "start-mcp-server",
        "--context",
        "ide-assistant"
      ]
    }
  }
}
```

**解説:**

* **context7**: ライブラリドキュメント検索機能を提供
* **aws-knowledge-mcp-server**: AWSドキュメント検索機能を提供
* **github**: GitHub APIへのアクセス（PR作成、Issue管理など）
* **playwright**: ブラウザ自動化機能を提供
* **serena**: IDEアシスタント機能を提供。コードベースの理解と操作を支援
* 環境変数は`${env:VAR_NAME}`形式で参照可能

### 3. mcpサーバーと接続

以下のコマンドでconnectedになればOKです。

```bash
export GITHUB_PAT=your-github-appc
claude --mcp-config=.mcp.json
```

### MCPサーバーのスコープ

MCPサーバーは以下の3つのスコープで設定できます。

**優先順位**: Local > Project > User

| スコープ | ファイルパス | 説明 |
|---------|-------------|------|
| **User** | `~/.claude/.mcp.json` | 全プロジェクトで使用可能 |
| **Project** | `./.mcp.json` | プロジェクト内で共有（バージョン管理） |
| **Local** | `./.claude/.mcp.local.json` | プロジェクト内の個人設定（gitignore） |

---

## Hooksの設定

Hooksは、Claude Codeのツール実行前後に自動で処理を実行する仕組みです。

### 1. Hooksとは

Hooksは、Claude Codeのライフサイクルイベントで自動実行されるシェルコマンドです。

**主なHookイベント:**

| イベント | トリガータイミング |
|---------|------------------|
| **PreToolUse** | ツール処理の前（allow/deny/ask可能） |
| **PostToolUse** | ツール正常完了後 |
| **PermissionRequest** | 権限ダイアログ表示時 |
| **SessionStart** | セッション開始時 |
| **SessionEnd** | セッション終了時 |
| **UserPromptSubmit** | ユーザー入力処理前 |
| **Notification** | システム通知時 |
| **Stop** | タスク停止時 |

### 2. /hooksコマンドで登録する方法

Claude Code内で`/hooks`コマンドを使用して、対話的にHooksを登録できます。

**手順:**

1. Claude Codeを起動
2. `/hooks`コマンドを実行
3. プロンプトに従って設定を入力

**例: タスク完了時に音を鳴らす設定**

```
> /hooks

Claude Code: どのイベントにHookを追加しますか？
> Stop

Claude Code: コマンドを入力してください
> /usr/bin/afplay /System/Library/Sounds/Funk.aiff
```

これで`.claude/settings.json`に自動的に設定が追加されます。

### 3. タスク完了時に音を鳴らす設定

**設定内容:**

タスクが停止（完了）した際に、システムサウンドを再生します。

**設定ファイル:**

`.claude/settings.json`に以下の設定が追加されます：

```json
{
  "hooks": {
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "/usr/bin/afplay /System/Library/Sounds/Funk.aiff"
          }
        ]
      }
    ]
  }
}
```

**解説:**

* **`Stop`**: タスク停止時に実行されるイベント
* **`/usr/bin/afplay`**: macOSの音声再生コマンド（フルパス指定）
* **`/System/Library/Sounds/Funk.aiff`**: 再生するサウンドファイルのパス

**主要な設定項目:**

| 項目 | 説明 |
|------|------|
| `hooks` | Hooks設定のルートオブジェクト |
| `イベント名` | Hookイベント（`Stop`, `PostToolUse`など） |
| `matcher` | マッチ条件（空文字列`""`は全てにマッチ） |
| `type` | Hookタイプ（`command`または`prompt`） |
| `command` | 実行するシェルコマンド（フルパス推奨） |




## Agentsの設定

Agentsは、特定のタスクを自動化するための専門AIアシスタントです。

### 1. Agentsとは

Agentsは、Claude Codeが特定のタスクを委譲できる専門化されたAIアシスタントです。各エージェントは独立したコンテキストウィンドウを持ち、特定の目的に特化しています。

**Agentsの特徴:**

* 独立したコンテキストウィンドウ
* 特定のタスクに特化
* 再利用可能
* ツールアクセスの制限が可能

### 2. Agentsの登録

Claude Code内で`/agents`コマンドを使用して、対話的にAgentsを登録できます。

**手順:**

1. Claude Codeを起動
2. `/agents`コマンドを実行
3. プロンプトに従って設定を入力

**例: コードレビュー用Agentの作成**

```
> /agents

Claude Code: Agent名を入力してください
> code-reviewer

Claude Code: Agentの説明を入力してください
> コードの品質、セキュリティ、保守性をレビューします。コード変更時にPROACTIVEに使用してください。

Claude Code: 使用可能なツールを指定してください（カンマ区切り、空欄で全て）
> Read, Grep, Glob

Claude Code: 使用するモデルを指定してください（sonnet/opus/haiku、空欄でデフォルト）
> sonnet
```

これで`.claude/agents/code-reviewer.md`ファイルが自動的に作成されます。

### 3. Agentの実行方法

```bash
> code-reviewer agentを使って、最近変更したファイルをレビューしてください
```

---

## Skillsの設定

Skillsは、Claude Codeに特定の機能や知識を追加するモジュラーな仕組みです。

### 1. SkillsとAgentsの違い

| 特徴 | Skills | Agents |
|------|--------|--------|
| **起動方法** | Claudeが自動判断 | 明示的な委譲または自動 |
| **スコープ** | 特定の機能・知識 | 広範な自律システム |
| **コンテキスト** | メイン会話内 | 独立したコンテキスト |
| **目的** | 専門知識の提供 | 完全な専門ワークフロー |

**解説:**

* Skillsは構成要素、Agentsが利用する可能性がある
* Skillsは自動的に発見され、関連するタスクで使用される

### 2. Skillsディレクトリの作成

```bash
mkdir -p .claude/skills
```

### 3. Skill設定ファイルの作成例

#### API統合支援Skill

`.claude/skills/api-integration-helper/SKILL.md`を作成:

```bash
mkdir -p .claude/skills/api-integration-helper
touch .claude/skills/api-integration-helper/SKILL.md
```

```markdown
---
name: api-integration-helper
description: REST APIとの統合を支援します。ボイラープレートコード生成、認証処理、エラーハンドリングに使用します。API統合、HTTPリクエスト、外部サービス連携に関連するタスクで使用してください。
allowed-tools: Read, Write, Grep, Glob, Bash
---

# API統合支援Skill

このスキルは、REST API統合のベストプラクティスに従った実装を支援します。

## 機能

* APIクライアントのボイラープレート生成
* 認証実装（OAuth、APIキー、JWT）
* 適切なエラーハンドリングとリトライ処理
* APIスキーマからTypeScript型を生成
* リクエスト・レスポンスインターセプターの設定

## テンプレート

`templates/` ディレクトリに以下を用意:

* `api-client.ts` - ベースAPIクライアントクラス
* `auth-handler.ts` - 認証パターン
* `error-handler.ts` - エラーハンドリングユーティリティ

## 使用方法

APIとの統合時に以下を提供してください:

1. APIドキュメントURLまたはOpenAPIスペック
2. 認証方法
3. 呼び出すエンドポイント

本番環境対応のクライアントコードと型を生成します。
```

#### データベーススキーマ管理Skill

`.claude/skills/database-schema-helper/SKILL.md`を作成:

```bash
mkdir -p .claude/skills/database-schema-helper
touch .claude/skills/database-schema-helper/SKILL.md
```

```markdown
---
name: database-schema-helper
description: データベーススキーマの設計と管理を支援します。Prisma、TypeORM、マイグレーションスクリプト作成に使用します。データベース関連のタスクで使用してください。
allowed-tools: Read, Write, Grep, Glob
---

# データベーススキーマ管理Skill

このスキルは、データベーススキーマの設計と管理を支援します。

## 機能

* データベーススキーマ設計のベストプラクティス
* Prismaスキーマの生成と更新
* マイグレーションスクリプトの作成
* インデックス戦略の提案
* リレーション設計のサポート

## 対応ORM

* Prisma
* TypeORM
* Sequelize

## 使用方法

データベーススキーマ作成時に以下を提供してください:

1. エンティティの要件
2. リレーションの定義
3. 使用するORM

最適化されたスキーマ定義を生成します。
```

### 4. Skillディレクトリ構造

```
.claude/skills/my-skill/
├── SKILL.md           # 必須: スキル定義
├── reference.md       # オプション: 詳細ドキュメント
├── examples.md        # オプション: 使用例
├── scripts/          # オプション: ユーティリティスクリプト
│   └── helper.sh
└── templates/        # オプション: ファイルテンプレート
    └── config.json
```

### 5. SKILL.mdの必須フィールド

```yaml
---
name: skill-name                          # 必須: スキル名（小文字、数字、ハイフン）
description: スキルの説明と使用タイミング  # 必須: 機能と起動条件
allowed-tools: Read, Write, Grep          # オプション: ツール制限
---
```

**解説:**

* `description`フィールドが発見の鍵
* 具体的な使用例と起動キーワードを含める
* Claude Codeは自動的に関連性を判断

### 6. Skillsの発見とテスト

#### 利用可能なSkillsの確認

```bash
# Claude Code内で質問
> 利用可能なスキルは何ですか？

# または、ファイルシステムで確認
ls ~/.claude/skills/
ls .claude/skills/
```

#### テスト

スキルの`description`に一致する質問をして、起動を確認します。

```bash
> REST APIクライアントを作成してください
# → api-integration-helper スキルが起動
```

---

