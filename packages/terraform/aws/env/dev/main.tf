# =============================================================================
# Dev Environment - Main Configuration
# =============================================================================

# 共通設定とローカル変数
locals {
  # 基本設定
  name_prefix = "${var.project_name}-${var.environment}"

  # サブネットCIDRの計算
  public_subnet_cidrs  = [for i in range(2) : cidrsubnet(var.vpc_cidr, 8, i + 1)]
  private_subnet_cidrs = [for i in range(2) : cidrsubnet(var.vpc_cidr, 8, i + 11)]

  # 共通タグ
  common_tags = merge(
    {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "Terraform"
    },
    var.additional_tags
  )
}

# =============================================================================
# コンテナレジストリ設定 (ECR)
# =============================================================================

# ECRモジュール呼び出し
# - Dockerイメージの保存とバージョン管理
# - セキュリティスキャンとライフサイクル管理
module "ecr" {
  source = "../../modules/ecr"

  # === 基本設定 ===
  project_name = var.project_name
  environment  = var.environment
}

# =============================================================================
# ネットワーク設定 (VPC, サブネット, セキュリティグループ)
# =============================================================================

# VPCモジュール呼び出し
# - 開発環境用のシンプルなネットワークを構築
# - パブリックサブネットとプライベートサブネットを使用
module "vpc" {
  source = "../../modules/vpc"

  # === 基本設定 ===
  name                    = "${local.name_prefix}-vpc"
  cidr_block              = var.vpc_cidr
  enable_dns_support      = true
  enable_dns_hostnames    = true
  create_internet_gateway = true
  create_nat_gateway      = true

  # === サブネット設定 ===
  subnets = merge(
    # パブリックサブネット
    {
      for i, az in var.availability_zones : "public-${i + 1}" => {
        cidr_block        = local.public_subnet_cidrs[i]
        availability_zone = az
        subnet_type       = "public"
      }
    },
    # プライベートサブネット
    {
      for i, az in var.availability_zones : "private-${i + 1}" => {
        cidr_block        = local.private_subnet_cidrs[i]
        availability_zone = az
        subnet_type       = "private"
      }
    }
  )

  # === ルートテーブル設定 ===
  route_tables = merge(
    # パブリックサブネット用
    {
      for i in range(length(var.availability_zones)) : "public-${i + 1}-rt" => {
        global_type    = "public"
        subnet_id      = module.vpc.subnets["public-${i + 1}"].id
        route_table_id = module.vpc.igw_route_table_id
      }
    },
    # プライベートサブネット用
    {
      for i in range(length(var.availability_zones)) : "private-${i + 1}-rt" => {
        global_type    = "private"
        subnet_id      = module.vpc.subnets["private-${i + 1}"].id
        route_table_id = module.vpc.nat_route_table_id
      }
    }
  )

  # === セキュリティグループ定義 ===
  security_groups = {
    ecs_sg = {
      name        = "${local.name_prefix}-ecs-sg"
      description = "Security group for ECS tasks"
    }
  }

  # === セキュリティグループルール ===
  security_group_rules = [
    # ECS Ingress
    {
      security_group_name = "ecs_sg"
      type                = "ingress"
      from_port           = var.app_port
      to_port             = var.app_port
      protocol            = "tcp"
      cidr_blocks         = ["0.0.0.0/0"]
      description         = "Application port access"
    },
    # ECS Egress
    {
      security_group_name = "ecs_sg"
      type                = "egress"
      from_port           = 0
      to_port             = 0
      protocol            = "-1"
      cidr_blocks         = ["0.0.0.0/0"]
      description         = "All outbound traffic"
    }
  ]

  # === NAT Gateway設定 ===
  nat_gateway_subnet_id = module.vpc.subnets["public-1"].id
}

# =============================================================================
# ロードバランサー設定 (Application Load Balancer)
# =============================================================================

# ALBモジュール呼び出し
# - インターネットからの通信を受けてECSに振り分け
module "alb" {
  source = "../../modules/alb"

  # === 基本設定 ===
  name            = "${local.name_prefix}-alb"
  vpc_id          = module.vpc.vpc_id
  security_groups = [module.vpc.security_groups["ecs_sg"].id]
  subnets = [
    for i in range(length(var.availability_zones)) :
    module.vpc.subnets["public-${i + 1}"].id
  ]

  # === ターゲットグループ設定 ===
  target_group_port = var.app_port
  listener_port     = "80"

  # === タグ設定 ===
  tags = merge(
    local.common_tags,
    {
      Name      = "${local.name_prefix}-alb"
      Component = "LoadBalancer"
    }
  )
}

# =============================================================================
# コンテナ実行環境設定 (ECS Fargate)
# =============================================================================

# ECSモジュール呼び出し
# - Fargateを使用したサーバーレスコンテナ実行環境
module "ecs" {
  source = "../../modules/ecs"

  # === 基本設定 ===
  cluster_name           = "${local.name_prefix}-cluster"
  task_definition_family = "${local.name_prefix}-task"
  service_name           = "${local.name_prefix}-service"

  # === リソース設定 ===
  cpu    = var.ecs_task_cpu
  memory = var.ecs_task_memory

  # === コンテナ設定 ===
  container_name  = "${local.name_prefix}-app"
  container_image = var.container_image
  container_port  = var.app_port

  # === ネットワーク設定 ===
  network_configuration = {
    subnets = [
      for i in range(length(var.availability_zones)) :
      module.vpc.subnets["private-${i + 1}"].id
    ]
    security_groups  = [module.vpc.security_groups["ecs_sg"].id]
    assign_public_ip = false
  }

  # === ロードバランサー連携 ===
  target_group_arn = module.alb.target_group_arn

  # === ログ設定 ===
  log_retention_in_days = var.log_retention_days

  # === タグ設定 ===
  tags = merge(
    local.common_tags,
    {
      Name      = "${local.name_prefix}-ecs"
      Component = "Container"
    }
  )
}
