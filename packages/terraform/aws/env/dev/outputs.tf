# =============================================================================
# Outputs
# =============================================================================

# VPC
output "vpc_id" {
  description = "VPC ID"
  value       = module.vpc.vpc_id
}

# Subnets
output "public_subnet_ids" {
  description = "パブリックサブネットIDのリスト"
  value = [
    for i in range(length(var.availability_zones)) :
    module.vpc.subnets["public-${i + 1}"].id
  ]
}

output "private_subnet_ids" {
  description = "プライベートサブネットIDのリスト"
  value = [
    for i in range(length(var.availability_zones)) :
    module.vpc.subnets["private-${i + 1}"].id
  ]
}

# ALB
output "alb_dns_name" {
  description = "ALBのDNS名（アプリケーションへのアクセスURL）"
  value       = module.alb.alb_dns_name
}

output "alb_zone_id" {
  description = "ALBのZone ID"
  value       = module.alb.alb_zone_id
}

# ECS
output "ecs_cluster_name" {
  description = "ECSクラスター名"
  value       = module.ecs.cluster_name
}

output "ecs_service_name" {
  description = "ECSサービス名"
  value       = module.ecs.service_name
}

# ECR
output "ecr_repository_url" {
  description = "ECRリポジトリURL"
  value       = module.ecr.repository_url
}
