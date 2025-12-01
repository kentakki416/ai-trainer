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
  default     = "my-project-terraform-state-lock" # ← 一意のテーブル名に変更してください
}
