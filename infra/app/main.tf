# Core resource group for evidence-repo-ui resources
resource "azurerm_resource_group" "this" {
  name     = "rg-${local.name}"
  location = var.region
  tags = {
    "Environment" = var.environment
  }
}
