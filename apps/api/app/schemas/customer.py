"""Pydantic schemas for customer endpoints."""

from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


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
    price_list_id: str | None
    price_list_name: str | None
    is_active: bool


class CustomerResponse(CustomerListResponse):
    stores: list[StoreResponse]


class CustomerCreateRequest(BaseModel):
    customer_number: int = Field(gt=0)
    name: str = Field(max_length=255)
    salesperson: str | None = Field(None, max_length=10)
    price_list_id: UUID | None = None
    contact_name: str | None = Field(None, max_length=255)
    default_ship_via: str | None = Field(None, max_length=100)
    phone: str | None = Field(None, max_length=50)
    location: str | None = Field(None, max_length=255)
    payment_terms: str | None = Field(None, max_length=50)
    email: str | None = Field(None, max_length=255)
    notes: str | None = None

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Name cannot be empty")
        return v.strip()


class CustomerUpdateRequest(BaseModel):
    name: str | None = Field(None, max_length=255)
    salesperson: str | None = Field(None, max_length=10)
    price_list_id: UUID | None = None
    contact_name: str | None = Field(None, max_length=255)
    default_ship_via: str | None = Field(None, max_length=100)
    phone: str | None = Field(None, max_length=50)
    location: str | None = Field(None, max_length=255)
    payment_terms: str | None = Field(None, max_length=50)
    email: str | None = Field(None, max_length=255)
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


class NextNumberResponse(BaseModel):
    next_number: int
