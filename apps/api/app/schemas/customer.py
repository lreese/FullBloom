"""Pydantic schemas for customer endpoints."""

from pydantic import BaseModel, ConfigDict, field_validator


class StoreResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str


class CustomerListResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    customer_number: int
    name: str
    salesperson: str | None
    contact_name: str | None
    default_ship_via: str | None
    phone: str | None
    location: str | None
    payment_terms: str | None
    email: str | None
    notes: str | None
    price_type: str
    is_active: bool


class CustomerResponse(CustomerListResponse):
    stores: list[StoreResponse]


class CustomerCreateRequest(BaseModel):
    customer_number: int
    name: str
    salesperson: str | None = None
    price_type: str = "Retail"
    contact_name: str | None = None
    default_ship_via: str | None = None
    phone: str | None = None
    location: str | None = None
    payment_terms: str | None = None
    email: str | None = None
    notes: str | None = None

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Name cannot be empty")
        return v.strip()


class CustomerUpdateRequest(BaseModel):
    name: str | None = None
    salesperson: str | None = None
    price_type: str | None = None
    contact_name: str | None = None
    default_ship_via: str | None = None
    phone: str | None = None
    location: str | None = None
    payment_terms: str | None = None
    email: str | None = None
    notes: str | None = None

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str | None) -> str | None:
        if v is not None and not v.strip():
            raise ValueError("Name cannot be empty")
        return v.strip() if v is not None else None


class DropdownOptionsResponse(BaseModel):
    salesperson: list[str]
    default_ship_via: list[str]
    payment_terms: list[str]
    price_type: list[str]


class NextNumberResponse(BaseModel):
    next_number: int
