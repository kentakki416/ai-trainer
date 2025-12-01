# =============================================================================
# IAM Resources for ECS
# =============================================================================

# ECS Task Execution Role
# - Fargateタスクの実行に必要な権限を提供
# - ECR、CloudWatch Logs、Secrets Managerへのアクセス権限
resource "aws_iam_role" "ecs_task_execution_role" {
  name = "${var.task_definition_family}-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = var.tags
}

# ECS Task Execution Role Policy Attachment
# - AmazonECSTaskExecutionRolePolicyをアタッチ
# - ECRからのイメージプル、CloudWatch Logsへの書き込み権限を提供
resource "aws_iam_role_policy_attachment" "ecs_task_execution_role_policy" {
  role       = aws_iam_role.ecs_task_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}
