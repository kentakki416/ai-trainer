# =============================================================================
# ECS Resources
# =============================================================================

# ECS Fargate Cluster
# - サーバーレスコンテナ実行環境
# - Container Insightsでメトリクス監視を有効化
resource "aws_ecs_cluster" "main" {
  name = var.cluster_name

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = var.tags
}

# ECS Task Definition
# - Fargateタスクの仕様を定義
# - コンテナ、リソース、ネットワーク設定を含む
resource "aws_ecs_task_definition" "main" {
  family                   = var.task_definition_family
  network_mode             = "awsvpc"    # Fargate必須のネットワークモード
  requires_compatibilities = ["FARGATE"] # Fargate専用の設定
  cpu                      = var.cpu     # CPUユニット (256 = 0.25 vCPU)
  memory                   = var.memory  # メモリ設定 (MB)
  execution_role_arn       = aws_iam_role.ecs_task_execution_role.arn

  # コンテナ定義
  container_definitions = jsonencode([
    {
      name  = var.container_name
      image = var.container_image

      # ポートマッピング設定
      portMappings = [
        {
          containerPort = var.container_port
          protocol      = "tcp"
        }
      ]

      # ログ設定 - CloudWatch Logsに送信
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.ecs_log_group.name
          "awslogs-region"        = data.aws_region.current.name
          "awslogs-stream-prefix" = "ecs"
        }
      }
    }
  ])

  tags = var.tags
}

# ECS Service
# - タスクの実行とスケーリングを管理
# - ロードバランサーとの連携設定
resource "aws_ecs_service" "main" {
  name            = var.service_name
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.main.arn
  desired_count   = var.desired_count # 希望するタスク数
  launch_type     = "FARGATE"         # Fargateでの実行

  # ネットワーク設定
  network_configuration {
    subnets          = var.network_configuration.subnets
    security_groups  = var.network_configuration.security_groups
    assign_public_ip = var.network_configuration.assign_public_ip
  }

  # ロードバランサー連携設定
  dynamic "load_balancer" {
    for_each = var.target_group_arn != "" ? [1] : []
    content {
      target_group_arn = var.target_group_arn
      container_name   = var.container_name
      container_port   = var.container_port
    }
  }

  # サービス作成前にIAMロールが準備されるのを待機
  depends_on = [aws_iam_role_policy_attachment.ecs_task_execution_role_policy]

  tags = var.tags
}
