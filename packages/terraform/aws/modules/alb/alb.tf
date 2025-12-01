# =============================================================================
# Application Load Balancer Resources
# =============================================================================

# Application Load Balancer
# - インターネットからのトラフィックを受信
# - 複数のターゲットに負荷分散
resource "aws_lb" "main" {
  name               = var.name
  internal           = var.internal
  load_balancer_type = "application"
  security_groups    = var.security_groups
  subnets            = var.subnets

  enable_deletion_protection = var.enable_deletion_protection

  tags = var.tags
}

# ALB Target Group
# - ECSタスクへのルーティング設定
# - ヘルスチェック設定を含む
resource "aws_lb_target_group" "main" {
  name        = "${var.name}-tg"
  port        = var.target_group_port
  protocol    = var.target_group_protocol
  vpc_id      = var.vpc_id
  target_type = var.target_type

  # ヘルスチェック設定
  health_check {
    enabled             = var.health_check.enabled
    healthy_threshold   = var.health_check.healthy_threshold
    interval            = var.health_check.interval
    matcher             = var.health_check.matcher
    path                = var.health_check.path
    port                = var.health_check.port
    protocol            = var.health_check.protocol
    timeout             = var.health_check.timeout
    unhealthy_threshold = var.health_check.unhealthy_threshold
  }

  tags = var.tags
}

# ALB Listener
# - 指定されたポートでのリクエストをターゲットグループに転送
resource "aws_lb_listener" "main" {
  load_balancer_arn = aws_lb.main.arn
  port              = var.listener_port
  protocol          = var.listener_protocol

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.main.arn
  }
}
