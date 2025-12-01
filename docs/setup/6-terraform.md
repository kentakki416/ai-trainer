# Terraformのセットアップ (packages/terraform)

## 目次

1. [前提条件](#前提条件)
2. [ディレクトリ構成](#ディレクトリ構成)
3. [Bootstrapの実行](#bootstrapの実行)
4. [ModulesとEnvディレクトリの作成](#modulesとenvディレクトリの作成)

---

## 前提条件

### 必要なツールのインストール

```bash
# Terraformのインストール
brew install terraform

# AWS CLIのインストール（未インストールの場合）
brew install awscli
```

### AWS認証情報の設定

```bash
# AWS認証情報の設定
aws configure

# リージョンの設定
export AWS_DEFAULT_REGION="ap-northeast-1"
```

＜解説＞
* 管理者からAWSアクセスキーとシークレットキーを取得してください
* 認証情報は`~/.aws/credentials`に保存されます

---

## ディレクトリ構成

```
packages/terraform/
└── aws/
    ├── bootstrap/           # Terraform State管理用のリソース
    │   ├── provider.tf      # プロバイダー設定
    │   ├── variables.tf     # 変数定義
    │   ├── s3.tf           # S3バケット作成
    │   ├── dynamodb.tf     # DynamoDBテーブル作成
    │   └── outputs.tf      # 出力値定義
    ├── modules/             # 再利用可能なモジュール
    │   ├── vpc/            # VPC、サブネット、セキュリティグループ
    │   ├── ecs/            # ECS Fargateクラスター
    │   ├── ecr/            # ECRリポジトリ
    │   └── alb/            # Application Load Balancer
    └── env/                # 環境別の設定
        ├── dev/            # 開発環境
        │   ├── provider.tf # プロバイダー設定
        │   ├── backend.tf  # リモートバックエンド設定
        │   ├── variables.tf # 変数定義
        │   ├── main.tf     # メイン設定（モジュール呼び出し）
        │   └── outputs.tf  # 出力値定義
        └── prd/            # 本番環境（将来的に追加）
```

＜解説＞
* **bootstrap**: Terraform Stateを保存するS3バケットとDynamoDBテーブルを作成
* **modules**: 環境間で共有する再利用可能なモジュール
* **env/dev**: 開発環境のTerraform設定
* **env/prd**: 本番環境のTerraform設定（将来的に追加）

---

## Bootstrapの実行

最初に一度だけ、Terraform Stateを保存するためのS3バケットとDynamoDBテーブルを作成します。

⚠️ `bootstrap`ディレクトリではリモートバックエンドが設定されていないため、`terraform.tfstate`や`.terraform`ディレクトリがローカルに作成されます。これらのファイルは削除しないでください。削除すると、Terraformがリソースの状態を把握できなくなります。

### 1. Bootstrapディレクトリに移動

```bash
# Bootstrapディレクトリに移動
cd packages/terraform/aws/bootstrap
```

### 2. variables.tfの作成

`variables.tf`を作成して、以下の内容を記述します。

```hcl
# =============================================================================
# Bootstrap Variables
# =============================================================================
# 注意: プロジェクトごとに以下の値を変更してください
# - project_name
# - s3_bucket_name（グローバルで一意である必要があります）

variable "project_name" {
  description = "プロジェクト名（S3バケット名とDynamoDBテーブル名のプレフィックスに使用）"
  type        = string
  default     = "my-project" # ← プロジェクト名に変更してください
}

variable "aws_region" {
  description = "AWSリージョン"
  type        = string
  default     = "ap-northeast-1"
}

variable "s3_bucket_name" {
  description = "Terraform State保存用のS3バケット名（AWS全体でグローバルに一意である必要があります。他のAWSアカウントで既に使用されている名前は使用できません）"
  type        = string
  default     = "my-project-terraform-state-20250101" # ← プロジェクト名、日付、UUIDなどを含めて一意のバケット名に変更してください
}

variable "dynamodb_table_name" {
  description = "Terraform State Lock用のDynamoDBテーブル名"
  type        = string
  default     = "terraform-state-lock"
}
```

＜解説＞
* `project_name`: プロジェクト名（タグやリソース名に使用）
* `s3_bucket_name`: S3バケット名（AWS全体でグローバルに一意）
  * バケット名の利用可能性は`aws s3api head-bucket --bucket <バケット名>`で確認できます（404が返れば使用可能）
* `dynamodb_table_name`: DynamoDBテーブル名（State Lock用）
* `aws_region`: AWSリージョン

### 3. provider.tfの作成

`provider.tf`を作成して、以下の内容を記述します。

```hcl
terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.1"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project_name
      ManagedBy   = "Terraform"
      Environment = "bootstrap"
    }
  }
}
```

＜解説＞
* Terraformバージョン1.0以上が必要
* AWS Provider v5.0を使用
* デフォルトタグを設定（全リソースに自動付与）

### 4. s3.tfの作成

`s3.tf`を作成して、以下の内容を記述します。

```hcl
# Terraform state用のS3バケット
resource "aws_s3_bucket" "terraform_state" {
  bucket = var.s3_bucket_name

  tags = {
    Name = "Terraform State Bucket"
  }
}

# バケットのバージョニングを有効化
resource "aws_s3_bucket_versioning" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id
  versioning_configuration {
    status = "Enabled"
  }
}

# バケットの暗号化を設定
resource "aws_s3_bucket_server_side_encryption_configuration" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

# パブリックアクセスをブロック
resource "aws_s3_bucket_public_access_block" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
```

＜解説＞
* バージョニング有効化: State履歴を保存
* 暗号化設定: AES256でデータを暗号化
* パブリックアクセスブロック: セキュリティ強化

### 5. dynamodb.tfの作成

`dynamodb.tf`を作成して、以下の内容を記述します。

```hcl
# Terraform state lock用のDynamoDBテーブル
resource "aws_dynamodb_table" "terraform_state_lock" {
  name         = var.dynamodb_table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled = true
  }

  tags = {
    Name = "Terraform State Lock Table"
  }
}
```

＜解説＞
* `billing_mode = "PAY_PER_REQUEST"`: 使った分だけ課金
* `hash_key = "LockID"`: Terraform State Lockingに必要
* ポイントインタイムリカバリ: データ保護
* 暗号化有効: セキュリティ強化

### 6. outputs.tfの作成

`outputs.tf`を作成して、以下の内容を記述します。

```hcl
output "s3_bucket_name" {
  description = "Terraform State保存用のS3バケット名"
  value       = aws_s3_bucket.terraform_state.id
}

output "dynamodb_table_name" {
  description = "Terraform State Lock用のDynamoDBテーブル名"
  value       = aws_dynamodb_table.terraform_state_lock.name
}

output "aws_region" {
  description = "AWSリージョン"
  value       = var.aws_region
}
```

＜解説＞
* 作成されたリソース情報を出力
* 次のステップで使用する値を確認可能

### 7. Terraformの初期化

```bash
# Terraformの初期化
cd packages/terraform/aws/bootstrap
terraform init
```

＜解説＞
* `.terraform`ディレクトリが作成されます
* プロバイダープラグインがダウンロードされます

### 8. 実行プランの確認

```bash
# 実行プランの確認
terraform plan
```

＜解説＞
* 作成されるリソースを確認できます
* エラーがないか確認してください
* **S3バケット名の衝突エラーが発生した場合**: `BucketAlreadyExists`エラーが表示されたら、`variables.tf`の`s3_bucket_name`をより一意な名前に変更してください

### 9. リソースの作成

```bash
# リソースの作成
terraform apply
```

＜解説＞
* 実行プランを確認後、`yes`を入力するとリソースが作成されます
* Bootstrapで作成されるリソース:
  - S3バケット: Terraform Stateファイルの保存
  - DynamoDBテーブル: State Lockingの提供
* **注意**: Bootstrapは一度だけ実行してください
* **重要**: `terraform apply`実行後、`terraform.tfstate`と`terraform.tfstate.backup`ファイルがローカルに作成されます。これらのファイルは管理者のローカル環境に保存されるため、**絶対に削除しないでください**。削除すると、Terraformが作成したリソースの状態を把握できなくなり、リソースの管理ができなくなります。
* **S3バケット名の衝突エラーが発生した場合**: 
  * `BucketAlreadyExists`エラーが発生した場合、指定したバケット名が他のAWSアカウントで既に使用されています
  * `variables.tf`の`s3_bucket_name`をより一意な名前に変更し、再度`terraform plan`と`terraform apply`を実行してください
  * バケット名の利用可能性は`aws s3api head-bucket --bucket <バケット名>`で確認できます（404が返れば使用可能）

### 10. 出力値の確認

```bash
# 作成されたリソース情報を確認
terraform output
```

出力例:
```
s3_bucket_name = "my-project-terraform-state"
dynamodb_table_name = "terraform-state-lock"
aws_region = "ap-northeast-1"
```

＜解説＞
* これらの値は後で作成する`env/dev/backend.tf`で使用します
* `s3_bucket_name`と`dynamodb_table_name`をメモしてください

---

## ModulesとEnvディレクトリの作成

Bootstrap実行後、再利用可能なモジュールと環境別の設定ディレクトリを作成します。

### 1. ディレクトリの作成

```bash
# プロジェクトルートから実行
cd packages/terraform/aws

# Modulesディレクトリの作成
mkdir -p modules/vpc
mkdir -p modules/ecs
mkdir -p modules/ecr
mkdir -p modules/alb

# Envディレクトリの作成
mkdir -p env/dev
mkdir -p env/prd
```

### 2. 各ディレクトリの説明

#### **modules/**
再利用可能なTerraformモジュールを配置するディレクトリです。

* **`modules/vpc/`**: VPC、サブネット、セキュリティグループ、NAT Gateway、Internet Gatewayなどのネットワークリソースを定義
* **`modules/ecs/`**: ECS Fargateクラスター、サービス、タスク定義などのコンテナオーケストレーションリソースを定義
* **`modules/ecr/`**: ECRリポジトリ（Dockerイメージの保存先）を定義
* **`modules/alb/`**: Application Load Balancerを定義

#### **env/**
環境別のTerraform設定を配置するディレクトリです。

* **`env/dev/`**: 開発環境の設定
  * `provider.tf`: プロバイダー設定
  * `backend.tf`: リモートバックエンド設定（bootstrapで作成したS3バケットとDynamoDBテーブルを指定）
  * `variables.tf`: 環境変数定義
  * `main.tf`: メイン設定（modulesを呼び出し）
  * `outputs.tf`: 出力値定義

* **`env/prd/`**: 本番環境の設定（将来的に追加）
  * 開発環境と同様の構成

＜解説＞
* **modules**: 環境間で共有する再利用可能なモジュール
* **env/dev**: 開発環境の設定（modulesを呼び出して使用）
* **env/prd**: 本番環境の設定（将来的に追加予定）
* 各環境の設定ファイルは、bootstrapで作成したS3バケットとDynamoDBテーブルを参照します
