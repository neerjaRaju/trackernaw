variable "name"            { type = string }
variable "vpc_id"          { type = string }
variable "public_subnets"  { type = list(string) }
variable "private_subnets" { type = list(string) }
variable "backend_image"   { type = string }
variable "admin_image"     { type = string }
variable "database_url"    { type = string }
variable "redis_url"       { type = string }
variable "jwt_secret" {
  type      = string
  sensitive = true
}
variable "jwt_refresh_secret" {
  type      = string
  sensitive = true
}
variable "s3_bucket"       { type = string }
variable "cors_origin"     { type = string }
variable "certificate_arn" {
  type        = string
  description = "ACM certificate ARN for HTTPS listener"
}
variable "kafka_brokers"   { type = string, default = "" }
variable "backend_cpu"     { type = number, default = 512 }
variable "backend_memory"  { type = number, default = 1024 }
variable "backend_desired" { type = number, default = 2 }
variable "backend_min"     { type = number, default = 2 }
variable "backend_max"     { type = number, default = 10 }

data "aws_region" "current" {}

# ---------- ECS cluster ----------
resource "aws_ecs_cluster" "this" {
  name = var.name
  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

# ---------- ALB ----------
resource "aws_security_group" "alb" {
  name   = "${var.name}-alb"
  vpc_id = var.vpc_id
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  egress {
    from_port = 0; to_port = 0; protocol = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_lb" "this" {
  name               = "${var.name}-alb"
  load_balancer_type = "application"
  subnets            = var.public_subnets
  security_groups    = [aws_security_group.alb.id]
  enable_deletion_protection = true
  drop_invalid_header_fields = true
}

resource "aws_lb_target_group" "backend" {
  name        = "${var.name}-backend"
  port        = 4000
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"
  deregistration_delay = 30
  health_check {
    path                = "/health/ready"
    matcher             = "200"
    interval            = 15
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }
}

# HTTP → HTTPS redirect
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.this.arn
  port              = 80
  protocol          = "HTTP"
  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

# HTTPS terminator
resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.this.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.certificate_arn
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn
  }
}

# ---------- ECS task IAM roles ----------
resource "aws_iam_role" "task_exec" {
  name = "${var.name}-task-exec"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{ Effect = "Allow", Principal = { Service = "ecs-tasks.amazonaws.com" }, Action = "sts:AssumeRole" }]
  })
}
resource "aws_iam_role_policy_attachment" "task_exec" {
  role       = aws_iam_role.task_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role" "task" {
  name = "${var.name}-task"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{ Effect = "Allow", Principal = { Service = "ecs-tasks.amazonaws.com" }, Action = "sts:AssumeRole" }]
  })
}
resource "aws_iam_role_policy" "task_app" {
  name = "${var.name}-task-app"
  role = aws_iam_role.task.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject", "s3:GetObject", "s3:DeleteObject", "s3:ListBucket"
        ]
        Resource = ["arn:aws:s3:::${var.s3_bucket}", "arn:aws:s3:::${var.s3_bucket}/*"]
      },
      {
        Effect   = "Allow"
        Action   = ["rekognition:CompareFaces", "rekognition:DetectFaces"]
        Resource = "*"
      },
      {
        Effect   = "Allow"
        Action   = ["textract:AnalyzeExpense", "textract:AnalyzeDocument"]
        Resource = "*"
      },
    ]
  })
}

# ---------- CloudWatch log group ----------
resource "aws_cloudwatch_log_group" "backend" {
  name              = "/ecs/${var.name}/backend"
  retention_in_days = 30
}
resource "aws_cloudwatch_log_group" "worker" {
  name              = "/ecs/${var.name}/worker"
  retention_in_days = 30
}

# ---------- Backend service security group ----------
resource "aws_security_group" "backend" {
  name   = "${var.name}-backend"
  vpc_id = var.vpc_id
  ingress {
    from_port       = 4000
    to_port         = 4000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }
  egress {
    from_port = 0; to_port = 0; protocol = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# ---------- Backend task definition ----------
resource "aws_ecs_task_definition" "backend" {
  family                   = "${var.name}-backend"
  cpu                      = var.backend_cpu
  memory                   = var.backend_memory
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  execution_role_arn       = aws_iam_role.task_exec.arn
  task_role_arn            = aws_iam_role.task.arn

  container_definitions = jsonencode([{
    name      = "backend"
    image     = var.backend_image
    essential = true
    portMappings = [{ containerPort = 4000, protocol = "tcp" }]
    environment = [
      { name = "NODE_ENV",     value = "production" },
      { name = "PORT",         value = "4000" },
      { name = "DATABASE_URL", value = var.database_url },
      { name = "REDIS_URL",    value = var.redis_url },
      { name = "JWT_SECRET",         value = var.jwt_secret },
      { name = "JWT_REFRESH_SECRET", value = var.jwt_refresh_secret },
      { name = "CORS_ORIGIN",  value = var.cors_origin },
      { name = "S3_BUCKET",    value = var.s3_bucket },
      { name = "AWS_REGION",   value = data.aws_region.current.name },
      { name = "KAFKA_BROKERS", value = var.kafka_brokers },
    ]
    healthCheck = {
      command     = ["CMD-SHELL", "wget -qO- http://localhost:4000/health/live || exit 1"]
      interval    = 15
      timeout     = 5
      retries     = 3
      startPeriod = 30
    }
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.backend.name
        awslogs-region        = data.aws_region.current.name
        awslogs-stream-prefix = "backend"
      }
    }
  }])
}

