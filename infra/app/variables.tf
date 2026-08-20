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

variable "api_base" {
  description = "destiny-repository API base URL for this environment"
  type        = string
}

variable "shared_keycloak_url" {
  description = "Keycloak base URL (sourced from shared variable set)"
  type        = string
}

variable "keycloak_realm" {
  description = "Keycloak realm name"
  type        = string
  default     = "destiny"
}

variable "keycloak_client_id" {
  description = "Keycloak public client ID for this environment"
  type        = string
}

variable "matomo_url" {
  description = "Matomo instance base URL (e.g. https://futureevidence.matomo.cloud/); same for every environment. Empty disables analytics."
  type        = string
  default     = "https://futureevidence.matomo.cloud/"
}

variable "matomo_site_id" {
  description = "Matomo Site ID for this environment; differs per environment. Empty disables analytics."
  type        = string
  default     = ""
}

variable "feedback_form_url" {
  description = "URL of the user feedback form linked from the FAB"
  type        = string
  default     = "https://forms.gle/zH9fsNZk8BApTaVj9"
}

variable "summariser_base" {
  description = "Base URL of the evidence-summariser service; empty hides the AI summaries feature"
  type        = string
  default     = ""
}

variable "ai_summary_flag_form_url" {
  description = "Google Form URL for flagging an AI summary's accuracy; empty hides the flag link"
  type        = string
  default     = ""
}

variable "enrichment_form_url" {
  description = "Google Forms pre-filled link for coding requests, with {referenceUrl}, {name} and {email} placeholders; empty hides the request panel"
  type        = string
  default     = ""
}

variable "esea_vocabulary_url" {
  description = "URL of the ESEA community's published SKOS vocabulary (.jsonld) — used to resolve concept labels in exports and other vocabulary-driven features"
  type        = string
  default     = "https://vocab.evidence-repository.org/published/019d9463-2780-7243-b4de-e547386f2a90/1.1/vocabulary.jsonld"
}

variable "esea_context_url" {
  description = "URL of the ESEA community's JSON-LD @context (.jsonld) — used to expand CURIE prefixes in exports and other vocabulary-driven features"
  type        = string
  default     = "https://vocab.evidence-repository.org/published/019d9463-2780-7243-b4de-e547386f2a90/1.1/context.jsonld"
}

variable "hpv_vocabulary_url" {
  description = "URL of the HPV community's published SKOS vocabulary (.jsonld)"
  type        = string
  default     = "https://vocab.evidence-repository.org/published/019d3e6a-04d6-76e9-9f7a-b8b26c1e0976/2.2/vocabulary.jsonld"
}

variable "hpv_context_url" {
  description = "URL of the HPV community's JSON-LD @context (.jsonld)"
  type        = string
  default     = "https://vocab.evidence-repository.org/published/019d3e6a-04d6-76e9-9f7a-b8b26c1e0976/2.2/context.jsonld"
}


variable "ci_slack_webhook_url" {
  description = "Slack webhook URL for deploy notifications to #destiny-ci"
  type        = string
  sensitive   = true
}
