# Step 8: API - Logger の実装（構造化ロギング）

## 目的

JSON形式の構造化ログを実装し、API サーバーの動作状況、エラー、認証イベントなどを記録・監視できるようにします。本番環境での問題調査や、セキュリティ監査のためのログ基盤を構築します。

**改善点**:
- **完全な構造化ロギング**: JSON形式で出力し、ログ分析ツール（CloudWatch、Datadog等）との連携が容易
- **クラウドファースト設計**: stdout/stderr に出力し、クラウドサービス（CloudWatch Logs、Cloud Logging など）が自動収集
- **インターフェース駆動**: `ILogger`インターフェースにより、環境に応じて簡単にロガーを切り替え可能
- **3つの実装**: Winston（本番環境）、Pino（高速パフォーマンス）、Console（開発・テスト環境）

## 対応内容

### 必要なパッケージのインストール

```bash
cd apps/api
pnpm add winston pino pino-pretty
```

### アーキテクチャ

```
apps/api/log/
├── interface.ts           # ILogger インターフェース定義
├── winston-logger.ts      # Winston 実装（本番環境）
├── pino-logger.ts         # Pino 実装（高速パフォーマンス）
├── console-logger.ts      # Console 実装（開発・テスト環境）
├── logger-factory.ts      # Factory パターンでロガーを生成
└── index.ts              # エクスポートとヘルパー関数
```

### クラウド環境でのログ収集の仕組み

アプリケーションは **stdout/stderr に JSON 形式でログを出力**し、クラウドサービスが自動的に収集・管理します：

| 環境 | ログ収集先 | 収集方法 |
|------|-----------|---------|
| AWS ECS/Lambda | CloudWatch Logs | `awslogs` ログドライバーが自動収集 |
| GCP Cloud Run/GKE | Cloud Logging | stdout/stderr を自動収集 |
| Vercel Functions | Vercel Logs | stdout/stderr を自動収集 |
| Azure Container Instances | Azure Monitor Logs | stdout/stderr を自動収集 |

**利点**:
- ファイル I/O が不要（パフォーマンス向上）
- ローテーション・保持期間はクラウド側で管理
- ログの検索・分析がクラウドコンソールで可能
- サーバーレス環境（Lambda など）でも動作

### Logger Interface の定義

**ファイル**: `apps/api/log/interface.ts`

```typescript
/**
 * ログメタデータの型定義
 */
export type LogMetadata = Record<string, unknown>

/**
 * Logger interface
 * 構造化ロギングのための共通インターフェース
 */
export interface ILogger {
  /**
   * デバッグレベルのログ
   */
  debug(message: string, metadata?: LogMetadata): void

  /**
   * 情報レベルのログ
   */
  info(message: string, metadata?: LogMetadata): void

  /**
   * 警告レベルのログ
   */
  warn(message: string, metadata?: LogMetadata): void

  /**
   * エラーレベルのログ
   * Error オブジェクトを渡すと、スタックトレースも記録される
   */
  error(message: string, error?: Error, metadata?: LogMetadata): void
}
```

### Winston Logger の実装

**ファイル**: `apps/api/log/winston-logger.ts`

```typescript
import { createLogger, format, transports } from 'winston'

import type { ILogger, LogMetadata } from './interface'

const { combine, timestamp, errors, json, simple, colorize } = format

/**
 * Winston Logger
 * stdout/stderr に出力し、クラウドサービス（CloudWatch Logs など）が自動収集
 */
export class WinstonLogger implements ILogger {
  private logger: ReturnType<typeof createLogger>

  constructor() {
    const NODE_ENV = process.env.NODE_ENV || 'development'
    const logLevel = NODE_ENV === 'production' ? 'info' : 'debug'

    /**
     * 開発環境: 可読性の高いフォーマット
     * 本番環境: JSON 形式（CloudWatch Logs などで処理しやすい）
     */
    const consoleFormat =
      NODE_ENV === 'production'
        ? combine(errors({ stack: true }), timestamp(), json())
        : combine(errors({ stack: true }), timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), colorize(), simple())

    this.logger = createLogger({
      exitOnError: false,
      format: combine(errors({ stack: true }), timestamp()),
      level: logLevel,
      transports: [
        /**
         * Console 出力（stdout/stderr）
         * クラウド環境では自動的に収集される
         */
        new transports.Console({
          format: consoleFormat,
        }),
      ],
    })
  }

  debug(message: string, metadata?: LogMetadata): void {
    this.logger.debug(message, metadata)
  }

  info(message: string, metadata?: LogMetadata): void {
    this.logger.info(message, metadata)
  }

  warn(message: string, metadata?: LogMetadata): void {
    this.logger.warn(message, metadata)
  }

  error(message: string, error?: Error, metadata?: LogMetadata): void {
    if (error) {
      this.logger.error(message, {
        error: error.message,
        stack: error.stack,
        ...metadata,
      })
    } else {
      this.logger.error(message, metadata)
    }
  }
}
```

