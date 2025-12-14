# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Turborepo + pnpm monorepo containing a full-stack application with:
- **apps/web**: Next.js 16 web application (port 3000)
- **apps/admin**: Next.js 16 admin dashboard (port 3030)
- **apps/mobile**: Expo/React Native mobile application
- **apps/api**: Express.js API server (port 8080)
- **packages/schema**: Shared Zod schemas for API validation and TypeScript types
- **packages/terraform**: Infrastructure as Code for AWS deployment

## Common Commands

### Root-level commands (run from project root):
```bash
pnpm dev          # Start all apps in dev mode
pnpm build        # Build all apps
pnpm lint         # Run ESLint on all apps
pnpm lint:fix     # Fix ESLint issues
pnpm test         # Run tests
```

### App-specific commands:
```bash
# Web app (apps/web)
cd apps/web
pnpm dev          # Start on http://localhost:3000
pnpm build        # Build for production
pnpm start        # Start production server

# Admin app (apps/admin)
cd apps/admin
pnpm dev          # Start on http://localhost:3030
pnpm build        # Build for production
pnpm start        # Start production server

# API server (apps/api)
cd apps/api
pnpm dev          # Start with hot reload on http://localhost:8080
pnpm build        # Compile TypeScript to dist/
pnpm start        # Run compiled version from dist/

# Mobile app (apps/mobile)
cd apps/mobile
pnpm start        # Start Expo dev server
pnpm android      # Run on Android
pnpm ios          # Run on iOS
```

### Schema package:
```bash
cd packages/schema
pnpm build        # Compile TypeScript
pnpm dev          # Watch mode for development
```

### Terraform:
```bash
cd packages/terraform/aws/env/dev
terraform init    # Initialize (first time only)
terraform plan    # Preview changes
terraform apply   # Deploy infrastructure
terraform destroy # Tear down infrastructure

# Linting and validation
terraform fmt -check -recursive -diff
terraform validate
tflint --init
tflint --chdir=aws/env/dev --config=$(pwd)/.tflint.hcl --recursive
checkov -d . --framework terraform --config-file .checkov.yml
trivy config aws/env/dev -c .trivy.yml
```

## Architecture

### Monorepo structure with Turborepo
- Uses pnpm workspaces to link packages
- Turborepo handles build orchestration with task dependencies
- `^build` in turbo.json means "build dependencies first"
- Dev servers use `persistent: true` in turbo.json
- All env files (`.env*.local`) invalidate Turbo cache via `globalDependencies`

### Shared schema package (@repo/api-schema)
- **Critical**: All API schemas are defined in `packages/schema/src/api-schema/` using Zod
- The API server (`apps/api`) and frontend apps import these schemas for validation
- This ensures request/response contracts are shared and type-safe across the stack
- Schema structure: `packages/schema/src/api-schema/{domain}.ts` (e.g., `user.ts`)
- Each API endpoint has: request schema, response schema, and inferred TypeScript types
- When adding new API endpoints, **always** define schemas in `packages/schema` first, then import them in the API and frontend

### API server architecture
- Express.js with TypeScript
- All endpoints validate requests/responses using Zod schemas from `@repo/api-schema`
- Main file: `apps/api/src/index.ts`
- Uses `ts-node-dev` for hot reload in development
- Compiles to `dist/` for production

### Frontend architecture
- **Web & Admin**: Next.js 16 with App Router
  - Uses Tailwind CSS v4 with PostCSS
  - App Router structure in `app/` directory
  - Both apps import types/schemas from `@repo/api-schema`
- **Mobile**: Expo with file-based routing (expo-router)
  - Uses React Navigation with bottom tabs
  - File-based routing in `app/` directory
  - Theme support via `@react-navigation/native`

