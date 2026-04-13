PERMISSIONS: dict[str, dict[str, str]] = {
    "admin": {
        "users": "rw",
        "orders": "rw",
        "standing_orders": "rw",
        "customers": "rw",
        "inventory_counts": "rw",
        "inventory_estimates": "rw",
        "inventory_harvest": "rw",
        "inventory_availability": "rw",
        "products": "rw",
        "pricing": "rw",
        "import": "rw",
    },
    "salesperson": {
        "orders": "rw",
        "standing_orders": "rw",
        "customers": "rw",
        "inventory_counts": "r",
        "inventory_estimates": "r",
        "inventory_harvest": "rw",
        "inventory_availability": "r",
        "products": "r",
        "pricing": "rw",
    },
    "data_manager": {
        "orders": "r",
        "standing_orders": "r",
        "customers": "rw",
        "inventory_counts": "r",
        "inventory_estimates": "r",
        "inventory_harvest": "rw",
        "inventory_availability": "r",
        "products": "rw",
        "pricing": "rw",
        "import": "rw",
    },
    "field_worker": {
        "orders": "r",
        "standing_orders": "r",
        "customers": "r",
        "inventory_counts": "rw",
        "inventory_estimates": "rw",
        "inventory_harvest": "rw",
        "inventory_availability": "r",
        "products": "r",
    },
}

VALID_ROLES = list(PERMISSIONS.keys())


def has_permission(role: str, area: str, action: str) -> bool:
    role_perms = PERMISSIONS.get(role)
    if role_perms is None:
        return False
    access = role_perms.get(area)
    if access is None:
        return False
    if action == "read":
        return access in ("r", "rw")
    if action == "write":
        return access == "rw"
    return False