**実装のポイント**:

1. **stdout/stderr のみに出力**
   - ファイル出力なし（クラウドサービスが収集）
   - CloudWatch Logs、Cloud Logging などが自動的に収集・保存
   - ローテーション・保持期間はクラウド側で管理

2. **環境別フォーマット**
   - 開発環境: カラー表示 + シンプルフォーマット（可読性重視）
   - 本番環境: JSON 形式（ログ分析ツールで処理しやすい）

3. **Error オブジェクトの統合**
   - `error` メソッドで Error オブジェクトを受け取れる
   - スタックトレースも自動的に記録

### Pino Logger の実装

**ファイル**: `apps/api/log/pino-logger.ts`

```typescript
import pino from 'pino'

import type { ILogger, LogMetadata } from './interface'

/**
 * Pino Logger
 * stdout/stderr に出力し、クラウドサービス（CloudWatch Logs など）が自動収集
 */
export class PinoLogger implements ILogger {
  private logger: pino.Logger

  constructor() {
    const NODE_ENV = process.env.NODE_ENV || 'development'
    const logLevel = NODE_ENV === 'production' ? 'info' : 'debug'

    /**
     * 開発環境: pino-pretty で可読性向上
     * 本番環境: JSON 形式で stdout に出力
     */
    this.logger = pino(
      {
        base: {
          env: NODE_ENV,
        },
        level: logLevel,
        timestamp: pino.stdTimeFunctions.isoTime,
      },
      NODE_ENV === 'production'
        ? process.stdout
        : pino.transport({
            options: {
              colorize: true,
              ignore: 'pid,hostname',
              translateTime: 'yyyy-mm-dd HH:MM:ss',
            },
            target: 'pino-pretty',
          })
    )
  }

  debug(message: string, metadata?: LogMetadata): void {
    this.logger.debug(metadata || {}, message)
  }

  info(message: string, metadata?: LogMetadata): void {
    this.logger.info(metadata || {}, message)
  }

  warn(message: string, metadata?: LogMetadata): void {
    this.logger.warn(metadata || {}, message)
  }

  error(message: string, error?: Error, metadata?: LogMetadata): void {
    if (error) {
      this.logger.error(
        {
          err: {
            message: error.message,
            stack: error.stack,
          },
          ...metadata,
        },
        message
      )
    } else {
      this.logger.error(metadata || {}, message)
    }
  }
}
```

**実装のポイント**:

1. **高速パフォーマンス**
   - Winston より約5倍高速
   - 非同期ログ出力でメインスレッドをブロックしない
   - 大量のログを処理する場合に最適

2. **開発環境での可読性**
   - `pino-pretty` でカラー表示 + 整形
   - 開発時のデバッグが容易

3. **本番環境での効率性**
   - JSON 形式で stdout に出力
   - CloudWatch Logs などで処理しやすい

### Console Logger の実装

**ファイル**: `apps/api/log/console-logger.ts`

```typescript
import type { ILogger, LogMetadata } from './interface'

/**
 * Console Logger
 */
export class ConsoleLogger implements ILogger {
  private formatLog(level: string, message: string, metadata?: LogMetadata): string {
    const timestamp = new Date().toISOString()
    const baseLog = {
      level,
      message,
      timestamp,
    }

    if (metadata && Object.keys(metadata).length > 0) {
      return JSON.stringify({ ...baseLog, ...metadata })
    }

    return JSON.stringify(baseLog)
  }

  debug(message: string, metadata?: LogMetadata): void {
    console.log(this.formatLog('debug', message, metadata))
  }

  info(message: string, metadata?: LogMetadata): void {
    console.log(this.formatLog('info', message, metadata))
  }

  warn(message: string, metadata?: LogMetadata): void {
    console.warn(this.formatLog('warn', message, metadata))
  }

  error(message: string, error?: Error, metadata?: LogMetadata): void {
    if (error) {
      const errorMetadata = {
        error: error.message,
        stack: error.stack,
        ...metadata,
      }
      console.error(this.formatLog('error', message, errorMetadata))
    } else {
      console.error(this.formatLog('error', message, metadata))
    }
  }
}
```

