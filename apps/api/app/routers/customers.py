"""Customer endpoints."""

from uuid import UUID

from fastapi import APIRouter, HTTPException

from app.models.customer import Customer
from app.schemas.customer import (
    CustomerCreateRequest,
    CustomerListResponse,
    CustomerResponse,
    CustomerUpdateRequest,
    DropdownOptionsResponse,
    NextNumberResponse,
)
from app.services.customer_service import get_dropdown_options, get_next_customer_number

router = APIRouter(prefix="/api/v1", tags=["customers"])


@router.get("/customers")
async def list_customers(active: bool | None = True) -> dict:
    """List customers filtered by active status."""
    qs = Customer.all()
    if active is not None:
        qs = qs.filter(is_active=active)
    customers = await qs.order_by("name")
    return {
        "data": [
            CustomerListResponse(
                id=str(c.id),
                customer_number=c.customer_number,
                name=c.name,
                salesperson=c.salesperson,
                contact_name=c.contact_name,
                default_ship_via=c.default_ship_via,
                phone=c.phone,
                location=c.location,
                payment_terms=c.payment_terms,
                email=c.email,
                notes=c.notes,
                price_type=c.price_type,
                is_active=c.is_active,
            )
            for c in customers
        ]
    }


@router.get("/customers/next-number")
async def next_customer_number() -> dict:
    """Get the next suggested customer number."""
    next_num = await get_next_customer_number()
    return {"data": NextNumberResponse(next_number=next_num)}


@router.get("/customers/dropdown-options")
async def dropdown_options() -> dict:
    """Get distinct values for dropdown fields."""
    options = await get_dropdown_options()
    return {"data": DropdownOptionsResponse(**options)}


@router.get("/customers/{customer_id}")
async def get_customer(customer_id: UUID) -> dict:
    """Get a single customer with nested stores."""
    customer = await Customer.get_or_none(id=customer_id).prefetch_related("stores")
    if customer is None:
        raise HTTPException(status_code=404, detail="Customer not found")
    return {
        "data": CustomerResponse(
            id=str(customer.id),
            customer_number=customer.customer_number,
            name=customer.name,
            salesperson=customer.salesperson,
            contact_name=customer.contact_name,
            default_ship_via=customer.default_ship_via,
            phone=customer.phone,
            location=customer.location,
            payment_terms=customer.payment_terms,
            email=customer.email,
            notes=customer.notes,
            price_type=customer.price_type,
            is_active=customer.is_active,
            stores=[
                {"id": str(s.id), "name": s.name}
                for s in customer.stores  # type: ignore[attr-defined]
            ],
        )
    }


@router.post("/customers", status_code=201)
async def create_customer(data: CustomerCreateRequest) -> dict:
    """Create a new customer."""
    existing = await Customer.filter(customer_number=data.customer_number).first()
    if existing:
        raise HTTPException(
            status_code=422,
            detail=f"Customer number {data.customer_number} already exists",
        )
    customer = await Customer.create(**data.model_dump())
    return {
        "data": CustomerListResponse(
            id=str(customer.id),
            customer_number=customer.customer_number,
            name=customer.name,
            salesperson=customer.salesperson,
            contact_name=customer.contact_name,
            default_ship_via=customer.default_ship_via,
            phone=customer.phone,
            location=customer.location,
            payment_terms=customer.payment_terms,
            email=customer.email,
            notes=customer.notes,
            price_type=customer.price_type,
            is_active=customer.is_active,
        )
    }


@router.patch("/customers/{customer_id}")
async def update_customer(customer_id: UUID, data: CustomerUpdateRequest) -> dict:
    """Update a customer's fields. Only include fields to change.

    NOTE: CustomerUpdateRequest intentionally excludes is_active, customer_number,
    and id. is_active is managed via /archive and /restore. customer_number and id
    are immutable after creation. Do not add those fields to the update schema.
    """
    customer = await Customer.get_or_none(id=customer_id)
    if customer is None:
        raise HTTPException(status_code=404, detail="Customer not found")

    update_data = data.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=422, detail="No fields to update")

    await customer.update_from_dict(update_data).save()
    return {
        "data": CustomerListResponse(
            id=str(customer.id),
            customer_number=customer.customer_number,
            name=customer.name,
            salesperson=customer.salesperson,
            contact_name=customer.contact_name,
            default_ship_via=customer.default_ship_via,
            phone=customer.phone,
            location=customer.location,
            payment_terms=customer.payment_terms,
            email=customer.email,
            notes=customer.notes,
            price_type=customer.price_type,
            is_active=customer.is_active,
        )
    }


@router.post("/customers/{customer_id}/archive")
async def archive_customer(customer_id: UUID) -> dict:
    """Soft-delete (archive) a customer."""
    customer = await Customer.get_or_none(id=customer_id)
    if customer is None:
        raise HTTPException(status_code=404, detail="Customer not found")
    customer.is_active = False
    await customer.save()
    return {"data": {"id": str(customer.id), "is_active": False}}


@router.post("/customers/{customer_id}/restore")
async def restore_customer(customer_id: UUID) -> dict:
    """Restore an archived customer."""
    customer = await Customer.get_or_none(id=customer_id)
    if customer is None:
        raise HTTPException(status_code=404, detail="Customer not found")
    customer.is_active = True
    await customer.save()
    return {"data": {"id": str(customer.id), "is_active": True}}
