"""Customer endpoints."""

from fastapi import APIRouter, HTTPException

from app.models.customer import Customer
from app.schemas.customer import CustomerListResponse, CustomerResponse

router = APIRouter(prefix="/api/v1", tags=["customers"])


@router.get("/customers")
async def list_customers(search: str | None = None) -> dict:
    """List all active customers, with optional partial name search."""
    qs = Customer.filter(is_active=True)
    if search:
        qs = qs.filter(name__icontains=search)
    customers = await qs.order_by("name")
    return {
        "data": [
            CustomerListResponse(
                id=str(c.id),
                customer_number=c.customer_number,
                name=c.name,
                price_type=c.price_type,
                is_active=c.is_active,
            )
            for c in customers
        ]
    }


@router.get("/customers/{customer_id}")
async def get_customer(customer_id: str) -> dict:
    """Get a single customer with nested stores."""
    customer = await Customer.get_or_none(id=customer_id).prefetch_related("stores")
    if customer is None:
        raise HTTPException(status_code=404, detail="Customer not found")
    return {
        "data": CustomerResponse(
            id=str(customer.id),
            customer_number=customer.customer_number,
            name=customer.name,
            price_type=customer.price_type,
            is_active=customer.is_active,
            stores=[
                {"id": str(s.id), "name": s.name}
                for s in customer.stores  # type: ignore[attr-defined]
            ],
        )
    }
