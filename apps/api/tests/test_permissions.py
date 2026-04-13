import pytest
from app.auth.permissions import has_permission, PERMISSIONS


class TestPermissionMatrix:
    def test_admin_has_full_access_to_all_areas(self):
        areas = [
            "users", "orders", "standing_orders", "customers",
            "inventory_counts", "inventory_estimates", "inventory_harvest",
            "inventory_availability", "products", "pricing", "import",
        ]
        for area in areas:
            assert has_permission("admin", area, "read")
            assert has_permission("admin", area, "write")

    def test_salesperson_can_read_and_write_orders(self):
        assert has_permission("salesperson", "orders", "read")
        assert has_permission("salesperson", "orders", "write")

    def test_salesperson_cannot_write_products(self):
        assert has_permission("salesperson", "products", "read")
        assert not has_permission("salesperson", "products", "write")

    def test_salesperson_has_no_access_to_users(self):
        assert not has_permission("salesperson", "users", "read")
        assert not has_permission("salesperson", "users", "write")

    def test_salesperson_has_no_access_to_import(self):
        assert not has_permission("salesperson", "import", "read")
        assert not has_permission("salesperson", "import", "write")

    def test_data_manager_can_read_orders_not_write(self):
        assert has_permission("data_manager", "orders", "read")
        assert not has_permission("data_manager", "orders", "write")

    def test_data_manager_can_write_products(self):
        assert has_permission("data_manager", "products", "read")
        assert has_permission("data_manager", "products", "write")

    def test_data_manager_can_write_import(self):
        assert has_permission("data_manager", "import", "read")
        assert has_permission("data_manager", "import", "write")

    def test_field_worker_can_write_inventory_counts(self):
        assert has_permission("field_worker", "inventory_counts", "read")
        assert has_permission("field_worker", "inventory_counts", "write")

    def test_field_worker_cannot_write_orders(self):
        assert has_permission("field_worker", "orders", "read")
        assert not has_permission("field_worker", "orders", "write")

    def test_field_worker_has_no_access_to_pricing(self):
        assert not has_permission("field_worker", "pricing", "read")
        assert not has_permission("field_worker", "pricing", "write")

    def test_invalid_role_has_no_access(self):
        assert not has_permission("nonexistent", "orders", "read")

    def test_invalid_area_has_no_access(self):
        assert not has_permission("admin", "nonexistent", "read")
