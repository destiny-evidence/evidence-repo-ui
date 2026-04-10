variable "app_name" {
  type        = string
  default     = "evidence-repo-ui"
  description = "Application name"
}

variable "environment" {
  description = "The environment this stack is being deployed to (development, staging, production)"
  type        = string
}

variable "region" {
  description = "The Azure region resources will be deployed into"
  type        = string
  default     = "swedencentral"
}

# GitHub Actions
variable "github_repo" {
  type        = string
  default     = "destiny-evidence/evidence-repo-ui"
  description = "GitHub repository for Actions OIDC"
}

variable "github_app_id" {
  description = "GitHub App ID for configuring repository environments"
  type        = string
}

variable "github_app_installation_id" {
  description = "GitHub App installation ID"
  type        = string
}

variable "github_app_pem" {
  description = "GitHub App private key PEM file contents"
  type        = string
  sensitive   = true
}

# Front Door (shared instance)
variable "shared_frontdoor_profile_name" {
  description = "Name of the shared Azure Front Door profile"
  type        = string
}

variable "shared_resource_group_name" {
  description = "The resource group containing shared infrastructure"
  type        = string
}

# DNS (DNSimple)
variable "custom_domain" {
  description = "Base domain (e.g., evidence-repository.org)"
  type        = string
  default     = "evidence-repository.org"
}

variable "subdomain" {
  description = "Subdomain prefix for the UI (e.g., data)"
  type        = string
  default     = "data"
}

variable "dnsimple_token" {
  description = "API token for DNSimple"
  type        = string
  sensitive   = true
}

variable "dnsimple_account_id" {
  description = "DNSimple account ID"
  type        = string
}

# destiny-repository API (looked up via data source)
variable "destiny_repository_container_app_name" {
  description = "Name of the destiny-repository API Container App"
  type        = string
}

variable "destiny_repository_resource_group_name" {
  description = "Resource group containing the destiny-repository API Container App"
  type        = string
}

# Resource tags
variable "budget_code" {
  description = "Budget code for tagging resource groups"
  type        = string
}

variable "created_by" {
  description = "Creator of this infrastructure (for tagging)"
  type        = string
  default     = "Future Evidence Foundation"
}

variable "owner" {
  description = "Owner email for this infrastructure (for tagging)"
  type        = string
}

variable "project" {
  description = "Project name for tagging"
  type        = string
  default     = "DESTINY"
}
