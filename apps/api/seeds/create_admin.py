from pathlib import Path
import sys

# Asegurar imports
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from dotenv import load_dotenv
load_dotenv(BASE_DIR / ".env")

from sqlalchemy.orm import Session
from app.db import SessionLocal
from app.models import User
from app.security import hash_password


def run():
    db: Session = SessionLocal()
    try:
        email = "admin@rectimocars.com"

        existing = db.query(User).filter(User.email == email).first()
        if existing:
            print("⚠️ Usuario admin ya existe")
            print(f"ID={existing.id} | email={existing.email} | role={existing.role}")
            return

        # Crear usuario SIN password en el constructor
        admin = User(
            email=email,
            role="administrador",
        )

        # Asignar password de forma compatible con el modelo real
        pwd_hash = hash_password("admin123")
        candidates = [
            "password_hash",
            "hashed_password",
            "password_hashed",
            "password",
            "hash",
        ]
        for attr in candidates:
            if hasattr(admin, attr):
                setattr(admin, attr, pwd_hash)
                break
        else:
            cols = [c.name for c in admin.__table__.columns]
            raise TypeError(
                "No se encontró campo de password en User. "
                f"Probados {candidates}. Columnas disponibles: {cols}"
            )

        db.add(admin)
        db.commit()
        db.refresh(admin)

        print("✅ Usuario administrador creado")
        print("Email: admin@rectimocars.com")
        print("Password: admin123")
        print(f"ID={admin.id}")

    finally:
        db.close()


if __name__ == "__main__":
    run()