import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import PaymentForm, { type PaymentOut } from "../components/payments/PaymentForm";
import ServiceCreateModal, { type ServiceFormPayload } from "../components/Services/ServiceCreateModal";
import ConsumablesSection from "../components/inventory/ConsumablesSection";

type Customer = {
  id: string;
  name: string;
  phone?: string;
  address?: string;
};

type WorkOrder = {
  id: string;
  order_number?: number;
  // backend puede devolver snake_case o camelCase
  customer_id?: string;
  customerId?: string;
  pricing_tier: "TD" | "SC";
  pricingTier?: "TD" | "SC";
  status?: string;
  created_at?: string;
  createdAt?: string;
  notes?: string | null;
  engine_model_id?: string | null;
  engine_model_label?: string | null;
  offered_for_date?: string | null;
  received_parts?: Array<{ id: string; part_id?: string | null; label: string; notes?: string | null }> | null;
};

type Service = {
  id: string;
  name: string;
  description?: string | null;

  // Compat: algunos backends devuelven flags, otros devuelven strings/null
  uses_cilindraje?: boolean;
  uses_valvulas?: boolean;
  uses_sellos?: boolean;

  // Compat antiguo (si ya existía)
  cilindraje?: string | null;
  valvulas?: string | null;
  sellos?: string | null;
};

type EngineModel = {
  id: string;
  label: string;
  active?: boolean;
};

type ReceivedPart = {
  id: string;
  label: string;
  active?: boolean;
};

type WorkOrderItem = {
  id: string;
  service_id: string;
  description: string;
  qty: number;
  unit_price: number;
  cilindraje?: number | null;
  valvulas?: number | null;
  sellos?: number | null;
};

type Payment = {
  id: string;
  order_id: string;
  amount: string | number;
  currency: string;
  method: string;
  type: string;
  created_at: string;
};

function formatDetailValue(value: number | null | undefined): string {
  return value === null || value === undefined ? "" : String(value);
}

function formatItemDetails(it: WorkOrderItem): string | null {
  const parts: string[] = [];

  if (it.cilindraje !== null && it.cilindraje !== undefined) {
    parts.push(`Cilindraje: ${formatDetailValue(it.cilindraje)}`);
  }
  if (it.valvulas !== null && it.valvulas !== undefined) {
    parts.push(`Válvulas: ${formatDetailValue(it.valvulas)}`);
  }
  if (it.sellos !== null && it.sellos !== undefined) {
    parts.push(`Sellos: ${formatDetailValue(it.sellos)}`);
  }

  return parts.length ? parts.join(" · ") : null;
}

