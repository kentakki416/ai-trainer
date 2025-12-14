# =============================================================================
# CloudWatch Resources for ECS
# =============================================================================

# CloudWatch Log Group for ECS Tasks
# - ECSタスクのログを収集・保存
# - アプリケーションログの集中管理
resource "aws_cloudwatch_log_group" "ecs_log_group" {
  name              = "/ecs/${var.task_definition_family}"
  retention_in_days = var.log_retention_in_days

  tags = var.tags
}

# Current AWS Region Data Source
# - CloudWatch Logsの設定で使用するリージョン情報を取得
data "aws_region" "current" {}