### Infrastructure (Terraform)
- Structure: `packages/terraform/aws/{bootstrap,env,modules}`
- Bootstrap: S3 backend and DynamoDB for state locking
- Env: Environment-specific configs (dev/staging/prod)
- Modules: Reusable Terraform modules
- Uses tflint, checkov, and trivy for security/policy checks

## Code Style and Linting

All apps use ESLint v9 with flat config format (`eslint.config.{js,mjs}`).

### Key rules enforced:
- **No semicolons** (`semi: ["error", "never"]`)
- **Single quotes** for strings (`quotes: ["error", "single"]`)
- **Object curly spacing** required (`{ foo }` not `{foo}`)
- **Strict equality** (`===` not `==`)
- **Import ordering**: builtin → external → internal (@repo) → parent → sibling → index, with newlines between groups
- **Sort object keys** alphabetically (2+ keys)
- **React JSX props**: callbacks last, shorthand first, reserved first
- **TypeScript**: No `any` (warn), no empty functions, use `async` for Promise-returning functions
- **Naming conventions**:
  - Variables: camelCase, UPPER_CASE, or PascalCase
  - Functions: camelCase or PascalCase
  - Types: PascalCase
- **Prefer**: const over let/var, template literals over string concatenation, arrow callbacks

### When editing files:
- Run `pnpm lint:fix` after making changes to auto-fix formatting
- If adding new imports, ensure they follow the import order rules
- Object keys should be sorted alphabetically

## Environment Requirements

- **Node.js**: >=18.0.0
- **pnpm**: >=9.0.0 (specified in `package.json` via `packageManager` field)
- **Terraform**: Required for infrastructure work
- **AWS CLI**: Required for Terraform deployment (authenticate with `aws configure`)

## Development Workflow

1. **Install dependencies** (first time): `pnpm install` from root
2. **Build shared packages**: `pnpm build` to compile `@repo/api-schema`
3. **Start development**: `pnpm dev` from root to start all apps, or `cd` into specific app and run `pnpm dev`
4. **Add new API endpoint**:
   - Define schemas in `packages/schema/src/api-schema/{domain}.ts`
   - Export from `packages/schema/src/api-schema/index.ts`
   - Rebuild schema package: `cd packages/schema && pnpm build`
   - Implement endpoint in `apps/api/src/index.ts` using the schemas
   - Use schemas in frontend apps for type safety
5. **Lint before committing**: `pnpm lint:fix` from root

## Important Notes

- The schema package must be built before running apps that depend on it
- When changing schemas, rebuild with `cd packages/schema && pnpm build`
- API server uses `dotenv` to load `.env.local` files
- Web app runs on port 3000, admin on 3030, API on 8080 (configurable via PORT env var)
- Terraform state is stored in S3 with DynamoDB locking (configured in bootstrap)
- All documentation is in Japanese in `docs/setup/` directory
- When Plan Feature, don't include duration

## Documentation Guidelines

### Specification and Design Documents (`docs/spec/`)

仕様書・設計書は `docs/spec/` ディレクトリに配置します。AI が仕様書を作成・更新する際は以下のルールに従ってください。

#### ファイル構成
- 機能単位でディレクトリを作成（例: `docs/spec/auth/`, `docs/spec/payment/`）
- 各機能は **テスト可能な最小単位** でステップファイルに分割
- API、Web、Mobile など複数のアプリに跨る場合でも、テスト可能な単位で分割
- README.mdには機能単位の設計書を記述して欲しいです。

#### stepファイルの記述ルール
- **実装手順に番号を振らない**
- 各ステップファイルには以下のセクションを含める:
  - **対応内容**: 実装する内容の詳細（コード例、API仕様など）
  - **動作確認**: テストコードや動作確認の方法
- 全て日本語で記述

#### テンプレート
`docs/spec/template/1-step.md` にステップファイルのテンプレートがあります。

#### README.mdファイルの記述ルール
- 全て日本語で記述


#### テンプレート
`docs/spec/template/README.md` にREADME.mdファイルのテンプレートがあります。