**実装のポイント**:

- シンプルなコンソール出力
- JSON形式（他の実装と統一）
- テスト環境で使用すると高速実行

### Logger Factory の実装

**ファイル**: `apps/api/log/logger-factory.ts`

```typescript
import { ConsoleLogger } from './console-logger'
import type { ILogger } from './interface'
import { PinoLogger } from './pino-logger'
import { WinstonLogger } from './winston-logger'

/**
 * Logger の種類
 */
export type LoggerType = 'winston' | 'pino' | 'console'

/**
 * Logger Factory
 * 環境変数に基づいて適切な Logger インスタンスを生成
 */
export class LoggerFactory {
  private static instance: ILogger | null = null

  /**
   * Logger インスタンスを取得（シングルトン）
   */
  static getLogger(): ILogger {
    if (this.instance) {
      return this.instance
    }

    const loggerType = (process.env.LOGGER_TYPE || 'winston') as LoggerType

    this.instance = this.createLogger(loggerType)
    return this.instance
  }

  /**
   * Logger インスタンスを明示的に作成
   * テスト時などに使用
   */
  static createLogger(type: LoggerType): ILogger {
    switch (type) {
      case 'console':
        return new ConsoleLogger()
      case 'pino':
        return new PinoLogger()
      case 'winston':
        return new WinstonLogger()
      default:
        return new WinstonLogger()
    }
  }

  /**
   * シングルトンインスタンスをリセット
   * テスト時に使用
   */
  static reset(): void {
    this.instance = null
  }
}

/**
 * デフォルトの Logger インスタンス
 * アプリケーション全体で使用
 */
export const logger = LoggerFactory.getLogger()
```

**実装のポイント**:

1. **環境変数で切り替え**
   - `LOGGER_TYPE=winston` → Winston Logger（デフォルト）
   - `LOGGER_TYPE=pino` → Pino Logger（高速）
   - `LOGGER_TYPE=console` → Console Logger（シンプル）

2. **シングルトンパターン**
   - アプリケーション全体で同一インスタンスを使用

### エクスポートとヘルパー関数

**ファイル**: `apps/api/log/index.ts`

```typescript
/**
 * Logger モジュールのエントリーポイント
 */

export { ConsoleLogger } from './console-logger'
export type { ILogger, LogMetadata } from './interface'
export { logger, LoggerFactory } from './logger-factory'
export type { LoggerType } from './logger-factory'
export { PinoLogger } from './pino-logger'
export { WinstonLogger } from './winston-logger'

// 既存のヘルパー関数をエクスポート
import { logger } from './logger-factory'

/**
 * ログヘルパー関数
 * より構造化されたログを記録するためのユーティリティ
 */

/**
 * 認証成功ログ
 */
export const logAuthSuccess = (userId: number, email: string, provider: string) => {
  logger.info('Authentication successful', { email, provider, userId })
}

/**
 * 認証失敗ログ
 */
export const logAuthFailure = (provider: string, reason: string, metadata?: Record<string, unknown>) => {
  logger.warn('Authentication failed', { metadata, provider, reason })
}

/**
 * API リクエストログ
 */
export const logApiRequest = (method: string, path: string, userId?: number) => {
  logger.debug('API request', { method, path, userId })
}

/**
 * API エラーログ
 */
export const logApiError = (method: string, path: string, error: Error, userId?: number) => {
  logger.error('API error', error, {
    method,
    path,
    userId,
  })
}

/**
 * データベースエラーログ
 */
export const logDatabaseError = (operation: string, error: Error) => {
  logger.error('Database error', error, {
    operation,
  })
}
```

### index.ts での使用

**ファイル**: `apps/api/src/index.ts`

logger をインポートし、サーバー起動時やエラーハンドリングで使用します。

