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