# ---------- Backend service ----------
resource "aws_ecs_service" "backend" {
  name                   = "${var.name}-backend"
  cluster                = aws_ecs_cluster.this.id
  task_definition        = aws_ecs_task_definition.backend.arn
  desired_count          = var.backend_desired
  launch_type            = "FARGATE"
  enable_execute_command = true

  network_configuration {
    subnets          = var.private_subnets
    security_groups  = [aws_security_group.backend.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.backend.arn
    container_name   = "backend"
    container_port   = 4000
  }

  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200
  depends_on = [aws_lb_listener.https]
}

# ---------- Worker task (Kafka consumer) ----------
resource "aws_ecs_task_definition" "worker" {
  family                   = "${var.name}-worker"
  cpu                      = 256
  memory                   = 512
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  execution_role_arn       = aws_iam_role.task_exec.arn
  task_role_arn            = aws_iam_role.task.arn

  container_definitions = jsonencode([{
    name      = "worker"
    image     = var.backend_image
    essential = true
    command   = ["node", "src/worker.js"]
    environment = [
      { name = "NODE_ENV",      value = "production" },
      { name = "DATABASE_URL",  value = var.database_url },
      { name = "REDIS_URL",     value = var.redis_url },
      { name = "KAFKA_BROKERS", value = var.kafka_brokers },
      { name = "JWT_SECRET",    value = var.jwt_secret },
      { name = "JWT_REFRESH_SECRET", value = var.jwt_refresh_secret },
    ]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.worker.name
        awslogs-region        = data.aws_region.current.name
        awslogs-stream-prefix = "worker"
      }
    }
  }])
}
resource "aws_ecs_service" "worker" {
  name            = "${var.name}-worker"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.worker.arn
  desired_count   = 1
  launch_type     = "FARGATE"
  network_configuration {
    subnets          = var.private_subnets
    security_groups  = [aws_security_group.backend.id]
    assign_public_ip = false
  }
}

# ---------- Autoscaling for the backend ----------
resource "aws_appautoscaling_target" "backend" {
  max_capacity       = var.backend_max
  min_capacity       = var.backend_min
  resource_id        = "service/${aws_ecs_cluster.this.name}/${aws_ecs_service.backend.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}
resource "aws_appautoscaling_policy" "backend_cpu" {
  name               = "${var.name}-backend-cpu"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.backend.resource_id
  scalable_dimension = aws_appautoscaling_target.backend.scalable_dimension
  service_namespace  = aws_appautoscaling_target.backend.service_namespace
  target_tracking_scaling_policy_configuration {
    predefined_metric_specification { predefined_metric_type = "ECSServiceAverageCPUUtilization" }
    target_value       = 65
    scale_in_cooldown  = 120
    scale_out_cooldown = 30
  }
}
resource "aws_appautoscaling_policy" "backend_alb_rps" {
  name               = "${var.name}-backend-alb-rps"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.backend.resource_id
  scalable_dimension = aws_appautoscaling_target.backend.scalable_dimension
  service_namespace  = aws_appautoscaling_target.backend.service_namespace
  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ALBRequestCountPerTarget"
      resource_label         = "${aws_lb.this.arn_suffix}/${aws_lb_target_group.backend.arn_suffix}"
    }
    target_value       = 500
    scale_in_cooldown  = 120
    scale_out_cooldown = 30
  }
}

# ---------- WAF ----------
resource "aws_wafv2_web_acl" "this" {
  name        = "${var.name}-waf"
  scope       = "REGIONAL"
  default_action { allow {} }

  rule {
    name     = "AWSManagedCommonRuleSet"
    priority = 1
    override_action { none {} }
    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "CommonRules"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "RateLimitPerIP"
    priority = 2
    action { block {} }
    statement {
      rate_based_statement {
        limit              = 2000
        aggregate_key_type = "IP"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "RateLimit"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${var.name}-waf"
    sampled_requests_enabled   = true
  }
}
resource "aws_wafv2_web_acl_association" "alb" {
  resource_arn = aws_lb.this.arn
  web_acl_arn  = aws_wafv2_web_acl.this.arn
}

# ---------- CloudFront for the admin SPA (served from S3 or separate ALB) ----------
# For brevity this scaffolds an S3-origin distribution; if you instead serve the
# admin from the ALB it can target the same target group on a path rule.
resource "aws_s3_bucket" "admin" {
  bucket = "${var.name}-admin-spa"
  force_destroy = false
}
resource "aws_cloudfront_origin_access_identity" "admin" {
  comment = "${var.name} admin SPA OAI"
}
resource "aws_cloudfront_distribution" "admin" {
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  price_class         = "PriceClass_100"

  origin {
    domain_name = aws_s3_bucket.admin.bucket_regional_domain_name
    origin_id   = "admin-s3"
    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.admin.cloudfront_access_identity_path
    }
  }

  default_cache_behavior {
    target_origin_id       = "admin-s3"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    forwarded_values { query_string = false; cookies { forward = "none" } }
    min_ttl     = 0
    default_ttl = 3600
    max_ttl     = 86400
  }

  # SPA fallback so /any/route serves index.html
  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }

  restrictions { geo_restriction { restriction_type = "none" } }
  viewer_certificate { cloudfront_default_certificate = true }
}

output "backend_url" { value = "https://${aws_lb.this.dns_name}" }
output "admin_url"   { value = "https://${aws_cloudfront_distribution.admin.domain_name}" }
output "cluster"     { value = aws_ecs_cluster.this.name }
output "admin_bucket"{ value = aws_s3_bucket.admin.id }
