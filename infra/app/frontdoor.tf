# Application-specific config on the shared Azure Front Door

data "azurerm_cdn_frontdoor_profile" "shared" {
  name                = var.shared_frontdoor_profile_name
  resource_group_name = var.shared_resource_group_name
}

data "azurerm_subscription" "current" {
}

resource "azurerm_cdn_frontdoor_endpoint" "this" {
  name                     = "fde-${local.name}"
  cdn_frontdoor_profile_id = data.azurerm_cdn_frontdoor_profile.shared.id

  tags = local.minimum_resource_tags
}

# destiny-repository API (Container App in its own resource group)
# TODO: consider adding Front Door to destiny-repository instead, so the API
# owns its own routing and consumers just reference a stable URL.
data "azurerm_container_app" "api" {
  name                = var.destiny_repository_container_app_name
  resource_group_name = var.destiny_repository_resource_group_name
}

# Origin groups

resource "azurerm_cdn_frontdoor_origin_group" "api" {
  name                     = "og-api-${local.name}"
  cdn_frontdoor_profile_id = data.azurerm_cdn_frontdoor_profile.shared.id

  load_balancing {
    sample_size                 = 4
    successful_samples_required = 3
  }

  health_probe {
    path                = "/health"
    protocol            = "Https"
    interval_in_seconds = 30
  }
}

resource "azurerm_cdn_frontdoor_origin_group" "frontend" {
  name                     = "og-frontend-${local.name}"
  cdn_frontdoor_profile_id = data.azurerm_cdn_frontdoor_profile.shared.id

  load_balancing {
    sample_size                 = 4
    successful_samples_required = 3
  }
}

# Origin
resource "azurerm_cdn_frontdoor_origin" "frontend" {
  name                          = "o-frontend-${local.name}"
  cdn_frontdoor_origin_group_id = azurerm_cdn_frontdoor_origin_group.frontend.id

  enabled                        = true
  host_name                      = azurerm_storage_account.frontend.primary_web_host
  http_port                      = 80
  https_port                     = 443
  origin_host_header             = azurerm_storage_account.frontend.primary_web_host
  certificate_name_check_enabled = true
}

resource "azurerm_cdn_frontdoor_origin" "api" {
  name                          = "o-api-${local.name}"
  cdn_frontdoor_origin_group_id = azurerm_cdn_frontdoor_origin_group.api.id

  enabled                        = true
  host_name                      = data.azurerm_container_app.api.ingress[0].fqdn
  http_port                      = 80
  https_port                     = 443
  origin_host_header             = data.azurerm_container_app.api.ingress[0].fqdn
  certificate_name_check_enabled = true
}

# API proxy route — keeps requests same-origin, avoids CORS
resource "azurerm_cdn_frontdoor_route" "api" {
  name                          = "rt-api-${local.name}"
  cdn_frontdoor_endpoint_id     = azurerm_cdn_frontdoor_endpoint.this.id
  cdn_frontdoor_origin_group_id = azurerm_cdn_frontdoor_origin_group.api.id
  cdn_frontdoor_origin_ids      = [azurerm_cdn_frontdoor_origin.api.id]

  supported_protocols    = ["Http", "Https"]
  patterns_to_match      = ["/api/*"]
  forwarding_protocol    = "HttpsOnly"
  link_to_default_domain = true
  https_redirect_enabled = true

  cdn_frontdoor_custom_domain_ids = [azurerm_cdn_frontdoor_custom_domain.this.id]
}

# SPA catch-all route
resource "azurerm_cdn_frontdoor_route" "frontend" {
  name                          = "rt-frontend-${local.name}"
  cdn_frontdoor_endpoint_id     = azurerm_cdn_frontdoor_endpoint.this.id
  cdn_frontdoor_origin_group_id = azurerm_cdn_frontdoor_origin_group.frontend.id
  cdn_frontdoor_origin_ids      = [azurerm_cdn_frontdoor_origin.frontend.id]

  supported_protocols    = ["Http", "Https"]
  patterns_to_match      = ["/*"]
  forwarding_protocol    = "HttpsOnly"
  link_to_default_domain = true
  https_redirect_enabled = true

  cdn_frontdoor_custom_domain_ids = [azurerm_cdn_frontdoor_custom_domain.this.id]
  cdn_frontdoor_rule_set_ids      = [azurerm_cdn_frontdoor_rule_set.cache.id]

  cache {
    query_string_caching_behavior = "IgnoreQueryString"
    compression_enabled           = true
    content_types_to_compress     = ["text/html", "application/javascript", "text/css", "application/json"]
  }
}