export default function WorkOrderCreate() {
  const navigate = useNavigate();

  // ---------------- API
  const api = useMemo(() => {
    const baseURL =
      (import.meta as any)?.env?.VITE_API_URL ||
      (import.meta as any)?.env?.VITE_API_BASE_URL ||
      "http://127.0.0.1:8000";

    const instance = axios.create({ baseURL });

    instance.interceptors.request.use((config) => {
      const token = localStorage.getItem("token");
      if (token) {
        config.headers = config.headers ?? {};
        (config.headers as any).Authorization = `Bearer ${token}`;
      }
      return config;
    });

    return instance;
  }, []);

  // ---------------- State: messages
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [finalizeError, setFinalizeError] = useState<string | null>(null);
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);

  // ---------------- State: customers
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customersLoading, setCustomersLoading] = useState(true);
  const [customersError, setCustomersError] = useState<string | null>(null);

  const [customerQuery, setCustomerQuery] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [showCustomerPicker, setShowCustomerPicker] = useState(true);

  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [creatingCustomer, setCreatingCustomer] = useState(false);

  // ---------------- State: order
  const [pricingTier, setPricingTier] = useState<"TD" | "SC">("TD");
  const [orderNotes, setOrderNotes] = useState("");
  const [showPricingTierPicker, setShowPricingTierPicker] = useState(true);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [finalizingOrder, setFinalizingOrder] = useState(false);
  const [order, setOrder] = useState<WorkOrder | null>(null);
  const [engineModels, setEngineModels] = useState<EngineModel[]>([]);
  const [engineModelsLoading, setEngineModelsLoading] = useState(false);
  const [engineModelsError, setEngineModelsError] = useState<string | null>(null);
  const [engineModelId, setEngineModelId] = useState("");

  const [receivedParts, setReceivedParts] = useState<ReceivedPart[]>([]);
  const [receivedPartsLoading, setReceivedPartsLoading] = useState(false);
  const [receivedPartsError, setReceivedPartsError] = useState<string | null>(null);
  const [receivedPartIds, setReceivedPartIds] = useState<string[]>([]);
  const [showAddReceivedPart, setShowAddReceivedPart] = useState(false);
  const [newReceivedPartLabel, setNewReceivedPartLabel] = useState("");
  const [creatingReceivedPart, setCreatingReceivedPart] = useState(false);

  const [offeredForDate, setOfferedForDate] = useState("");

  // ---------------- State: services
  const [services, setServices] = useState<Service[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [servicesError, setServicesError] = useState<string | null>(null);

  const [serviceId, setServiceId] = useState("");
  const [qty, setQty] = useState(1);
  const [serviceQuery, setServiceQuery] = useState("");

  // parámetros del item (NULL = "No aplica")
  // Parámetros eliminados: cilindraje, válvulas, sellos
  const [addingItem, setAddingItem] = useState(false);
  const [items, setItems] = useState<WorkOrderItem[]>([]);
  const [enableEditItems, setEnableEditItems] = useState(false);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  const [itemsSnapshot, setItemsSnapshot] = useState<WorkOrderItem[] | null>(null);
  const [savingItems, setSavingItems] = useState(false);
  const [showServiceModal, setShowServiceModal] = useState(false);

  // ---------------- State: payments
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentsError, setPaymentsError] = useState<string | null>(null);


  // ---------------- Derived
  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === customerId) || null,
    [customers, customerId]
  );

  const selectedService = useMemo(
    () => services.find((s) => s.id === serviceId) || null,
    [services, serviceId]
  );



  const filteredCustomers = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    if (!q) return customers;

    return customers.filter((c) => {
      const name = (c.name ?? "").toLowerCase();
      const phone = (c.phone ?? "").toLowerCase();
      return name.includes(q) || phone.includes(q);
    });
  }, [customers, customerQuery]);

  const filteredServices = useMemo(() => {
    const q = serviceQuery.trim().toLowerCase();
    if (!q) return services;

    return services.filter((s) => {
      const name = (s.name ?? "").toLowerCase();
      const description = (s.description ?? "").toLowerCase();
      const cil = s.cilindraje !== undefined && s.cilindraje !== null ? String(s.cilindraje) : "";
      const val = s.valvulas !== undefined && s.valvulas !== null ? String(s.valvulas) : "";
      const sel = s.sellos !== undefined && s.sellos !== null ? String(s.sellos) : "";
      return (
        name.includes(q) ||
        description.includes(q) ||
        cil.includes(q) ||
        val.includes(q) ||
        sel.includes(q)
      );
    });
  }, [services, serviceQuery]);

  const total = useMemo(() => {
    return items.reduce(
      (acc, it) => acc + (Number(it.qty) || 0) * (Number(it.unit_price) || 0),
      0
    );
  }, [items]);

  const paidTotal = useMemo(() => {
    return payments.reduce((acc, p) => {
      const amt = Number(p.amount || 0);
      const t = String(p.type || "").toUpperCase();
      return t === "DEVOLUCION" ? acc - amt : acc + amt;
    }, 0);
  }, [payments]);

  const pendingBalance = useMemo(() => {
    const raw = total - paidTotal;
    return Number.isFinite(raw) ? Math.max(0, raw) : 0;
  }, [total, paidTotal]);

  // ---------------- Helpers
  async function getWithFallback<T>(path: string): Promise<T> {
    try {
      const r = await api.get<T>(path);
      return r.data;
    } catch {
      const r = await api.get<T>(path.endsWith("/") ? path.slice(0, -1) : `${path}/`);
      return r.data;
    }
  }

  async function reloadReceivedParts() {
    const parts = await getWithFallback<ReceivedPart[]>("/received-parts/");
    setReceivedParts(Array.isArray(parts) ? parts : []);
  }

  async function postWithFallback<T>(path: string, payload: any): Promise<T> {
    try {
      const r = await api.post<T>(path, payload);
      return r.data;
    } catch {
      const alt = path.endsWith("/") ? path.slice(0, -1) : `${path}/`;
      const r = await api.post<T>(alt, payload);
      return r.data;
    }
  }

  async function patchWithFallback<T>(path: string, payload: any): Promise<T> {
    try {
      const r = await api.patch<T>(path, payload);
      return r.data;
    } catch {
      const alt = path.endsWith("/") ? path.slice(0, -1) : `${path}/`;
      const r = await api.patch<T>(alt, payload);
      return r.data;
    }
  }

  async function refreshOrderData(orderId: string) {
    const refreshed = await getWithFallback<WorkOrder>(`/work-orders/${orderId}`);
    setOrder((prev) => ({
      ...(prev ?? {}),
      ...refreshed,
      order_number: (refreshed as any).order_number ?? (refreshed as any).orderNumber ?? prev?.order_number,
      customer_id: (refreshed as any).customer_id ?? (refreshed as any).customerId ?? prev?.customer_id,
      pricing_tier: ((refreshed as any).pricing_tier ?? (refreshed as any).pricingTier ?? prev?.pricing_tier ?? "TD") as "TD" | "SC",
      status: (refreshed as any).status ?? prev?.status ?? "DRAFT",
    }));
  }

  async function refreshPayments(orderId: string) {
    setPaymentsLoading(true);
    setPaymentsError(null);
    try {
      const data = await getWithFallback<Payment[]>(`/work-orders/${orderId}/payments`);
      setPayments(Array.isArray(data) ? data : []);
    } catch (e: any) {
      const msg = e?.response?.data?.detail ?? e?.message ?? "No se pudieron cargar los pagos";
      setPaymentsError(String(msg));
      setPayments([]);
    } finally {
      setPaymentsLoading(false);
    }
  }

  async function deleteWithFallback(path: string): Promise<void> {
    try {
      await api.delete(path);
    } catch {
      const alt = path.endsWith("/") ? path.slice(0, -1) : `${path}/`;
      await api.delete(alt);
    }
  }

  // ---------------- Load customers
  useEffect(() => {
    let mounted = true;

    (async () => {
      setCustomersLoading(true);
      setCustomersError(null);

      try {
        const data = await getWithFallback<Customer[]>("/customers/");
        if (!mounted) return;
        setCustomers(Array.isArray(data) ? data : []);
      } catch (e: any) {
        if (!mounted) return;
        const msg =
          e?.response?.data?.detail ?? e?.message ?? "No se pudieron cargar los clientes";
        setCustomersError(String(msg));
      } finally {
        if (!mounted) return;
        setCustomersLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

  // ---------------- Load engine models & received parts
  useEffect(() => {
    let mounted = true;

    (async () => {
      setEngineModelsLoading(true);
      setEngineModelsError(null);
      setReceivedPartsLoading(true);
      setReceivedPartsError(null);

      try {
        const [models, parts] = await Promise.all([
          getWithFallback<EngineModel[]>("/engine-models/"),
          getWithFallback<ReceivedPart[]>("/received-parts/"),
        ]);
        if (!mounted) return;
        setEngineModels(Array.isArray(models) ? models : []);
        setReceivedParts(Array.isArray(parts) ? parts : []);
      } catch (e: any) {
        if (!mounted) return;
        const msg =
          e?.response?.data?.detail ?? e?.message ?? "No se pudieron cargar catálogos";
        setEngineModelsError(String(msg));
        setReceivedPartsError(String(msg));
      } finally {
        if (!mounted) return;
        setEngineModelsLoading(false);
        setReceivedPartsLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

  // ---------------- Load services once order exists
  useEffect(() => {
    if (!order) return;

    let mounted = true;

    (async () => {
      setServicesLoading(true);
      setServicesError(null);

      try {
        const data = await getWithFallback<Service[]>("/services/");
        if (!mounted) return;
        setServices(Array.isArray(data) ? data : []);
      } catch (e: any) {
        if (!mounted) return;
        const msg =
          e?.response?.data?.detail ?? e?.message ?? "No se pudieron cargar los servicios";
        setServicesError(String(msg));
        setServices([]);
      } finally {
        if (!mounted) return;
        setServicesLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, order?.id]);



  // ---------------- Load payments once order exists
  useEffect(() => {
    if (!order) return;

    let mounted = true;

    (async () => {
      setPaymentsLoading(true);
      setPaymentsError(null);

      try {
        const data = await getWithFallback<Payment[]>(`/work-orders/${order.id}/payments`);
        if (!mounted) return;
        setPayments(Array.isArray(data) ? data : []);
      } catch (e: any) {
        if (!mounted) return;
        const msg = e?.response?.data?.detail ?? e?.message ?? "No se pudieron cargar los pagos";
        setPaymentsError(String(msg));
        setPayments([]);
      } finally {
        if (!mounted) return;
        setPaymentsLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, order?.id]);

  // ---------------- Actions
  async function createCustomerInline() {
    setError(null);
    setSuccess(null);

    const name = newName.trim();
    const phone = newPhone.trim();
    const address = newAddress.trim();

    if (!name) {
      setError("El nombre del cliente es obligatorio.");
      return;
    }

    setCreatingCustomer(true);
    try {
      const created = await postWithFallback<Customer>("/customers/", {
        name,
        phone: phone || undefined,
        address: address || undefined,
      });

      const list = await getWithFallback<Customer[]>("/customers/");
      setCustomers(Array.isArray(list) ? list : []);

      // auto-seleccionar y ocultar picker
      setCustomerId(created.id);
      setShowCustomerPicker(false);

      setNewName("");
      setNewPhone("");
      setNewAddress("");
      setCustomerQuery("");

      setSuccess("Cliente creado y seleccionado.");
    } catch (e: any) {
      const msg = e?.response?.data?.detail ?? e?.message ?? "No se pudo crear el cliente";
      setError(String(msg));
    } finally {
      setCreatingCustomer(false);
    }
  }

  async function createOrder() {
    setError(null);
    setSuccess(null);

    if (!customerId) {
      setError("Selecciona un cliente (o crea uno nuevo).");
      return;
    }

    setCreatingOrder(true);
    try {
      const data = await postWithFallback<WorkOrder>("/work-orders/", {
        // El backend crea en DRAFT por defecto (si lo ignora, igual queda coherente)
        status: "DRAFT",
        // enviamos ambos por compatibilidad
        customer_id: customerId,
        customerId: customerId,
        pricing_tier: pricingTier,
        pricingTier: pricingTier,
        engine_model_id: engineModelId || undefined,
        offered_for_date: offeredForDate || undefined,
        received_part_ids: receivedPartIds.length ? receivedPartIds : undefined,
        // notas generales de la orden (opcional)
        notes: orderNotes.trim() || undefined,
      });

      const normalized: WorkOrder = {
        ...data,
        order_number: (data as any).order_number ?? (data as any).orderNumber,
        customer_id: data.customer_id ?? (data as any).customerId ?? customerId,
        pricing_tier: (data.pricing_tier ?? (data as any).pricingTier ?? pricingTier) as "TD" | "SC",
        status: (data as any).status ?? "DRAFT",
      };

      setOrder(normalized);
      setShowPricingTierPicker(false);
      setItems([]);
      // mantener notas por si quieres que queden, pero al crear ya están enviadas
      // si prefieres limpiar, descomenta:
      // setOrderNotes("");
      setSuccess("Orden creada como borrador. Ahora agrega servicios abajo.");
    } catch (e: any) {
      const msg = e?.response?.data?.detail ?? e?.message ?? "No se pudo crear la orden";
      setError(String(msg));
    } finally {
      setCreatingOrder(false);
    }
  }


  async function addServiceToOrder(e: React.FormEvent) {
    e.preventDefault();
    if (!order) return;

    setError(null);
    setSuccess(null);

    if (!serviceId) {
      setError("Selecciona un servicio.");
      return;
    }

    if (!Number.isFinite(qty) || qty <= 0) {
      setError("La cantidad debe ser mayor a 0.");
      return;
    }

    setAddingItem(true);
    try {
      const existing = items.find(
        (it) =>
          it.service_id === serviceId
      );
      if (existing && existing.id) {
        const nextQty = Number(existing.qty || 0) + Number(qty || 0);
        await patchWithFallback(`/work-orders/items/${existing.id}`, { qty: nextQty });
      } else {
        const svc = services.find((s) => s.id === serviceId);
        const createdItem = await postWithFallback<WorkOrderItem>(
          `/work-orders/${order.id}/items`,
          {
            service_id: serviceId,
            qty,
            // En tu DB description es NOT NULL
            description: svc?.name ?? "Servicio",
          }
        );

        if (createdItem && createdItem.id) {
          setItems((prev) => [createdItem, ...prev]);
        } else {
          setItems((prev) => [
            {
              id: crypto.randomUUID(),
              service_id: serviceId,
              description: svc?.name ?? "Servicio",
              qty,
              unit_price: 0,
            },
            ...prev,
          ]);
        }
      }

      setServiceId("");
      setQty(1);
      setServiceQuery("");
      setSuccess("Servicio agregado.");
      setFinalizeError(null);
      if (order) {
        const refreshed = await getWithFallback<WorkOrderItem[]>(`/work-orders/${order.id}/items`);
        setItems(Array.isArray(refreshed) ? refreshed : []);
      }
    } catch (e: any) {
      const msg = e?.response?.data?.detail ?? e?.message ?? "No se pudo agregar el servicio";
      setError(String(msg));
    } finally {
      setAddingItem(false);
    }
  }

  async function saveEditedItems() {
    if (!order || !itemsSnapshot) {
      setEnableEditItems(false);
      return;
    }

    setSavingItems(true);
    setError(null);
    try {
      const changes = items
        .map((it) => {
          const original = itemsSnapshot.find((x) => x.id === it.id);
          const prevQty = Number(original?.qty ?? it.qty);
          const nextQty = Number(it.qty ?? prevQty);
          if (!Number.isFinite(nextQty) || nextQty <= 0) return null;
          if (prevQty === nextQty) return null;
          return { id: it.id, qty: nextQty };
        })
        .filter(Boolean) as Array<{ id: string; qty: number }>;

      for (const change of changes) {
        await patchWithFallback(`/work-orders/items/${change.id}`, { qty: change.qty });
      }

      if (order) {
        const refreshed = await getWithFallback<WorkOrderItem[]>(`/work-orders/${order.id}/items`);
        setItems(Array.isArray(refreshed) ? refreshed : []);
      }
      setItemsSnapshot(null);
      setEnableEditItems(false);
    } catch (e: any) {
      const msg = e?.response?.data?.detail ?? e?.message ?? "No se pudieron guardar los cambios";
      setError(String(msg));
    } finally {
      setSavingItems(false);
    }
  }

  async function handleCreateService(payload: ServiceFormPayload) {
    const created = await postWithFallback<any>("/services/", payload);
    const list = await getWithFallback<Service[]>("/services/");
    setServices(Array.isArray(list) ? list : []);

    if (created?.id) {
      setServiceId(created.id);
    }
  }

  async function deleteItem(itemId: string) {
    if (paidTotal > 0) {
      const confirmed = window.confirm(
        "Esta orden ya tiene pagos registrados. Si eliminas este servicio, el total cambiará y podría generarse una devolución automática. ¿Deseas continuar?"
      );
      if (!confirmed) return;
    }
    setDeletingItemId(itemId);
    setError(null);
    try {
      await deleteWithFallback(`/work-orders/items/${itemId}`);
      if (order) {
        await refreshOrderData(order.id);
        const refreshed = await getWithFallback<WorkOrderItem[]>(`/work-orders/${order.id}/items`);
        setItems(Array.isArray(refreshed) ? refreshed : []);
        await refreshPayments(order.id);
      }
    } catch (e: any) {
      const msg = e?.response?.data?.detail ?? e?.message ?? "No se pudo eliminar el servicio";
      setError(String(msg));
    } finally {
      setDeletingItemId(null);
    }
  }


  async function saveDraft(opts?: { navigateAfter?: boolean }) {
    if (!order) return;

    setError(null);
    setSuccess(null);
    setFinalizeError(null);

    // Guardar como borrador NO debe entrar a cuentas por cobrar.
    // Opcionalmente guardamos el total para que quede consistente.
    try {
      await patchWithFallback<WorkOrder>(`/work-orders/${order.id}`, {
        status: "DRAFT",
        total: total,
      });

      setOrder((prev) => (prev ? { ...prev, status: "DRAFT" } : prev));
      setSuccess("Borrador guardado.");

      const shouldNavigate = opts?.navigateAfter ?? false;
      if (shouldNavigate) {
        navigate("/work-orders");
      }
    } catch (e: any) {
      const msg = e?.response?.data?.detail ?? e?.message ?? "No se pudo guardar el borrador";
      setError(String(msg));
    }
  }

  async function finalizeOrder(opts?: { downloadAfter?: boolean; navigateAfter?: boolean }) {
    if (!order) return;

    setError(null);
    setSuccess(null);
    setFinalizeError(null);

    if (items.length === 0) {
      setFinalizeError("Agrega al menos 1 servicio antes de finalizar.");
      return;
    }

    setFinalizingOrder(true);
    try {
      const updated = await patchWithFallback<WorkOrder>(`/work-orders/${order.id}`, {
        status: "RECIBIDO",
        total: total,
      });

      const normalized: WorkOrder = {
        ...order,
        ...updated,
        order_number: (updated as any).order_number ?? (updated as any).orderNumber ?? order.order_number,
        customer_id:
          (updated as any).customer_id ??
          (updated as any).customerId ??
          order.customer_id ??
          order.customerId ??
          customerId,
        pricing_tier: ((updated as any).pricing_tier ??
          (updated as any).pricingTier ??
          order.pricing_tier) as "TD" | "SC",
        status: (updated as any).status ?? "RECIBIDO",
      };

      setOrder(normalized);
      setSuccess("Orden finalizada (RECIBIDO).");

      if (opts?.downloadAfter) {
        await downloadInvoiceBy(normalized.id, normalized.order_number ?? normalized.id);
      }

      // Cerrar modal si está abierto
      setShowFinalizeModal(false);

      const shouldNavigate = opts?.navigateAfter ?? true;
      if (shouldNavigate) {
        navigate("/dashboard");
      }
    } catch (e: any) {
      const msg = e?.response?.data?.detail ?? e?.message ?? "No se pudo finalizar la orden";
      setError(String(msg));
    } finally {
      setFinalizingOrder(false);
    }
  }

  async function downloadInvoiceBy(orderId: string, orderNumber: string | number) {
    setFinalizeError(null);
    try {
      const res = await api.get(`/work-orders/${orderId}/invoice.pdf`, { responseType: "blob" });
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const number = orderNumber ?? orderId;
      a.href = url;
      a.download = `factura_orden_${number}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setFinalizeError(e?.response?.data?.detail ?? "No se pudo descargar la simulación");
    }
  }

  function resetAll() {
    setOrder(null);
    setShowFinalizeModal(false);
    setShowCustomerPicker(true);
    setShowPricingTierPicker(true);
    setServiceId("");
    setQty(1);
    setServices([]);
    setServicesError(null);
    setPayments([]);
    setPaymentsError(null);
    setError(null);
    setSuccess(null);
    setItems([]);
    setOrderNotes("");
  }

  // ---------------- UI helpers
  function orderLabel(o: WorkOrder) {
    const n = (o as any).order_number ?? (o as any).orderNumber;
    return n ? `#${n}` : `${o.id.slice(0, 8)}…`;
  }
  const cardStyle: React.CSSProperties = {
    marginTop: 12,
    padding: 16,
    border: "1px solid rgba(0,0,0,0.14)",
    borderRadius: 10,
    background: "#fff",
  };

  const softPanelStyle: React.CSSProperties = {
    padding: 12,
    border: "1px solid rgba(0,0,0,0.12)",
    borderRadius: 10,
    background: "#fff",
  };

  const mutedPanelStyle: React.CSSProperties = {
    ...softPanelStyle,
    background: "#fafafa",
  };

  const rowStyle: React.CSSProperties = {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "center",
  };

  const labelStyle: React.CSSProperties = { fontSize: 12, opacity: 0.7 };

  const canFinalize =
    !!order &&
    items.length > 0 &&
    String(order.status ?? "DRAFT").toUpperCase() !== "CERRADO" &&
    !finalizingOrder;

  return (
    <div style={{ padding: 16, maxWidth: 980, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ margin: "0 0 8px" }}>Nueva orden</h2>
          <div style={{ opacity: 0.7, fontSize: 13 }}>Cliente → servicios → pagos</div>
        </div>
        <Link to="/work-orders" className="ui-link-btn">← Volver</Link>
      </div>

      {error && <div className="ui-error" style={{ marginTop: 12 }}>{error}</div>}
      {success && <div className="ui-success" style={{ marginTop: 12 }}>{success}</div>}

      {/* ================= Paso 1: Cliente + tipo ================= */}
      <div style={cardStyle}>
        <h3 style={{ marginTop: 0 }}>Paso 1 · Cliente y tipo</h3>

        {customersLoading ? (
          <p>Cargando clientes…</p>
        ) : customersError ? (
          <div className="ui-error">{customersError}</div>
        ) : (
          <>
            <div style={{ display: "grid", gap: 14 }}>
              {/* Selector de cliente (se oculta al seleccionar) */}
              {!order && showCustomerPicker ? (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.1fr 0.9fr",
                    gap: 12,
                    alignItems: "start",
                  }}
                >
                  {/* IZQUIERDA: buscar + lista */}
                  <div style={{ display: "grid", gap: 10 }}>
                    <label style={{ display: "grid", gap: 6 }}>
                      <span style={labelStyle}>Buscar cliente</span>
                      <input
                        className="ui-control"
                        placeholder="Nombre o teléfono…"
                        value={customerQuery}
                        onChange={(e) => setCustomerQuery(e.target.value)}
                      />
                    </label>

                    <div style={{ display: "grid", gap: 6 }}>
                      <div style={labelStyle}>Clientes</div>
                      <div
                        style={{ ...softPanelStyle, overflow: "hidden", maxHeight: 260, overflowY: "auto", padding: 0 }}
                      >
                        {filteredCustomers.length === 0 ? (
                          <div style={{ padding: 12, opacity: 0.75 }}>No hay coincidencias.</div>
                        ) : (
                          filteredCustomers.map((c) => {
                            const active = c.id === customerId;
                            return (
                      <button
                        key={c.id}
                        type="button"
                                onClick={() => {
                                  setCustomerId(c.id);
                                  setShowCustomerPicker(false);
                                }}
                        className="ui-btn"
                        style={{
                          width: "100%",
                          textAlign: "left",
                          justifyContent: "flex-start",
                          border: "none",
                          borderBottom: "1px solid rgba(0,0,0,0.06)",
                          borderRadius: 0,
                          background: active ? "rgba(0,0,0,0.06)" : "white",
                        }}
                      >
                                <div style={{ fontWeight: 600 }}>{c.name}</div>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>

                  {/* DERECHA: crear cliente nuevo (siempre abierto) */}
                  <div
                    style={{ ...mutedPanelStyle, display: "grid", gap: 8 }}
                  >
                    <div style={{ fontWeight: 700 }}>Cliente nuevo</div>
                    <div style={{ fontSize: 13, opacity: 0.85 }}>
                      Si el cliente no existe, créalo aquí. Se selecciona automáticamente.
                    </div>

                    <label style={{ display: "grid", gap: 6 }}>
                      <span style={labelStyle}>Nombre *</span>
                      <input
                        className="ui-control"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="Ej: Juan Pérez"
                      />
                    </label>

                    <label style={{ display: "grid", gap: 6 }}>
                      <span style={labelStyle}>Teléfono</span>
                      <input
                        className="ui-control"
                        value={newPhone}
                        onChange={(e) => setNewPhone(e.target.value)}
                        placeholder="Ej: 600123123"
                      />
                    </label>

                    <label style={{ display: "grid", gap: 6 }}>
                      <span style={labelStyle}>Dirección</span>
                      <input
                        className="ui-control"
                        value={newAddress}
                        onChange={(e) => setNewAddress(e.target.value)}
                        placeholder="Ej: Av. Principal #123"
                      />
                    </label>

                    <div style={rowStyle}>
                      <button
                        type="button"
                        onClick={createCustomerInline}
                        disabled={creatingCustomer || !newName.trim()}
                        className="ui-btn ui-btn-primary"
                      >
                        {creatingCustomer ? "Creando…" : "Crear cliente"}
                      </button>
                    </div>
                  </div>
                </div>
              ) : !order && customerId ? (
                <div style={{ display: "grid", gap: 10 }}>
                  <div style={{ display: "grid", gap: 4 }}>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>Cliente seleccionado</div>
                    <div style={{ fontSize: 14 }}>
                      <b>{selectedCustomer?.name ?? customerId}</b>
                    </div>
                    <div style={rowStyle}>
                      <button
                        type="button"
                        onClick={() => setShowCustomerPicker(true)}
                        className="ui-btn"
                      >
                        Cambiar cliente
                      </button>
                    </div>
                  </div>

                  {!showPricingTierPicker && (
                    <div style={{ display: "grid", gap: 4 }}>
                      <div style={{ fontSize: 12, opacity: 0.7 }}>Tipo de cliente</div>
                      <div style={{ fontSize: 14 }}>
                        <b>
                          {pricingTier === "TD" ? "TD · Cliente directo" : "SC · Cliente por subcontrato"}
                        </b>
                      </div>
                      <div style={rowStyle}>
                        <button
                          type="button"
                          onClick={() => setShowPricingTierPicker(true)}
                          className="ui-btn"
                        >
                          Cambiar tipo
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}

              {/* Layout compacto: datos a la izquierda, piezas a la derecha */}
              {!order && (
                <div
                  className="workorder-create-meta-layout"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "0.9fr 1.6fr",
                    gap: 12,
                    alignItems: "start",
                  }}
                >
                  {/* LEFT: tipo cliente + tipo motor + ofrecido para */}
                  <div style={{ display: "grid", gap: 12 }}>
                    {showPricingTierPicker && (
                      <label style={{ display: "grid", gap: 6 }}>
                        <span style={labelStyle}>Tipo de cliente</span>
                        <select
                          className="ui-control"
                          value={pricingTier}
                          onChange={(e) => {
                            setPricingTier(e.target.value as "TD" | "SC");
                            setShowPricingTierPicker(false);
                          }}
                        >
                          <option value="TD">TD · Cliente directo</option>
                          <option value="SC">SC · Cliente por subcontrato</option>
                        </select>
                      </label>
                    )}

                    <label style={{ display: "grid", gap: 6 }}>
                      <span style={labelStyle}>Tipo de motor</span>
                      <select
                        className="ui-control"
                        value={engineModelId}
                        onChange={(e) => setEngineModelId(e.target.value)}
                        disabled={engineModelsLoading}
                      >
                        <option value="">Sin seleccionar</option>
                        {engineModels.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                      {engineModelsError ? (
                        <span className="ui-error" style={{ fontSize: 12, marginBottom: 0 }}>
                          {engineModelsError}
                        </span>
                      ) : null}
                    </label>

                    <label style={{ display: "grid", gap: 6 }}>
                      <span style={labelStyle}>Ofrecido para</span>
                      <input
                        type="date"
                        value={offeredForDate}
                        onChange={(e) => setOfferedForDate(e.target.value)}
                        className="ui-control"
                      />
                    </label>
                  </div>

                  {/* RIGHT: piezas recibidas (panel más ancho) */}
                  <div style={{ display: "grid", gap: 6 }}>
                    <div className="workorder-create-parts-header" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={labelStyle}>Piezas recibidas</div>
                      <button
                        type="button"
                        onClick={() => setShowAddReceivedPart((v) => !v)}
                        className="ui-btn"
                        title="Agregar pieza recibida"
                      >
                        +
                      </button>
                    </div>

                    {showAddReceivedPart && (
                      <div className="workorder-create-add-part-row" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <input
                          className="ui-control workorder-create-add-part-input"
                          placeholder="Nueva pieza recibida"
                          value={newReceivedPartLabel}
                          onChange={(e) => setNewReceivedPartLabel(e.target.value)}
                          style={{ minWidth: 220 }}
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            const label = newReceivedPartLabel.trim();
                            if (!label) {
                              setReceivedPartsError("El nombre es obligatorio");
                              return;
                            }
                            setCreatingReceivedPart(true);
                            setReceivedPartsError(null);
                            try {
                              const res = await api.post<ReceivedPart>("/received-parts/", { label });
                              const created = res.data;
                              await reloadReceivedParts();
                              if (created?.id) {
                                setReceivedPartIds((prev) =>
                                  prev.includes(created.id) ? prev : [...prev, created.id]
                                );
                              }
                              setNewReceivedPartLabel("");
                              setShowAddReceivedPart(false);
                            } catch (e: any) {
                              const msg = e?.response?.data?.detail ?? e?.message ?? "No se pudo crear la pieza";
                              setReceivedPartsError(String(msg));
                            } finally {
                              setCreatingReceivedPart(false);
                            }
                          }}
                          disabled={creatingReceivedPart || !newReceivedPartLabel.trim()}
                          className="ui-btn"
                        >
                          {creatingReceivedPart ? "Creando…" : "Crear"}
                        </button>
                      </div>
                    )}

                    {receivedPartsLoading ? (
                      <div style={{ fontSize: 13, opacity: 0.7 }}>Cargando piezas…</div>
                    ) : receivedPartsError ? (
                      <div className="ui-error" style={{ fontSize: 13, marginBottom: 0 }}>
                        {receivedPartsError}
                      </div>
                    ) : receivedParts.length === 0 ? (
                      <div style={{ fontSize: 13, opacity: 0.7 }}>No hay piezas disponibles.</div>
                    ) : (
                      <div
                        className="workorder-create-parts-grid"
                        style={{
                          ...softPanelStyle,
                          display: "grid",
                          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                          gap: 8,
                          padding: 10,
                        }}
                      >
                        {receivedParts.map((p) => {
                          const checked = receivedPartIds.includes(p.id);
                          return (
                            <label key={p.id} className="workorder-create-part-item" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  const next = e.target.checked;
                                  setReceivedPartIds((prev) =>
                                    next ? [...prev, p.id] : prev.filter((x) => x !== p.id)
                                  );
                                }}
                              />
                              <span className="workorder-create-part-label" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {p.label}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Notas de la orden */}
              {!order && (
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={labelStyle}>Notas de la orden (opcional)</span>
                  <textarea
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    placeholder="Ej: Culata con pérdida de compresión, cliente pidió urgencia, traer tornillería…"
                    rows={3}
                    className="ui-control"
                    style={{ resize: "vertical" }}
                  />
                </label>
              )}

              {/* Acción (abajo) */}
              <div style={rowStyle}>
                {!order ? (
                  <button
                    type="button"
                    onClick={createOrder}
                    disabled={creatingOrder || !customerId}
                    className="ui-btn ui-btn-primary"
                  >
                    {creatingOrder ? "Creando orden…" : "Crear orden"}
                  </button>
                ) : null}
              </div>
            </div>
          </>
        )}

        {order && (
          <div
            style={{ ...mutedPanelStyle, marginTop: 12 }}
          >
            <div style={{ display: "grid", gap: 6 }}>
              <div>
                Orden: <b>{orderLabel(order)}</b>
              </div>
              <div>
                Cliente:{" "}
                <b>{selectedCustomer?.name ?? (order.customer_id ?? order.customerId ?? customerId)}</b>
              </div>
              <div>
                Tipo:{" "}
                <b>
                  {order.pricing_tier === "TD"
                    ? "TD · Cliente directo"
                    : order.pricing_tier === "SC"
                    ? "SC · Cliente por subcontrato"
                    : order.pricing_tier}
                </b>
              </div>
              <div>
                Estado: <b>{order.status ?? "DRAFT"}</b>
              </div>
              {orderNotes.trim() && (
                <div style={{ fontSize: 13 }}>
                  Notas: <span style={{ opacity: 0.85 }}>{orderNotes}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ================= Paso 2: Servicios ================= */}
      <div style={cardStyle}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 10,
          }}
        >
          <h3 style={{ marginTop: 0, marginBottom: 0 }}>Paso 2 · Servicios</h3>
          <button type="button" onClick={() => setShowServiceModal(true)} className="ui-btn">
            + Nuevo servicio
          </button>
        </div>

        {!order ? (
          <p style={{ opacity: 0.75 }}>Primero crea la orden para poder agregar servicios.</p>
        ) : (
          <div
            style={{
              marginTop: 12,
              display: "grid",
              gridTemplateColumns: "1.2fr 0.8fr",
              gap: 12,
              alignItems: "start",
            }}
          >
            {/* LEFT: formulario + resumen items */}
            <div style={{ display: "grid", gap: 12 }}>
              {servicesLoading ? (
                <p>Cargando servicios…</p>
              ) : servicesError ? (
                <div className="ui-error">{servicesError}</div>
              ) : services.length === 0 ? (
                <p style={{ opacity: 0.75 }}>No hay servicios disponibles.</p>
              ) : (
                <form onSubmit={addServiceToOrder} style={{ display: "grid", gap: 10 }}>
                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={labelStyle}>Buscar servicio</span>
                    <input
                      className="ui-control"
                      placeholder="Nombre, descripción o parámetros…"
                      value={serviceQuery}
                      onChange={(e) => setServiceQuery(e.target.value)}
                    />
                  </label>

                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={labelStyle}>Servicio *</span>
                    <select
                      className="ui-control"
                      value={serviceId}
                      onChange={(e) => setServiceId(e.target.value)}
                    >
                      <option value="">— Selecciona —</option>
                      {filteredServices.map((s: any) => {
                        const cil = s.cilindraje && s.cilindraje !== "NO_APLICA" ? `Cil ${s.cilindraje}` : null;
                        const val = s.valvulas && s.valvulas !== "NO_APLICA" ? `Val ${s.valvulas}` : null;
                        const sel = s.sellos && s.sellos !== "NO_APLICA" ? `Sel ${s.sellos}` : null;

                        const price =
                          order?.pricing_tier === "SC" ? (s.price_sc ?? s.priceSc) : (s.price_td ?? s.priceTd);

                        const params = [cil, val, sel].filter(Boolean).join(" · ");

                        return (
                          <option key={s.id} value={s.id}>
                            {s.name}
                            {params ? ` · ${params}` : ""}
                            {price ? ` · ${Number(price).toFixed(2)} $` : ""}
                          </option>
                        );
                      })}
                    </select>
                  </label>

                  {/* Detalles del servicio seleccionado */}
                  {selectedService?.description ? (
                    <div style={{ ...mutedPanelStyle, padding: 10, fontSize: 13 }}>
                      <div style={{ opacity: 0.8 }}>{selectedService.description}</div>
                    </div>
                  ) : null}


                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={labelStyle}>Cantidad</span>
                    <input
                      type="number"
                      min={1}
                      value={qty}
                      onChange={(e) => setQty(Number(e.target.value))}
                      className="ui-control"
                    />
                  </label>

                  <div style={rowStyle}>
                    <button type="submit" disabled={addingItem || !serviceId} className="ui-btn ui-btn-primary">
                      {addingItem ? "Agregando…" : "Agregar servicio"}
                    </button>
                  </div>
                </form>
              )}

              {/* Resumen de items (izquierda) */}
              <div
                style={{ ...mutedPanelStyle, display: "grid", gap: 10 }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                  <div style={{ fontWeight: 700 }}>Servicios agregados</div>
                  <div style={{ fontSize: 14 }}>
                    Total: <b>{total.toFixed(2)} $</b>
                  </div>
                </div>

                {items.length === 0 ? (
                  <div style={{ opacity: 0.75, fontSize: 13 }}>Aún no has agregado servicios.</div>
                ) : (
                  <div style={{ display: "grid", gap: 8 }}>
                    {items.slice(0, 8).map((it) => (
                      <div
                        key={it.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 10,
                          borderBottom: "1px solid rgba(0,0,0,0.06)",
                          paddingBottom: 8,
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontWeight: 600,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {it.description}
                          </div>
                          <div style={{ fontSize: 12, opacity: 0.7 }}>
                            {it.qty} × {Number(it.unit_price || 0).toFixed(2)} $
                          </div>
                          {formatItemDetails(it) ? (
                            <div style={{ fontSize: 12, opacity: 0.7 }}>{formatItemDetails(it)}</div>
                          ) : null}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ fontWeight: 700 }}>
                            {(Number(it.qty || 0) * Number(it.unit_price || 0)).toFixed(2)} $
                          </div>
                          {enableEditItems && (
                            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                              <input
                                type="number"
                                min={1}
                                value={it.qty}
                                onChange={(e) => {
                                  const next = Number(e.target.value);
                                  setItems((prev) =>
                                    prev.map((x) => (x.id === it.id ? { ...x, qty: next } : x))
                                  );
                                }}
                                className="ui-control"
                                style={{ width: 70 }}
                              />
                              <button
                                type="button"
                                onClick={() => deleteItem(it.id)}
                                disabled={deletingItemId === it.id}
                                className="ui-btn"
                              >
                                {deletingItemId === it.id ? "Eliminando…" : "Eliminar"}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    {items.length > 8 && (
                      <div style={{ fontSize: 12, opacity: 0.7 }}>
                        Mostrando 8 de {items.length} servicios agregados.
                      </div>
                    )}
                  </div>
                )}

                {items.length > 0 && items.every((x) => Number(x.unit_price || 0) === 0) && (
                  <div style={{ fontSize: 12, opacity: 0.7 }}>
                    Nota: el backend no devolvió precios en la respuesta del item; por eso el total puede verse en 0.
                  </div>
                )}

                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  {items.length === 0 ? null : !enableEditItems ? (
                    <button
                      type="button"
                      onClick={() => {
                        setItemsSnapshot(items.map((x) => ({ ...x })));
                        setEnableEditItems(true);
                      }}
                      className="ui-btn"
                    >
                      Editar servicios
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={saveEditedItems}
                      disabled={savingItems}
                      className="ui-btn ui-btn-primary"
                    >
                      {savingItems ? "Guardando…" : "Guardar cambios"}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* RIGHT: resumen de orden (card) */}
            <div
              style={{ ...softPanelStyle, display: "grid", gap: 10 }}
            >
              <div style={{ fontWeight: 800 }}>Resumen de la orden</div>

              <div style={{ display: "grid", gap: 6, fontSize: 14 }}>
                <div>
                  <span style={{ opacity: 0.7 }}>Orden:</span> <b>{orderLabel(order)}</b>
                </div>
                <div>
                  <span style={{ opacity: 0.7 }}>Cliente:</span>{" "}
                  <b>{selectedCustomer?.name ?? (order.customer_id ?? order.customerId ?? customerId)}</b>
                </div>
                <div>
                  <span style={{ opacity: 0.7 }}>Estado:</span> <b>{order.status ?? "DRAFT"}</b>
                </div>
                <div>
                  <span style={{ opacity: 0.7 }}>Tipo de motor:</span>{" "}
                  <b>{order.engine_model_label ?? "—"}</b>
                </div>
                <div>
                  <span style={{ opacity: 0.7 }}>Ofrecido para:</span>{" "}
                  <b>{order.offered_for_date ?? "—"}</b>
                </div>
                <div>
                  <span style={{ opacity: 0.7 }}>Piezas recibidas:</span>{" "}
                  <b>
                    {order.received_parts && order.received_parts.length > 0
                      ? order.received_parts.map((p) => p.label).join(", ")
                      : "—"}
                  </b>
                </div>
                <div>
                  <span style={{ opacity: 0.7 }}>Servicios:</span> <b>{items.length}</b>
                </div>
                <div>
                  <span style={{ opacity: 0.7 }}>Total:</span> <b>{total.toFixed(2)} $</b>
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
                {/* Ver detalle button removed */}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ================= Paso 3: Insumos (Inventario) ================= */}
      <ConsumablesSection
        orderId={order?.id}
        title="Paso 3 · Insumos (Inventario)"
        emptyMessage="Primero crea la orden para poder agregar insumos."
        containerStyle={cardStyle}
      />

      {/* ================= Pagos ================= */}
      <div style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <h3 style={{ marginTop: 0, marginBottom: 0 }}>Pagos</h3>
          {order && items.length > 0 && (
            <div style={{ fontSize: 14 }}>
              Total pagado: <b>{paidTotal.toFixed(2)} $</b>
            </div>
          )}
        </div>

        <div style={{ marginTop: 12 }}>
          {!order ? (
            <p style={{ opacity: 0.75 }}>Primero crea la orden para poder registrar pagos.</p>
          ) : items.length === 0 ? (
            <div style={{ opacity: 0.75 }}>No hay saldo pendiente</div>
          ) : (
            <>
              <PaymentForm
                orderId={order.id}
                defaultType="ABONO"
                defaultCurrency="USD"
                defaultMethod="EFECTIVO"
                allowedTypes={["ABONO", "FINAL"]}
                allowedMethods={["EFECTIVO", "TRANSFERENCIA", "TARJETA"]}
                compact
                onSuccess={async (p: PaymentOut) => {
                  setPayments((prev) => [p as Payment, ...prev]);
                  try {
                    const refreshed = await getWithFallback<WorkOrder>(`/work-orders/${order.id}`);
                    setOrder((prev) => ({
                      ...(prev ?? {}),
                      ...refreshed,
                      order_number: (refreshed as any).order_number ?? (refreshed as any).orderNumber ?? prev?.order_number,
                      customer_id: (refreshed as any).customer_id ?? (refreshed as any).customerId ?? prev?.customer_id,
                      pricing_tier: ((refreshed as any).pricing_tier ?? (refreshed as any).pricingTier ?? prev?.pricing_tier ?? "TD") as "TD" | "SC",
                      status: (refreshed as any).status ?? prev?.status ?? "DRAFT",
                    }));
                  } catch {
                    // Keep the local payment list even if the follow-up refresh fails.
                  }
                  setSuccess("Pago registrado.");
                }}
              />
            </>
          )}
          {order && items.length > 0 && (
            <div style={{ fontSize: 12, opacity: 0.75, marginTop: 8 }}>
              Saldo pendiente estimado: <b>{pendingBalance.toFixed(2)} $</b>
            </div>
          )}
        </div>

        {order && items.length > 0 && (
          paymentsLoading ? (
            <p style={{ marginTop: 10 }}>Cargando pagos…</p>
          ) : paymentsError ? (
            <div className="ui-error" style={{ marginTop: 10 }}>{paymentsError}</div>
          ) : payments.length === 0 ? (
            <p style={{ marginTop: 10, opacity: 0.75 }}>Aún no hay pagos registrados para esta orden.</p>
          ) : (
            <div style={{ marginTop: 10, overflowX: "auto" }}>
              <table className="ui-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Tipo</th>
                    <th>Método</th>
                    <th style={{ textAlign: "right" }}>Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => {
                    const amt = Number(p.amount || 0);
                    const t = String(p.type || "").toUpperCase();
                    const signed = t === "DEVOLUCION" ? -amt : amt;
                    return (
                      <tr key={p.id}>
                        <td style={{ whiteSpace: "nowrap" }}>
                          {p.created_at ? new Date(p.created_at).toLocaleString() : "—"}
                        </td>
                        <td>{p.type}</td>
                        <td>{p.method}</td>
                        <td style={{ textAlign: "right" }}>
                          {signed.toFixed(2)} {p.currency}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {/* === Final action buttons (al final del todo) === */}
      <div
        style={{
          marginTop: 16,
        }}
      >
        <div
          style={{ ...softPanelStyle, display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap", padding: 16 }}
        >
          <button
            type="button"
            onClick={() => saveDraft({ navigateAfter: true })}
            disabled={!order || finalizingOrder}
            className="ui-btn"
          >
            Guardar borrador
          </button>

          <button
            type="button"
            onClick={() => {
              setFinalizeError(null);
              if (items.length === 0) {
                setFinalizeError("Agrega al menos 1 servicio antes de finalizar.");
                setShowFinalizeModal(false);
                return;
              }
              setShowFinalizeModal(true);
            }}
            disabled={!canFinalize}
            className="ui-btn ui-btn-primary"
          >
            {finalizingOrder ? "Confirmando…" : "Confirmar recepción"}
          </button>

          {/* Ver detalle de la orden button removed */}

          <button
            type="button"
            onClick={resetAll}
            className="ui-btn"
            disabled={!order}
          >
            Crear otra orden
          </button>
        </div>

        {order && finalizeError && (
          <div className="ui-error" style={{ marginTop: 8, fontSize: 13 }}>
            {finalizeError}
          </div>
        )}
      </div>

      {order && showFinalizeModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 1000,
          }}
          onClick={() => {
            if (!finalizingOrder) setShowFinalizeModal(false);
          }}
        >
            <div
              style={{
                position: "relative",
                width: "min(520px, 100%)",
                background: "white",
                borderRadius: 12,
                border: "1px solid rgba(0,0,0,0.12)",
                padding: 16,
                boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
            <div style={{ fontWeight: 800, fontSize: 16 }}>Confirmar recepción</div>
            <div style={{ marginTop: 8, fontSize: 13, opacity: 0.8 }}>
              Elige cómo quieres confirmar la recepción.
            </div>

            {finalizeError && (
              <div className="ui-error" style={{ marginTop: 10, fontSize: 13 }}>{finalizeError}</div>
            )}

            {items.length === 0 && (
              <div
                style={{
                  marginTop: 10,
                  padding: 10,
                  borderRadius: 10,
                  background: "#fff3cd",
                  color: "#664d03",
                  fontSize: 13,
                }}
              >
                Agrega al menos 1 servicio para poder finalizar y generar la nota.
              </div>
            )}

            <div
              style={{
                marginTop: 14,
                display: "flex",
                gap: 10,
                justifyContent: "flex-end",
                flexWrap: "wrap",
              }}
            >
            <button
              type="button"
              onClick={() => {
                if (!finalizingOrder) setShowFinalizeModal(false);
              }}
              disabled={finalizingOrder}
              style={{
                position: "absolute",
                top: 10,
                right: 10,
                border: "none",
                background: "transparent",
                fontSize: 20,
                fontWeight: 600,
                cursor: finalizingOrder ? "not-allowed" : "pointer",
                lineHeight: 1,
              }}
              aria-label="Cerrar"
            >
              ×
            </button>

              <button
                type="button"
                onClick={() => finalizeOrder({ downloadAfter: false, navigateAfter: true })}
                disabled={finalizingOrder || items.length === 0}
                className="ui-btn"
              >
                {finalizingOrder ? "Confirmando…" : "Confirmar y salir"}
              </button>

              <button
                type="button"
                onClick={() => finalizeOrder({ downloadAfter: true, navigateAfter: true })}
                disabled={finalizingOrder || items.length === 0}
                className="ui-btn ui-btn-primary"
              >
                {finalizingOrder ? "Confirmando…" : "Confirmar y descargar ticket"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ServiceCreateModal
        open={showServiceModal}
        onClose={() => setShowServiceModal(false)}
        onSubmit={handleCreateService}
      />
    </div>
  );
}
