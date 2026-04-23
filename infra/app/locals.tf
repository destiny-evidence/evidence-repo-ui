locals {
  name          = "${var.app_name}-${var.environment}"
  environment_short = var.environment == "development" ? "dev" : var.environment
  name_short    = substr("${replace(var.app_name, "-", "")}${local.environment_short}", 0, 22)
  is_production     = var.environment == "production"
  custom_domain     = local.is_production ? "${var.subdomain}.${var.custom_domain}" : "${var.subdomain}.${local.environment_short}.${var.custom_domain}"
  dns_record_name   = local.is_production ? var.subdomain : "${var.subdomain}.${local.environment_short}"

}
