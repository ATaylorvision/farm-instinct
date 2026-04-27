from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str | None = Field(default=None, max_length=255)
    preferred_locale: str = Field(default="en", pattern="^(en|es)$")


class UserOut(BaseModel):
    id: int
    email: EmailStr
    full_name: str | None = None
    preferred_locale: str
    is_admin: bool = False

    class Config:
        from_attributes = True


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
