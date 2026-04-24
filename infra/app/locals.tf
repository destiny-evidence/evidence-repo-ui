locals {
  name              = "${var.app_name}-${var.environment}"
  environment_short = substr(var.environment, 0, 4)
  name_short        = "evrepoui${local.environment_short}"
  is_production     = var.environment == "production"
  domain_env_label = {
    development = "dev"
    staging     = "staging"
    production  = ""
  }[var.environment]
  custom_domain   = local.is_production ? "${var.subdomain}.${var.custom_domain}" : "${var.subdomain}.${local.domain_env_label}.${var.custom_domain}"
  dns_record_name = local.is_production ? var.subdomain : "${var.subdomain}.${local.domain_env_label}"
}
