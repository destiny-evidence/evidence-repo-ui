# GitHub Actions OIDC federation for CI/CD

data "azuread_client_config" "current" {
}

# Azure AD application for GitHub Actions
resource "azuread_application_registration" "github_actions" {
  display_name     = "github-actions-${local.name}"
  sign_in_audience = "AzureADMyOrg"
}

resource "azuread_service_principal" "github_actions" {
  client_id                    = azuread_application_registration.github_actions.client_id
  app_role_assignment_required = true
  owners                       = [data.azuread_client_config.current.object_id]
}

# Federated identity credential for GitHub Actions environment
resource "azuread_application_federated_identity_credential" "github" {
  display_name = "gha-${var.app_name}-deploy-${var.environment}"

  application_id = azuread_application_registration.github_actions.id
  audiences      = ["api://AzureADTokenExchange"]
  issuer         = "https://token.actions.githubusercontent.com"
  subject        = "repo:${var.github_repo}:environment:${var.environment}"
}

# GitHub Actions - Resource Group Reader
resource "azurerm_role_assignment" "gha_rg_reader" {
  role_definition_name = "Reader"
  scope                = azurerm_resource_group.this.id
  principal_id         = azuread_service_principal.github_actions.object_id
}

# GitHub Actions - Storage Blob Data Contributor (for deploying frontend)
resource "azurerm_role_assignment" "gha_storage_blob_contributor" {
  role_definition_name = "Storage Blob Data Contributor"
  scope                = azurerm_storage_account.frontend.id
  principal_id         = azuread_service_principal.github_actions.object_id
}

# GitHub Actions - Storage Account Contributor (for listing keys during blob upload)
resource "azurerm_role_assignment" "gha_storage_account_contributor" {
  role_definition_name = "Storage Account Contributor"
  scope                = azurerm_storage_account.frontend.id
  principal_id         = azuread_service_principal.github_actions.object_id
}

# GitHub repository environment for deployment variables
resource "github_repository_environment" "environment" {
  repository  = "evidence-repo-ui"
  environment = var.environment
}

resource "github_actions_environment_variable" "azure_client_id" {
  repository    = github_repository_environment.environment.repository
  environment   = github_repository_environment.environment.environment
  variable_name = "AZURE_CLIENT_ID"
  value         = azuread_application_registration.github_actions.client_id
}

resource "github_actions_environment_variable" "azure_subscription_id" {
  repository    = github_repository_environment.environment.repository
  environment   = github_repository_environment.environment.environment
  variable_name = "AZURE_SUBSCRIPTION_ID"
  value         = data.azurerm_subscription.current.subscription_id
}

resource "github_actions_environment_variable" "azure_tenant_id" {
  repository    = github_repository_environment.environment.repository
  environment   = github_repository_environment.environment.environment
  variable_name = "AZURE_TENANT_ID"
  value         = data.azurerm_subscription.current.tenant_id
}

resource "github_actions_environment_variable" "storage_account_name" {
  repository    = github_repository_environment.environment.repository
  environment   = github_repository_environment.environment.environment
  variable_name = "STORAGE_ACCOUNT_NAME"
  value         = azurerm_storage_account.frontend.name
}

resource "github_actions_environment_variable" "vite_api_base" {
  repository    = github_repository_environment.environment.repository
  environment   = github_repository_environment.environment.environment
  variable_name = "VITE_API_BASE"
  value         = var.api_base
}

resource "github_actions_environment_variable" "vite_keycloak_url" {
  repository    = github_repository_environment.environment.repository
  environment   = github_repository_environment.environment.environment
  variable_name = "VITE_KEYCLOAK_URL"
  value         = var.shared_keycloak_url
}

resource "github_actions_environment_variable" "vite_keycloak_realm" {
  repository    = github_repository_environment.environment.repository
  environment   = github_repository_environment.environment.environment
  variable_name = "VITE_KEYCLOAK_REALM"
  value         = var.keycloak_realm
}

resource "github_actions_environment_variable" "vite_keycloak_client_id" {
  repository    = github_repository_environment.environment.repository
  environment   = github_repository_environment.environment.environment
  variable_name = "VITE_KEYCLOAK_CLIENT_ID"
  value         = var.keycloak_client_id
}

resource "github_actions_environment_variable" "vite_matomo_url" {
  count         = var.matomo_url != "" && var.matomo_site_id != "" ? 1 : 0
  repository    = github_repository_environment.environment.repository
  environment   = github_repository_environment.environment.environment
  variable_name = "VITE_MATOMO_URL"
  value         = var.matomo_url
}

