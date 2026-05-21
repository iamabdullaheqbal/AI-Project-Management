import secrets
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Database — no default; must be set in environment
    DATABASE_URL: str

    # JWT — no default; must be set in environment
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Mistral — no default; must be set in environment
    MISTRAL_API_KEY: str

    # CORS — comma-separated list of allowed origins
    ALLOWED_ORIGINS: str = "http://localhost:3000"

    # Rate limiting
    LOGIN_RATE_LIMIT: str = "5/minute"
    API_RATE_LIMIT: str = "100/minute"

    @property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]

    def validate_required(self) -> None:
        missing = []
        if not self.DATABASE_URL:
            missing.append("DATABASE_URL")
        if not self.SECRET_KEY or len(self.SECRET_KEY) < 32:
            missing.append("SECRET_KEY (must be at least 32 chars)")
        if not self.MISTRAL_API_KEY:
            missing.append("MISTRAL_API_KEY")
        if missing:
            raise RuntimeError(f"Missing required environment variables: {', '.join(missing)}")


settings = Settings()
settings.validate_required()