```typescript
import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'

import { GoogleAuthLibraryClient } from './client/google-oauth'
import { AuthGoogleCallbackController } from './controller/auth/google-callback'
import { AuthGoogleController } from './controller/auth/google'
import { AuthMeController } from './controller/auth/me'
import { logger } from '../log' // log/index.ts からインポート
import { errorHandler } from './middleware/error-handler'
import { PrismaClient } from './prisma/generated/client'
import { PrismaAuthAccountRepository, PrismaUserCharacterRepository, PrismaUserRepository } from './repository/mysql'
import { authRouter } from './routes/auth-router'

dotenv.config({ path: '.env.local' })

const app = express()
const PORT = process.env.PORT || 8080
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000'

// 環境変数チェック
if (!process.env.GOOGLE_CLIENT_ID) {
  logger.error('GOOGLE_CLIENT_ID environment variable is required')
  throw new Error('GOOGLE_CLIENT_ID environment variable is required')
}
if (!process.env.GOOGLE_CLIENT_SECRET) {
  logger.error('GOOGLE_CLIENT_SECRET environment variable is required')
  throw new Error('GOOGLE_CLIENT_SECRET environment variable is required')
}
if (!process.env.GOOGLE_CALLBACK_URL) {
  logger.error('GOOGLE_CALLBACK_URL environment variable is required')
  throw new Error('GOOGLE_CALLBACK_URL environment variable is required')
}

// データソースの初期化
const prisma = new PrismaClient()

// Repository のインスタンス化
const userRepository = new PrismaUserRepository(prisma)
const accountRepository = new PrismaAuthAccountRepository(prisma)
const userCharacterRepository = new PrismaUserCharacterRepository(prisma)

// Client のインスタンス化
const googleOAuthClient = new GoogleAuthLibraryClient(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_CALLBACK_URL
)

// Controller のインスタンス化
const authGoogleController = new AuthGoogleController(googleOAuthClient)
const authGoogleCallbackController = new AuthGoogleCallbackController(
  userRepository,
  accountRepository,
  userCharacterRepository,
  googleOAuthClient,
  FRONTEND_URL
)
const authMeController = new AuthMeController(userRepository)

// ミドルウェア
app.use(
  cors({
    credentials: true,
    origin: FRONTEND_URL,
  })
)
app.use(express.json())

// ルーティング
app.use(
  '/api/auth',
  authRouter(authGoogleController, authGoogleCallbackController, authMeController)
)

// エラーハンドリング
app.use(errorHandler)

// サーバー起動
app.listen(PORT, () => {
  logger.info('API server running', {
    environment: process.env.NODE_ENV || 'development',
    port: PORT,
    url: `http://localhost:${PORT}`,
  })
})

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM signal received: closing HTTP server')
  await prisma.$disconnect()
  logger.info('Database connection closed')
  process.exit(0)
})

// 予期しない例外をキャッチ
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', error)
  process.exit(1)
})

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { reason })
  process.exit(1)
})
```

## 動作確認

### サーバー起動とログの確認

```bash
cd apps/api
pnpm dev
```

以下のログがコンソールに表示されます：

**開発環境（Winston）**:
```
2024-01-01 12:00:00 info: API server running {"environment":"development","port":"8080","url":"http://localhost:8080"}
```

**本番環境（Winston）**:
```json
{"level":"info","message":"API server running","timestamp":"2024-01-01T12:00:00.000Z","environment":"production","port":"8080","url":"http://localhost:8080"}
```

**Pino（開発環境）**:
```
[12:00:00.000] INFO: API server running
    environment: "development"
    port: "8080"
    url: "http://localhost:8080"
```

### Logger 切り替えの確認

**Winston Logger を使用**（デフォルト）:
```bash
pnpm dev
# または
LOGGER_TYPE=winston pnpm dev
```

**Pino Logger を使用**（高速）:
```bash
LOGGER_TYPE=pino pnpm dev
```

**Console Logger を使用**（シンプル）:
```bash
LOGGER_TYPE=console pnpm dev
```

### ログレベルの動作確認

以下のコードを一時的に `index.ts` に追加してテストします：

```typescript
// テスト用ログ
logger.debug('This is a debug message', { foo: 'bar' })
logger.info('This is an info message', { userId: 123 })
logger.warn('This is a warning message', { reason: 'test' })
logger.error('This is an error message', undefined, { code: 500 })