resource "github_actions_environment_variable" "vite_matomo_site_id" {
  count         = var.matomo_url != "" && var.matomo_site_id != "" ? 1 : 0
  repository    = github_repository_environment.environment.repository
  environment   = github_repository_environment.environment.environment
  variable_name = "VITE_MATOMO_SITE_ID"
  value         = var.matomo_site_id
}

resource "github_actions_environment_variable" "vite_feedback_form_url" {
  repository    = github_repository_environment.environment.repository
  environment   = github_repository_environment.environment.environment
  variable_name = "VITE_FEEDBACK_FORM_URL"
  value         = var.feedback_form_url
}

# Empty in environments where the summariser isn't deployed yet, which keeps the
# AI summaries feature hidden (the UI gates on this being set).
resource "github_actions_environment_variable" "vite_summariser_base" {
  count         = var.summariser_base != "" ? 1 : 0
  repository    = github_repository_environment.environment.repository
  environment   = github_repository_environment.environment.environment
  variable_name = "VITE_SUMMARISER_BASE"
  value         = var.summariser_base
}

# Empty until the accuracy-flag form exists; the UI hides the flag link without it.
resource "github_actions_environment_variable" "vite_ai_summary_flag_form_url" {
  count         = var.ai_summary_flag_form_url != "" ? 1 : 0
  repository    = github_repository_environment.environment.repository
  environment   = github_repository_environment.environment.environment
  variable_name = "VITE_AI_SUMMARY_FLAG_FORM_URL"
  value         = var.ai_summary_flag_form_url
}

# Empty until the coding-request form exists; the UI shows the fake door until then.
resource "github_actions_environment_variable" "vite_enrichment_form_url" {
  count         = var.enrichment_form_url != "" ? 1 : 0
  repository    = github_repository_environment.environment.repository
  environment   = github_repository_environment.environment.environment
  variable_name = "VITE_ENRICHMENT_FORM_URL"
  value         = var.enrichment_form_url
}

resource "github_actions_environment_variable" "vite_esea_vocabulary_url" {
  repository    = github_repository_environment.environment.repository
  environment   = github_repository_environment.environment.environment
  variable_name = "VITE_ESEA_VOCABULARY_URL"
  value         = var.esea_vocabulary_url
}

resource "github_actions_environment_variable" "vite_esea_context_url" {
  repository    = github_repository_environment.environment.repository
  environment   = github_repository_environment.environment.environment
  variable_name = "VITE_ESEA_CONTEXT_URL"
  value         = var.esea_context_url
}

resource "github_actions_environment_variable" "vite_hpv_vocabulary_url" {
  repository    = github_repository_environment.environment.repository
  environment   = github_repository_environment.environment.environment
  variable_name = "VITE_HPV_VOCABULARY_URL"
  value         = var.hpv_vocabulary_url
}

resource "github_actions_environment_variable" "vite_hpv_context_url" {
  repository    = github_repository_environment.environment.repository
  environment   = github_repository_environment.environment.environment
  variable_name = "VITE_HPV_CONTEXT_URL"
  value         = var.hpv_context_url
}

resource "github_actions_environment_variable" "frontdoor_resource_group" {
  repository    = github_repository_environment.environment.repository
  environment   = github_repository_environment.environment.environment
  variable_name = "FRONTDOOR_RESOURCE_GROUP"
  value         = var.shared_resource_group_name
}

resource "github_actions_environment_variable" "frontdoor_profile_name" {
  repository    = github_repository_environment.environment.repository
  environment   = github_repository_environment.environment.environment
  variable_name = "FRONTDOOR_PROFILE_NAME"
  value         = data.azurerm_cdn_frontdoor_profile.shared.name
}

resource "github_actions_environment_variable" "frontdoor_endpoint_name" {
  repository    = github_repository_environment.environment.repository
  environment   = github_repository_environment.environment.environment
  variable_name = "FRONTDOOR_ENDPOINT_NAME"
  value         = azurerm_cdn_frontdoor_endpoint.this.name
}

resource "github_actions_environment_variable" "custom_domain" {
  repository    = github_repository_environment.environment.repository
  environment   = github_repository_environment.environment.environment
  variable_name = "CUSTOM_DOMAIN"
  value         = local.custom_domain
}

resource "github_actions_environment_secret" "ci_slack_webhook_url" {
  # Read by the notify job in deploy.yml to announce production deploys.
  repository      = github_repository_environment.environment.repository
  environment     = github_repository_environment.environment.environment
  secret_name     = "CI_SLACK_WEBHOOK_URL"
  plaintext_value = var.ci_slack_webhook_url
}
