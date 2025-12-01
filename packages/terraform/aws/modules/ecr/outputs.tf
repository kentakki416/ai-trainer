output "repository_url" {
  description = "URL of the ECR repository"
  value       = aws_ecr_repository.server.repository_url
}

output "repository_arn" {
  description = "ARN of the ECR repository"
  value       = aws_ecr_repository.server.arn
}

output "repository_name" {
  description = "Name of the ECR repository"
  value       = aws_ecr_repository.server.name
}

output "ecr_push_policy_arn" {
  description = "ARN of the ECR push policy"
  value       = aws_iam_policy.ecr_push_policy.arn
}