// Error オブジェクト付き
const testError = new Error('Test error')
logger.error('Error with exception', testError, { context: 'test' })
```

開発環境では全てのログがコンソールに表示されます。
本番環境（`NODE_ENV=production`）では、`debug` ログは表示されません。

### クラウド環境でのログ確認

**AWS CloudWatch Logs**:
1. ECS タスク定義で `awslogs` ログドライバーを設定
2. CloudWatch Logs コンソールでログストリームを確認
3. Logs Insights でクエリ実行

```
fields @timestamp, level, message, userId, email
| filter level = "error"
| sort @timestamp desc
| limit 100
```

**GCP Cloud Logging**:
1. Cloud Run または GKE にデプロイ
2. Cloud Logging コンソールでログを確認
3. フィルタリング: `jsonPayload.level="error"`

## セキュリティとベストプラクティス

### 機密情報のログ出力禁止

以下の情報は **絶対にログに記録しない**：

- パスワード
- JWT トークン（生成されたトークンの内容）
- Google のアクセストークン
- クレジットカード情報
- その他の個人識別情報（PII）

❌ **NG 例**:
```typescript
logger.info('User logged in', { token: generatedToken })  // トークンを記録しない！
```

✅ **OK 例**:
```typescript
logger.info('User logged in', { userId: user.id })  // userId のみ記録
```

### JSON 構造化ロギングの利点

1. **ログ分析が容易**
   - CloudWatch Logs Insights、Datadog、Splunk等で簡単にクエリ
   - フィルタリング、集計、可視化が高速

2. **統一されたフォーマット**
   - すべてのログが同じ構造
   - パースエラーなし

3. **メタデータの柔軟性**
   - 任意のフィールドを追加可能
   - ネストした構造も記録可能

### テスト環境での推奨設定

```bash
# .env.test.local
LOGGER_TYPE=console
NODE_ENV=test
```

これにより、テスト実行時：
- コンソールに JSON 出力（デバッグ可能）
- 高速実行

### 本番環境でのログ管理

- **ログ集約サービスの利用**: AWS CloudWatch Logs、Datadog、Loggly などにログを送信
- **ログの暗号化**: 重要なログは暗号化して保存
- **アクセス制限**: ログへのアクセスを開発者のみに制限（IAM ポリシーなど）
- **監視とアラート**: エラーログが急増した場合にアラートを送信
- **保持期間の設定**: CloudWatch Logs で適切な保持期間を設定（例: 30日〜1年）

### Logger の選択ガイド

| Logger | 用途 | 特徴 |
|--------|------|------|
| Winston | 本番環境（一般） | 多機能、エンタープライズ向け |
| Pino | 本番環境（高負荷） | 高速、大量ログ処理 |
| Console | 開発・テスト環境 | シンプル、軽量 |

### ログレベルの使い分けガイド

| レベル | 用途 | 例 |
|--------|------|-----|
| `debug` | 開発時のデバッグ情報 | リクエストパラメータ、クエリ実行、内部状態 |
| `info` | 通常の処理フロー | 認証成功、ユーザー作成、重要な処理の完了 |
| `warn` | 注意が必要な状況 | バリデーションエラー、認証失敗、ユーザーが見つからない |
| `error` | エラーや例外 | API呼び出し失敗、データベースエラー、予期しない例外 |

## Controller での Logger 使用例

**ファイル**: `apps/api/src/controller/auth/google-callback.ts`

```typescript
import { Request, Response } from 'express'

import {
  authGoogleCallbackRequestSchema,
  authGoogleCallbackResponseSchema,
  ErrorResponse,
} from '@repo/api-schema'

import { GoogleOAuthClient } from '../../client/google-oauth'
import { logger } from '../../../log' // Logger をインポート
import { AuthAccountRepository, UserRegistrationRepository } from '../../repository/mysql'
import { authenticateWithGoogle } from '../../service/auth-service'

export class AuthGoogleCallbackController {
  constructor(
    private authAccountRepository: AuthAccountRepository,
    private userRegistrationRepository: UserRegistrationRepository,
    private googleOAuthClient: GoogleOAuthClient
  ) {}

