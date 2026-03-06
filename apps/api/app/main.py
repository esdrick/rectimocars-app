from fastapi import FastAPI

from app.auth.router import router as auth_router
from app.customers.router import router as customers_router
from app.work_orders.router import router as work_orders_router

from app.work_order_items.router import router as work_order_items_router

from app.workers.router import router as workers_router
from app.suppliers.router import router as suppliers_router

from app.services.router import router as services_router
from app.engine_models.router import router as engine_models_router
from app.received_parts.router import router as received_parts_router
from app.inventory.router import router as inventory_router, summary_router as inventory_summary_router
from app.inventory.consumables_router import router as inventory_consumables_router
from app.accounts_payable.router import router as accounts_payable_router
from app.reports.router import router as reports_router

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="RectiMocars API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Total-Count"],
)

# Routers
app.include_router(auth_router, prefix="/auth", tags=["auth"])
app.include_router(customers_router, prefix="/customers", tags=["customers"])
app.include_router(work_orders_router, prefix="/work-orders", tags=["work-orders"])
app.include_router(work_order_items_router, prefix="/work-orders", tags=["work-order-items"])
app.include_router(workers_router, prefix="/workers", tags=["workers"])
app.include_router(suppliers_router, prefix="/suppliers", tags=["suppliers"])
app.include_router(services_router)
app.include_router(engine_models_router)
app.include_router(received_parts_router)
app.include_router(inventory_router)
app.include_router(inventory_summary_router)
app.include_router(inventory_consumables_router)
app.include_router(accounts_payable_router)
app.include_router(reports_router)


@app.get("/health")
def health():
    return {"status": "ok"}
