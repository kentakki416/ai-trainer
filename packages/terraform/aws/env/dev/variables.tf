# =============================================================================
# Dev Environment Variables
# =============================================================================
# 注意: プロジェクトごとに以下の値を変更してください
# - project_name（bootstrapと同じ値を使用）
# - terraform_state_bucket（bootstrapで作成したバケット名）

# =============================================================================
# 基本設定
# =============================================================================

variable "project_name" {
  description = "プロジェクト名"
  type        = string
  default     = "my-project" # ← bootstrapと同じプロジェクト名に変更してください
}

variable "environment" {
  description = "環境名（dev, stg, prd）"
  type        = string
  default     = "dev"
}

variable "aws_region" {
  description = "AWSリージョン"
  type        = string
  default     = "ap-northeast-1"
}

# =============================================================================
# Backend設定（bootstrap実行後に更新）
# =============================================================================

variable "terraform_state_bucket" {
  description = "Terraform State保存用のS3バケット名（bootstrapで作成したバケット名）"
  type        = string
  default     = "my-project-terraform-state" # ← bootstrapで作成したバケット名に変更してください
}

variable "terraform_state_lock_table" {
  description = "Terraform State Lock用のDynamoDBテーブル名（bootstrapで作成したテーブル名）"
  type        = string
  default     = "terraform-state-lock"
}

# =============================================================================
# ネットワーク設定
# =============================================================================

variable "vpc_cidr" {
  description = "VPCのCIDRブロック"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "使用するAvailability Zones"
  type        = list(string)
  default     = ["ap-northeast-1a", "ap-northeast-1c"]
}

# =============================================================================
# アプリケーション設定
# =============================================================================

variable "app_port" {
  description = "アプリケーションのポート番号"
  type        = number
  default     = 80
}

variable "container_image" {
  description = "コンテナイメージ（ECRのURLまたはDocker Hubのイメージ）"
  type        = string
  default     = "nginx:latest"
}

# =============================================================================
# ECS設定
# =============================================================================

variable "ecs_task_cpu" {
  description = "ECSタスクのCPUユニット（256 = 0.25 vCPU, 512 = 0.5 vCPU, 1024 = 1 vCPU）"
  type        = string
  default     = "256"
}

variable "ecs_task_memory" {
  description = "ECSタスクのメモリ（MB）"
  type        = string
  default     = "512"
}

variable "log_retention_days" {
  description = "CloudWatch Logsの保存期間（日数）"
  type        = number
  default     = 3
}

# =============================================================================
# タグ設定
# =============================================================================

variable "additional_tags" {
  description = "追加のタグ"
  type        = map(string)
  default     = {}
}