  async execute(req: Request, res: Response) {
    // リクエスト受付ログ
    logger.info('Google OAuth callback request received', {
      hasCode: !!req.query.code,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    })

    try {
      const validatedRequest = authGoogleCallbackRequestSchema.parse(req.query)
      logger.debug('Request validation successful')

      const result = await authenticateWithGoogle(
        validatedRequest.code,
        {
          authAccountRepository: this.authAccountRepository,
          userRegistrationRepository: this.userRegistrationRepository,
        },
        this.googleOAuthClient
      )

      logger.info('Google authentication successful', {
        isNewUser: result.isNewUser,
        userId: result.user.id,
      })

      const response = authGoogleCallbackResponseSchema.parse({
        is_new_user: result.isNewUser,
        token: result.jwtToken,
        user: {
          avatar_url: result.user.avatarUrl,
          created_at: result.user.createdAt.toISOString(),
          email: result.user.email,
          id: result.user.id,
          name: result.user.name,
        },
      })

      res.status(200).json(response)
    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        logger.warn('Request validation failed', {
          error: error.message,
        })

        const errorResponse: ErrorResponse = {
          error: 'Invalid request parameters',
          status_code: 400,
        }
        return res.status(400).json(errorResponse)
      }

      // Error オブジェクトを error メソッドに渡す
      logger.error('Google authentication failed', error as Error, {
        hasCode: !!req.query.code,
      })

      const errorResponse: ErrorResponse = {
        error: error instanceof Error ? error.message : 'Authentication failed',
        status_code: 500,
      }
      res.status(500).json(errorResponse)
    }
  }
}
```

## Service での Logger 使用例

**ファイル**: `apps/api/src/service/auth-service.ts`

```typescript
import { GoogleOAuthClient, GoogleUserInfo } from '../client/google-oauth'
import { generateToken } from '../lib/jwt'
import { logger } from '../../log'
import { CharacterCode, User } from '../prisma/generated/client'
import {
  AuthAccountRepository,
  UserRegistrationRepository,
} from '../repository/mysql'

export const authenticateWithGoogle = async (
  code: string,
  repository: {
    authAccountRepository: AuthAccountRepository
    userRegistrationRepository: UserRegistrationRepository
  },
  googleAuthClient: GoogleOAuthClient
): Promise<AuthenticateWithGoogleResult> => {
  const { authAccountRepository, userRegistrationRepository } = repository

  logger.debug('Starting Google authentication', { codeLength: code.length })

  try {
    const googleUser: GoogleUserInfo = await googleAuthClient.getUserInfo(code)

    logger.info('Google user info retrieved', {
      email: googleUser.email,
      googleUserId: googleUser.id,
    })

    const existingAccount = await authAccountRepository.findByProvider('google', googleUser.id)

    let user: User
    let isNewUser = false

    if (existingAccount) {
      user = existingAccount.user
      logger.info('Existing user login', { userId: user.id })
    } else {
      isNewUser = true
      logger.info('Creating new user', { email: googleUser.email })

      try {
        user = await userRegistrationRepository.createUserWithAuthAccountAndUserCharacterTx({
          authAccount: {
            provider: 'google',
            providerAccountId: googleUser.id,
          },
          user: {
            avatarUrl: googleUser.picture,
            email: googleUser.email,
            name: googleUser.name,
          },
          userCharacter: {
            characterCode: CharacterCode.TRAECHAN,
            isActive: true,
            nickName: 'トレちゃん',
          },
        })

        logger.info('New user created successfully', { userId: user.id })
      } catch (error) {
        // Error オブジェクトを error メソッドに渡す
        logger.error('Failed to create new user', error as Error, {
          email: googleUser.email,
        })
        throw error
      }
    }

    logger.debug('Generating JWT token', { userId: user.id })
    const jwtToken = generateToken(user.id)

    logger.info('Authentication completed successfully', {
      isNewUser,
      userId: user.id,
    })

    return {
      isNewUser,
      jwtToken,
      user,
    }
  } catch (error) {
    logger.error('Google authentication service error', error as Error)
    throw error
  }
}
```

## リクエストログの実装（Middleware）

### 概要

全てのAPIリクエストを自動的にログに記録するmiddlewareを実装します。以下の情報を記録することで、API の動作状況やパフォーマンスの監視、問題の調査が容易になります。

**記録する情報**:
- HTTPメソッド（GET、POST等）
- リクエストパス
- ステータスコード
- レスポンスタイム（ミリ秒）
- ユーザーID（認証済みの場合）
- IPアドレス
- User-Agent

### Middleware の実装

**ファイル**: `apps/api/src/middleware/request-logger.ts`

```typescript
import type { NextFunction, Request, Response } from 'express'

import { logger } from '../../log'

