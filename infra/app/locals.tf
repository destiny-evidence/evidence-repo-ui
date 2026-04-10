locals {
  name          = "${var.app_name}-${var.environment}"
  name_short    = "${replace(var.app_name, "-", "")}${substr(var.environment, 0, 4)}"
  environment_short = substr(var.environment, 0, 4)
  is_production     = var.environment == "production"
  custom_domain     = local.is_production ? "${var.subdomain}.${var.custom_domain}" : "${var.subdomain}.${local.environment_short}.${var.custom_domain}"

  minimum_resource_tags = {
    "Created by"  = var.created_by
    "Environment" = var.environment
    "Owner"       = var.owner
    "Project"     = var.project
    "Region"      = var.region
  }
}