# Cache rules — hashed assets cached aggressively, HTML revalidates every time
resource "azurerm_cdn_frontdoor_rule_set" "cache" {
  name                     = "cache${replace(local.name, "-", "")}"
  cdn_frontdoor_profile_id = data.azurerm_cdn_frontdoor_profile.shared.id
}

# Hashed static assets (JS, CSS, fonts, images) — long-lived cache
resource "azurerm_cdn_frontdoor_rule" "cache_assets" {
  name                      = "CacheAssets"
  cdn_frontdoor_rule_set_id = azurerm_cdn_frontdoor_rule_set.cache.id
  order                     = 1
  behavior_on_match         = "Stop"

  conditions {
    url_file_extension_condition {
      operator     = "Equal"
      match_values = ["js", "css", "woff", "woff2", "png", "jpg", "svg", "ico"]
    }
  }

  actions {
    route_configuration_override_action {
      cache_behavior                = "OverrideAlways"
      cache_duration                = "30.00:00:00"
      compression_enabled           = true
      query_string_caching_behavior = "IgnoreQueryString"
    }
    response_header_action {
      header_action = "Overwrite"
      header_name   = "Cache-Control"
      value         = "public, max-age=2592000, immutable"
    }
  }
}

# HTML files: browser revalidates with Front Door each time
resource "azurerm_cdn_frontdoor_rule" "html_no_cache" {
  name                      = "HtmlNoCache"
  cdn_frontdoor_rule_set_id = azurerm_cdn_frontdoor_rule_set.cache.id
  order                     = 2
  behavior_on_match         = "Stop"

  conditions {
    url_file_extension_condition {
      operator     = "Equal"
      match_values = ["html"]
    }
  }

  actions {
    response_header_action {
      header_action = "Overwrite"
      header_name   = "Cache-Control"
      value         = "no-cache"
    }
  }
}

# Catch-all: everything not matched above revalidates on every request
resource "azurerm_cdn_frontdoor_rule" "default_no_cache" {
  name                      = "DefaultNoCache"
  cdn_frontdoor_rule_set_id = azurerm_cdn_frontdoor_rule_set.cache.id
  order                     = 3

  actions {
    response_header_action {
      header_action = "Overwrite"
      header_name   = "Cache-Control"
      value         = "no-cache"
    }
  }
}

# GitHub Actions needs permission to purge cache on deploy
data "azurerm_role_definition" "cdn_purge" {
  name  = "CDN Front Door Purge"
  scope = data.azurerm_subscription.current.id
}

resource "azurerm_role_assignment" "gha_cdn_purger" {
  role_definition_id = data.azurerm_role_definition.cdn_purge.role_definition_id
  scope              = data.azurerm_cdn_frontdoor_profile.shared.id
  principal_id       = azuread_service_principal.github_actions.object_id
}

# Custom domain
resource "azurerm_cdn_frontdoor_custom_domain" "this" {
  name                     = replace(local.custom_domain, ".", "-")
  cdn_frontdoor_profile_id = data.azurerm_cdn_frontdoor_profile.shared.id
  host_name                = local.custom_domain

  tls {
    certificate_type = "ManagedCertificate"
  }
}

resource "azurerm_cdn_frontdoor_custom_domain_association" "this" {
  cdn_frontdoor_custom_domain_id = azurerm_cdn_frontdoor_custom_domain.this.id
  cdn_frontdoor_route_ids = [
    azurerm_cdn_frontdoor_route.frontend.id,
    azurerm_cdn_frontdoor_route.api.id,
  ]
}

# --- DNS (DNSimple) ---

resource "dnsimple_zone_record" "cname" {
  zone_name = var.custom_domain
  name      = var.subdomain
  type      = "CNAME"
  value     = azurerm_cdn_frontdoor_endpoint.this.host_name
  ttl       = 3600
}

resource "dnsimple_zone_record" "validation" {
  zone_name = var.custom_domain
  name      = "_dnsauth.${var.subdomain}"
  type      = "TXT"
  value     = azurerm_cdn_frontdoor_custom_domain.this.validation_token
  ttl       = 3600
}