/**
 * リクエストログ Middleware
 * 全てのAPIリクエストとレスポンスを記録
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now()

  // レスポンス完了時にログを記録
  res.on('finish', () => {
    const duration = Date.now() - startTime
    const { method, originalUrl, ip } = req
    const { statusCode } = res
    const userAgent = req.get('user-agent') || 'unknown'

    // 認証されたユーザーIDを取得（存在する場合）
    // @ts-expect-error userId は認証 middleware で設定される想定
    const userId = req.user?.id

    logger.info('API request completed', {
      duration,
      ip,
      method,
      path: originalUrl,
      statusCode,
      userAgent,
      userId,
    })
  })

  next()
}
```

**実装のポイント**:

1. **レスポンス完了時にログ記録**
   - `res.on('finish')` でレスポンスが完了したタイミングでログを出力
   - レスポンスタイムを正確に計測できる

2. **ステータスコードの記録**
   - 成功・失敗を判別できる
   - 4xx/5xx エラーの発生状況を監視可能

3. **認証ユーザー情報**
   - `req.user?.id` で認証されたユーザーIDを記録
   - 認証 middleware で `req.user` が設定される前提

4. **パフォーマンス監視**
   - `duration` でレスポンスタイムを記録
   - 遅いエンドポイントの特定が容易

### index.ts への組み込み

**ファイル**: `apps/api/src/index.ts`

リクエストログ middleware を追加します。**CORS と express.json() の後、ルーティングの前**に配置します。

```typescript
import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'

import { logger } from '../log'

import { GoogleOAuthClient } from './client/google-oauth'
import { AuthGoogleController } from './controller/auth/google'
import { AuthGoogleCallbackController } from './controller/auth/google-callback'
import { AuthMeController } from './controller/auth/me'
import { requestLogger } from './middleware/request-logger'  // 追加
import { prisma } from './prisma/prisma.client'
import {
  PrismaAuthAccountRepository,
  PrismaUserRepository,
  PrismaUserRegistrationRepository
} from './repository/mysql'
import { authRouter } from './routes/auth-router'

dotenv.config({ path: '.env.local' })

const app = express()
const PORT = process.env.PORT || 8080
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000'

// 環境変数チェック
if (!process.env.GOOGLE_CLIENT_ID) {
  logger.error('GOOGLE_CLIENT_ID environment variable is required')
  throw new Error('GOOGLE_CLIENT_ID environment variable is required')
}
if (!process.env.GOOGLE_CLIENT_SECRET) {
  logger.error('GOOGLE_CLIENT_SECRET environment variable is required')
  throw new Error('GOOGLE_CLIENT_SECRET environment variable is required')
}
if (!process.env.GOOGLE_CALLBACK_URL) {
  logger.error('GOOGLE_CALLBACK_URL environment variable is required')
  throw new Error('GOOGLE_CALLBACK_URL environment variable is required')
}
if (!process.env.JWT_SECRET) {
  logger.error('JWT_SECRET environment variable is required')
  throw new Error('JWT_SECRET environment variable is required')
}

// Repository のインスタンス化
const userRepository = new PrismaUserRepository(prisma)
const authAccountRepository = new PrismaAuthAccountRepository(prisma)
const userRegistrationRepository = new PrismaUserRegistrationRepository(prisma)

// Client のインスタンス化
const googleOAuthClient = new GoogleOAuthClient(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_CALLBACK_URL
)

// Controller のインスタンス化
const authGoogleController = new AuthGoogleController(googleOAuthClient)
const authGoogleCallbackController = new AuthGoogleCallbackController(
  authAccountRepository,
  userRegistrationRepository,
  googleOAuthClient,
)
const authMeController = new AuthMeController(userRepository)

// ミドルウェア
app.use(
  cors({
    credentials: true,
    origin: FRONTEND_URL,
  })
)
app.use(express.json())
app.use(requestLogger)  // リクエストログ middleware を追加

// ルーティング
app.use(
  '/api/auth',
  authRouter(authGoogleController, authGoogleCallbackController, authMeController)
)

// サーバー起動
app.listen(PORT, () => {
  logger.info('API server running', {
    environment: process.env.NODE_ENV || 'development',
    port: PORT,
    url: `http://localhost:${PORT}`,
  })
})

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM signal received: closing HTTP server')
  await prisma.$disconnect()
  logger.info('Database connection closed')
  process.exit(0)
})

// 予期しない例外をキャッチ
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', error)
  process.exit(1)
})

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { reason })
  process.exit(1)
})
```

### 動作確認

#### サーバー起動

```bash
cd apps/api
pnpm dev
```

#### リクエストを送信

```bash
# Google OAuth フローを開始
curl http://localhost:8080/api/auth/google
```

#### ログの確認

以下のようなログがコンソールに表示されます：

**開発環境（Winston、カラー表示）**:
```
2024-01-01 12:00:00 info: API request completed {"method":"GET","path":"/api/auth/google","statusCode":302,"duration":15,"ip":"::1","userAgent":"curl/7.88.1"}
```

**本番環境（Winston、JSON形式）**:
```json
{
  "level": "info",
  "message": "API request completed",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "method": "GET",
  "path": "/api/auth/google",
  "statusCode": 302,
  "duration": 15,
  "ip": "::1",
  "userAgent": "curl/7.88.1"
}
```

**Pino Logger（開発環境）**:
```
[12:00:00.000] INFO: API request completed
    method: "GET"
    path: "/api/auth/google"
    statusCode: 302
    duration: 15
    ip: "::1"
    userAgent: "curl/7.88.1"
```

#### 認証済みリクエストの確認

認証が必要なエンドポイント（例: `/api/auth/me`）にアクセスすると、`userId` も記録されます：

```bash
# JWT トークン付きでリクエスト
curl -H "Authorization: Bearer <your-jwt-token>" http://localhost:8080/api/auth/me
```

ログには `userId` が含まれます：

```json
{
  "level": "info",
  "message": "API request completed",
  "method": "GET",
  "path": "/api/auth/me",
  "statusCode": 200,
  "duration": 25,
  "userId": 123,
  "ip": "::1",
  "userAgent": "curl/7.88.1",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### ログを活用した監視とトラブルシューティング

#### パフォーマンス問題の特定

CloudWatch Logs Insights を使用して、遅いエンドポイントを特定：

```
fields @timestamp, method, path, duration, statusCode
| filter duration > 1000
| sort duration desc
| limit 20
```

#### エラー率の監視

4xx/5xx エラーの発生状況を確認：

```
fields @timestamp, method, path, statusCode
| filter statusCode >= 400
| stats count() by path, statusCode
| sort count desc
```

#### ユーザー別のアクティビティ

特定ユーザーのリクエスト履歴を確認：

```
fields @timestamp, method, path, statusCode, duration
| filter userId = 123
| sort @timestamp desc
| limit 50
```

### ベストプラクティス

#### 1. 機密情報の除外

リクエストボディやクエリパラメータに機密情報（パスワード、トークン等）が含まれる場合、それらをログに記録しないように注意してください。

現在の実装では、`method` と `path` のみを記録しているため、クエリパラメータやリクエストボディは記録されません。これにより、機密情報の漏洩を防ぎます。

#### 2. ヘルスチェックエンドポイントの除外

クラウド環境では、ヘルスチェックエンドポイント（例: `/health`）が頻繁にアクセスされるため、ログが大量に記録されます。必要に応じて、これらのエンドポイントをログから除外できます：

**ファイル**: `apps/api/src/middleware/request-logger.ts`

```typescript
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  // ヘルスチェックはログに記録しない
  if (req.path === '/health' || req.path === '/healthz') {
    return next()
  }

  const startTime = Date.now()

  res.on('finish', () => {
    const duration = Date.now() - startTime
    const { method, originalUrl, ip } = req
    const { statusCode } = res
    const userAgent = req.get('user-agent') || 'unknown'

    // @ts-expect-error userId は認証 middleware で設定される想定
    const userId = req.user?.id

    logger.info('API request completed', {
      duration,
      ip,
      method,
      path: originalUrl,
      statusCode,
      userAgent,
      userId,
    })
  })

  next()
}
```

#### 3. ログレベルの調整

開発環境では全てのリクエストを `debug` レベルで記録し、本番環境では `info` レベルで記録することも可能です：

```typescript
const logLevel = process.env.NODE_ENV === 'production' ? 'info' : 'debug'

if (logLevel === 'debug') {
  logger.debug('API request completed', { /* ... */ })
} else {
  logger.info('API request completed', { /* ... */ })
}
```

### まとめ

リクエストログ middleware により、以下が実現されます：

1. **全てのAPIリクエストを自動記録**
   - 手動でログを書く必要がない
   - 一貫したログフォーマット

2. **パフォーマンス監視**
   - レスポンスタイムを記録
   - 遅いエンドポイントの特定が容易

3. **エラー追跡**
   - ステータスコードで成功・失敗を判別
   - 問題の早期発見

4. **セキュリティ監査**
   - IPアドレス、User-Agentを記録
   - 不審なアクセスの検出

5. **ユーザー行動分析**
   - 認証済みユーザーのアクティビティ追跡
   - 利用状況の把握
