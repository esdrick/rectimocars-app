import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import PaymentForm, { type PaymentOut } from "../components/payments/PaymentForm";
import ConsumablesSection from "../components/inventory/ConsumablesSection";

type Service = {
  id: string;
  name: string;
  description?: string | null;
  uses_cilindraje?: boolean;
  uses_valvulas?: boolean;
  uses_sellos?: boolean;
  cilindraje?: string | null;
  valvulas?: string | null;
  sellos?: string | null;
  price_td?: string | number;
  price_sc?: string | number;
  priceTd?: string | number;
  priceSc?: string | number;
};

type Worker = {
  id: string;
  name: string;
  phone?: string;
  job_role?: string;
  active?: boolean;
  created_at?: string;
};

type WorkOrder = {
  id: string;
  order_number?: number;
  customer_id?: string;
  customer_name?: string;
  customer_phone?: string;
  customer_address?: string;
  pricing_tier?: "TD" | "SC" | string;
  status?: string;
  piece?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  total?: number;
  paid?: number;
  paid_total?: number;
  balance?: number;
  payment_status?: string;
  assigned_worker_id?: string | null;
  assigned_workers?: Array<{ id: string; name: string; job_role?: string | null }>;
  engine_model_id?: string | null;
  engine_model_label?: string | null;
  offered_for_date?: string | null;
  received_parts?: Array<{ id: string; part_id?: string | null; label: string; notes?: string | null }> | null;
};

type WorkOrderItem = {
  id: string;
  work_order_id?: string;
  service_id?: string;
  service_name?: string;
  description?: string;
  qty?: number;
  unit_price?: number;
  subtotal?: number;
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

type MetaHistoryEntry = {
  id: string;
  changed_at: string;
  changed_by?: string | null;
  changes: any;
};

function formatMoney(value: number | undefined) {
  if (value === undefined || value === null) return "—";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "USD",
      currencyDisplay: "narrowSymbol",
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    // Fallback si Intl falla
    return `${value.toFixed(2)}`;
  }
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

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

function formatChangeValue(value: any): string {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

function formatStatusLabel(status: string | null | undefined): string {
  if (!status) return "—";
  return String(status).toUpperCase().replaceAll("_", " ");
}

function isLikelyUuid(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export default function WorkOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

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

  // Helpers to resolve customer and service names
  async function getCustomerName(customerId: string): Promise<{ name?: string; phone?: string; address?: string }> {
    try {
      const r = await api.get(`/customers/${customerId}`);
      return { name: r.data?.name, phone: r.data?.phone, address: r.data?.address };
    } catch {
      return {};
    }
  }

  async function getServiceName(serviceId: string): Promise<string | undefined> {
    try {
      const r = await api.get(`/services/${serviceId}`);
      return r.data?.name;
    } catch {
      return undefined;
    }
  }

  function getReceivedPartId(p: { id: string; part_id?: string | null }) {
    return String(p.part_id ?? p.id);
  }

  const [order, setOrder] = useState<WorkOrder | null>(null);
  const [items, setItems] = useState<WorkOrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentsError, setPaymentsError] = useState<string | null>(null);

  const [showPaymentForm, setShowPaymentForm] = useState(false);

  const [services, setServices] = useState<Service[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [servicesError, setServicesError] = useState<string | null>(null);
  const [serviceId, setServiceId] = useState("");
  const [serviceQuery, setServiceQuery] = useState("");
  const [qty, setQty] = useState(1);
  const [addingItem, setAddingItem] = useState(false);
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  const [showAddItemForm, setShowAddItemForm] = useState(false);
  const [enableEditItems, setEnableEditItems] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [deletingOrder, setDeletingOrder] = useState(false);

  const [workers, setWorkers] = useState<Worker[]>([]);
  const [workersLoading, setWorkersLoading] = useState(false);
  const [workersError, setWorkersError] = useState<string | null>(null);
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>([]);
  const [assigningWorker, setAssigningWorker] = useState(false);

  const [engineModels, setEngineModels] = useState<EngineModel[]>([]);
  const [engineModelsLoading, setEngineModelsLoading] = useState(false);
  const [engineModelsError, setEngineModelsError] = useState<string | null>(null);
  const [receivedParts, setReceivedParts] = useState<ReceivedPart[]>([]);
  const [receivedPartsLoading, setReceivedPartsLoading] = useState(false);
  const [receivedPartsError, setReceivedPartsError] = useState<string | null>(null);

  const [engineModelId, setEngineModelId] = useState("");
  const [offeredForDate, setOfferedForDate] = useState("");
  const [receivedPartIds, setReceivedPartIds] = useState<string[]>([]);
  const [savingMeta, setSavingMeta] = useState(false);
  const [isEditingMeta, setIsEditingMeta] = useState(false);
  const [isEditingAssignments, setIsEditingAssignments] = useState(false);

  const [history, setHistory] = useState<MetaHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const [showHistory, setShowHistory] = useState(false);


  const currentStatus = String(order?.status ?? "DRAFT").toUpperCase();
  const balanceValue = Number(order?.balance ?? 0);
  const isClosed = currentStatus === "CERRADO";
  const hasPendingBalance = Number.isFinite(balanceValue) && Math.abs(balanceValue) > 0.00001;
  const hasItems = items.length > 0;
  const canLeaveDraft = !(currentStatus === "DRAFT" && !hasItems);

  const statusTransitions: Record<string, string[]> = {
    DRAFT: ["DRAFT", "RECIBIDO"],
    RECIBIDO: ["RECIBIDO", "EN_PROCESO"],
    EN_PROCESO: ["EN_PROCESO", "LISTO"],
    LISTO: ["LISTO", "ENTREGADO"],
    ENTREGADO: ["ENTREGADO", "LISTO", "CERRADO"],
    CERRADO: ["CERRADO"],
  };

  const allowedStatuses = statusTransitions[currentStatus] ?? [currentStatus];
  const nextStatusOptions = allowedStatuses
    .filter((s) => s !== currentStatus)
    // UX rule: cannot leave DRAFT without at least one service/item
    .filter((s) => !(currentStatus === "DRAFT" && !hasItems && s === "RECIBIDO"));
  const itemsTotal = useMemo(() => {
    return items.reduce((acc, it) => {
      const qty = Number(it.qty || 0);
      const price = Number(it.unit_price || 0);
      const subtotal =
        it.subtotal !== undefined && it.subtotal !== null
          ? Number(it.subtotal)
          : qty * price;
      return acc + (Number.isFinite(subtotal) ? subtotal : 0);
    }, 0);
  }, [items]);

  const selectedService = useMemo(
    () => services.find((s) => s.id === serviceId),
    [services, serviceId]
  );

  const filteredServices = useMemo(() => {
    const q = serviceQuery.trim().toLowerCase();
    if (!q) return services;
    return services.filter((s) => {
      const params = [s.cilindraje, s.valvulas, s.sellos].filter(Boolean).join(" ");
      const haystack = [s.name, s.description, params].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [services, serviceQuery]);

  const metaHasChanges = useMemo(() => {
    if (!order) return false;
    const originalEngineModelId = String(order.engine_model_id ?? "");
    const originalOfferedForDate = order.offered_for_date ? String(order.offered_for_date) : "";
    const originalReceivedPartIds = Array.from(
      new Set(
        Array.isArray(order.received_parts)
          ? order.received_parts.map((p) => getReceivedPartId(p))
          : []
      )
    ).sort();
    const currentReceivedPartIds = Array.from(new Set(receivedPartIds)).sort();

    return (
      engineModelId !== originalEngineModelId ||
      offeredForDate !== originalOfferedForDate ||
      JSON.stringify(currentReceivedPartIds) !== JSON.stringify(originalReceivedPartIds)
    );
  }, [order, engineModelId, offeredForDate, receivedPartIds]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!id) {
        setError("Falta el ID de la orden en la URL.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // 1) Detalle de la orden
        const res = await api.get<WorkOrder>(`/work-orders/${id}`);
        if (!mounted) return;
        setOrder(res.data);
        setEngineModelId(String(res.data.engine_model_id ?? ""));
        setOfferedForDate(res.data.offered_for_date ? String(res.data.offered_for_date) : "");
        setReceivedPartIds(
          Array.isArray(res.data.received_parts)
            ? res.data.received_parts.map((p) => getReceivedPartId(p))
            : []
        );
        await fetchHistory(res.data.id);
        // Resolve customer name if possible
        if (res.data.customer_id) {
          const info = await getCustomerName(res.data.customer_id);
          if (mounted) {
            setOrder((prev) => prev ? {
              ...prev,
              customer_name: info.name ?? prev.customer_name,
              customer_phone: info.phone ?? prev.customer_phone,
              customer_address: info.address ?? prev.customer_address,
            } : prev);
          }
        }

        // Resolve assigned workers if present
        if (mounted) {
          const ids =
            Array.isArray(res.data.assigned_workers) && res.data.assigned_workers.length > 0
              ? res.data.assigned_workers.map((w) => String(w.id))
              : res.data.assigned_worker_id
              ? [String(res.data.assigned_worker_id)]
              : [];
          setSelectedWorkerIds(ids);
        }

        // 2) Intentar cargar items (si existe endpoint)
        try {
          const itemsRes = await api.get<WorkOrderItem[]>(`/work-orders/${id}/items`);
          if (!mounted) return;
          const enriched = await Promise.all(
            itemsRes.data.map(async (it) => ({
              ...it,
              service_name: it.service_name ?? (it.service_id ? await getServiceName(it.service_id) : undefined),
            }))
          );
          setItems(enriched);
        } catch {
          // Si tu backend devuelve los items dentro del detalle o el endpoint es distinto,
          // no bloqueamos la pantalla. Más adelante lo ajustamos.
          if (!mounted) return;
          setItems([]);
        }

        // 3) Pagos
        try {
          setPaymentsLoading(true);
          setPaymentsError(null);
          const payRes = await api.get<Payment[]>(`/work-orders/${id}/payments`);
          if (!mounted) return;
          setPayments(Array.isArray(payRes.data) ? payRes.data : []);
        } catch (e: any) {
          if (!mounted) return;
          const msg = e?.response?.data?.detail ?? e?.message ?? "No se pudieron cargar los pagos";
          setPaymentsError(String(msg));
          setPayments([]);
        } finally {
          if (!mounted) return;
          setPaymentsLoading(false);
        }

        // 4) Servicios para agregar ítems
        try {
          setServicesLoading(true);
          setServicesError(null);
          const svcRes = await api.get<Service[]>("/services/");
          if (!mounted) return;
          setServices(Array.isArray(svcRes.data) ? svcRes.data : []);
        } catch (e: any) {
          if (!mounted) return;
          const msg = e?.response?.data?.detail ?? e?.message ?? "No se pudieron cargar los servicios";
          setServicesError(String(msg));
          setServices([]);
        } finally {
          if (!mounted) return;
          setServicesLoading(false);
        }

        // 4.1) Catálogos: tipos de motor y piezas recibidas
        try {
          setEngineModelsLoading(true);
          setEngineModelsError(null);
          setReceivedPartsLoading(true);
          setReceivedPartsError(null);
          const [mRes, pRes] = await Promise.all([
            api.get<EngineModel[]>("/engine-models/", { params: { include_inactive: true } }),
            api.get<ReceivedPart[]>("/received-parts/", { params: { include_inactive: true } }),
          ]);
          if (!mounted) return;
          setEngineModels(Array.isArray(mRes.data) ? mRes.data : []);
          setReceivedParts(Array.isArray(pRes.data) ? pRes.data : []);
        } catch (e: any) {
          if (!mounted) return;
          const msg = e?.response?.data?.detail ?? e?.message ?? "No se pudieron cargar los catálogos";
          setEngineModelsError(String(msg));
          setReceivedPartsError(String(msg));
          setEngineModels([]);
          setReceivedParts([]);
        } finally {
          if (!mounted) return;
          setEngineModelsLoading(false);
          setReceivedPartsLoading(false);
        }

        // 5) Trabajadores (empleados) para asignar la orden
        try {
          setWorkersLoading(true);
          setWorkersError(null);
          const wRes = await api.get<Worker[]>("/workers/");
          if (!mounted) return;
          const list = Array.isArray(wRes.data) ? wRes.data : [];
          const activeOnly = list.filter((w) => w?.active !== false);
          setWorkers(activeOnly);
        } catch (e: any) {
          if (!mounted) return;
          const msg = e?.response?.data?.detail ?? e?.message ?? "No se pudieron cargar los trabajadores";
          setWorkersError(String(msg));
          setWorkers([]);
        } finally {
          if (!mounted) return;
          setWorkersLoading(false);
        }

      } catch (e: any) {
        if (!mounted) return;
        const msg =
          e?.response?.data?.detail ??
          e?.message ??
          "No se pudo cargar el detalle de la orden.";
        setError(String(msg));
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [api, id]);

  if (loading) {
    return (
      <div style={{ padding: 16 }}>
        <p>Cargando orden…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 16 }}>
        <div style={{ marginBottom: 12 }}>
          <Link to="/work-orders" className="ui-link-btn">← Volver a órdenes</Link>
        </div>
        <div className="ui-error">{error}</div>
        <p style={{ opacity: 0.8 }}>
          Tip: revisa que el backend esté levantado y que Postgres esté corriendo.
        </p>
      </div>
    );
  }

  if (!order) {
    return (
      <div style={{ padding: 16 }}>
        <div style={{ marginBottom: 12 }}>
          <Link to="/work-orders" className="ui-link-btn">← Volver a órdenes</Link>
        </div>
        <p>No se encontró la orden.</p>
      </div>
    );
  }

  // Handler for finalizing order
  async function updateStatus(next: string) {
    if (!order) return;
    setUpdatingStatus(true);
    setError(null);
    try {
      const res = await api.patch<WorkOrder>(`/work-orders/${order.id}`, { status: next });
      const merged = {
        ...res.data,
        customer_name: order.customer_name,
        customer_phone: order.customer_phone,
        customer_address: order.customer_address,
      };
      setOrder(merged);
      await fetchHistory(order.id);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "No se pudo actualizar el estado");
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function downloadInvoice() {
    if (!order) return;
    try {
      const res = await api.get(`/work-orders/${order.id}/invoice.pdf`, { responseType: "blob" });
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const number = order.order_number ?? order.id;
      a.href = url;
      a.download = `factura_orden_${number}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "No se pudo descargar la simulación");
    }
  }


  async function refreshOrderAndItems(orderId: string) {
    const [orderRes, itemsRes, paymentsRes] = await Promise.all([
      api.get<WorkOrder>(`/work-orders/${orderId}`),
      api.get<WorkOrderItem[]>(`/work-orders/${orderId}/items`),
      api.get<Payment[]>(`/work-orders/${orderId}/payments`),
    ]);
    const mergedOrder = {
      ...orderRes.data,
      customer_name: order?.customer_name ?? orderRes.data.customer_name,
      customer_phone: order?.customer_phone ?? orderRes.data.customer_phone,
      customer_address: order?.customer_address ?? orderRes.data.customer_address,
    };
    setOrder(mergedOrder);
    setEngineModelId(String(mergedOrder.engine_model_id ?? ""));
    setOfferedForDate(mergedOrder.offered_for_date ? String(mergedOrder.offered_for_date) : "");
    setReceivedPartIds(
      Array.isArray(mergedOrder.received_parts)
        ? mergedOrder.received_parts.map((p) => getReceivedPartId(p))
        : []
    );
    if (
      mergedOrder.customer_id &&
      (!mergedOrder.customer_name || !mergedOrder.customer_phone || !mergedOrder.customer_address)
    ) {
      const info = await getCustomerName(mergedOrder.customer_id);
      setOrder((prev) =>
        prev
          ? {
              ...prev,
              customer_name: prev.customer_name ?? info.name,
              customer_phone: prev.customer_phone ?? info.phone,
              customer_address: prev.customer_address ?? info.address,
            }
          : prev
      );
    }
    const enriched = await Promise.all(
      (Array.isArray(itemsRes.data) ? itemsRes.data : []).map(async (it) => ({
        ...it,
        service_name: it.service_name ?? (it.service_id ? await getServiceName(it.service_id) : undefined),
      }))
    );
    setItems(enriched);
    setPayments(Array.isArray(paymentsRes.data) ? paymentsRes.data : []);
  }

  async function addServiceToOrder(e: React.FormEvent) {
    e.preventDefault();
    if (isClosed) {
      setError("No se puede agregar servicios a una orden CERRADA.");
      return;
    }
    if (!order) return;
    if (!serviceId) {
      setError("Selecciona un servicio.");
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      setError("La cantidad debe ser mayor a 0.");
      return;
    }

    setAddingItem(true);
    setError(null);
    try {
      const existing = items.find((it) => it.service_id === serviceId);
      if (existing && existing.id) {
        const nextQty = Number(existing.qty || 0) + Number(qty || 0);
        await api.patch(`/work-orders/items/${existing.id}`, { qty: nextQty });
      } else {
        const svc = services.find((s) => s.id === serviceId);
        await api.post(`/work-orders/${order.id}/items`, {
          service_id: serviceId,
          qty,
          description: svc?.name ?? "Servicio",
        });
      }
      setServiceId("");
      setServiceQuery("");
      setQty(1);
      await refreshOrderAndItems(order.id);
      await fetchHistory(order.id);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "No se pudo agregar el servicio");
    } finally {
      setAddingItem(false);
    }
  }

  async function updateItemQty(itemId: string, nextQty: number) {
    if (isClosed) {
      setError("No se puede editar servicios en una orden CERRADA.");
      return;
    }
    if (!Number.isFinite(nextQty) || nextQty <= 0) {
      setError("La cantidad debe ser mayor a 0.");
      return;
    }
    setUpdatingItemId(itemId);
    setError(null);
    try {
      await api.patch(`/work-orders/items/${itemId}`, { qty: nextQty });
      if (order) {
        await refreshOrderAndItems(order.id);
        await fetchHistory(order.id);
      }
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "No se pudo actualizar la cantidad");
    } finally {
      setUpdatingItemId(null);
    }
  }

  async function deleteItem(itemId: string) {
    if (isClosed) {
      setError("No se puede eliminar servicios en una orden CERRADA.");
      return;
    }
    if (Number(order?.paid_total ?? order?.paid ?? 0) > 0) {
      const confirmed = window.confirm(
        "Esta orden ya tiene pagos registrados. Si eliminas este servicio, el total cambiará y podría generarse una devolución automática. ¿Deseas continuar?"
      );
      if (!confirmed) return;
    }
    setDeletingItemId(itemId);
    setError(null);
    try {
      await api.delete(`/work-orders/items/${itemId}`);
      if (order) {
        await refreshOrderAndItems(order.id);
        await fetchHistory(order.id);
      }
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "No se pudo eliminar el servicio");
    } finally {
      setDeletingItemId(null);
    }
  }

  async function saveAssignedWorkers() {
    if (!order) return;
    if (!hasItems) {
      setError("No se pueden asignar trabajadores a una orden sin servicios.");
      return;
    }
    setAssigningWorker(true);
    setError(null);
    try {
      const res = await api.patch<WorkOrder>(`/work-orders/${order.id}`, {
        assigned_worker_ids: selectedWorkerIds,
      });
      setOrder((prev) => (prev ? { ...prev, ...res.data } : prev));
      const ids =
        Array.isArray(res.data.assigned_workers) && res.data.assigned_workers.length > 0
          ? res.data.assigned_workers.map((w) => String(w.id))
          : res.data.assigned_worker_id
          ? [String(res.data.assigned_worker_id)]
          : [];
      setSelectedWorkerIds(ids);
      await fetchHistory(order.id);
      setIsEditingAssignments(false);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "No se pudo guardar la asignación");
    } finally {
      setAssigningWorker(false);
    }
  }

  async function deleteOrder() {
    if (!order) return;
    if (String(order.status ?? "").toUpperCase() !== "DRAFT") {
      setError("Solo se puede eliminar una orden en estado DRAFT.");
      return;
    }
    const ok = window.confirm("¿Eliminar esta orden en borrador? Esta acción no se puede deshacer.");
    if (!ok) return;

    setDeletingOrder(true);
    setError(null);
    try {
      await api.delete(`/work-orders/${order.id}`);
      navigate("/work-orders");
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "No se pudo eliminar la orden");
    } finally {
      setDeletingOrder(false);
    }
  }

  async function saveMeta() {
    if (!order) return;
    if (isClosed) {
      setError("No se puede editar una orden CERRADA.");
      return;
    }
    if (!metaHasChanges) return;
    setSavingMeta(true);
    setError(null);
    try {
      const payload = {
        engine_model_id: engineModelId || null,
        offered_for_date: offeredForDate || null,
        received_part_ids: receivedPartIds,
      };
      const res = await api.patch<WorkOrder>(`/work-orders/${order.id}`, payload);
      const merged = {
        ...res.data,
        customer_name: order.customer_name,
        customer_phone: order.customer_phone,
        customer_address: order.customer_address,
      };
      setOrder(merged);
      setEngineModelId(String(merged.engine_model_id ?? ""));
      setOfferedForDate(merged.offered_for_date ? String(merged.offered_for_date) : "");
      setReceivedPartIds(
        Array.isArray(merged.received_parts)
          ? merged.received_parts.map((p) => getReceivedPartId(p))
          : []
      );
      await fetchHistory(order.id);
      setIsEditingMeta(false);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "No se pudo guardar los datos de motor");
    } finally {
      setSavingMeta(false);
    }
  }

  async function fetchHistory(orderId: string) {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const r = await api.get<MetaHistoryEntry[]>(`/work-orders/${orderId}/meta-history`);
      setHistory(Array.isArray(r.data) ? r.data : []);
    } catch (e: any) {
      const msg = e?.response?.data?.detail ?? e?.message ?? "No se pudo cargar el historial";
      setHistoryError(String(msg));
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }


  function resolveEngineLabel(id?: string | null): string {
    if (!id) return "—";
    const m = engineModels.find((x) => x.id === id);
    return m?.label ?? id;
  }

  function resolveServiceLabel(serviceId?: string | null, description?: string | null): string {
    if (serviceId) {
      const svc = services.find((s) => s.id === serviceId);
      return svc?.name ?? serviceId;
    }
    return description ?? "—";
  }

  function resolvePartLabels(ids: string[]): string[] {
    return ids.map((id) => receivedParts.find((p) => p.id === id)?.label ?? id);
  }

  function resolveWorkerLabels(ids: string[]): string[] {
    return ids.map((id) => workers.find((w) => w.id === id)?.name ?? id);
  }

  function formatHistoryChanges(changes: any): string[] {
    const lines: string[] = [];

    if (changes?.engine_model_id) {
      const fromId = changes.engine_model_id.from ?? null;
      const toId = changes.engine_model_id.to ?? null;
      lines.push(`Tipo de motor: ${resolveEngineLabel(fromId)} → ${resolveEngineLabel(toId)}`);
    }

    if (changes?.offered_for_date) {
      const from = formatChangeValue(changes.offered_for_date.from);
      const to = formatChangeValue(changes.offered_for_date.to);
      lines.push(`Ofrecido para: ${from} → ${to}`);
    }

    if (changes?.received_part_ids) {
      const fromIds: string[] = Array.isArray(changes.received_part_ids.from)
        ? changes.received_part_ids.from
        : [];
      const toIds: string[] = Array.isArray(changes.received_part_ids.to)
        ? changes.received_part_ids.to
        : [];
      const added = toIds.filter((x) => !fromIds.includes(x));
      const removed = fromIds.filter((x) => !toIds.includes(x));
      const addedLabels = resolvePartLabels(added);
      const removedLabels = resolvePartLabels(removed);
      const parts: string[] = [];
      if (addedLabels.length) parts.push(`+${addedLabels.join(", ")}`);
      if (removedLabels.length) parts.push(`-${removedLabels.join(", ")}`);
      lines.push(`Piezas recibidas: ${parts.length ? parts.join(" ") : "—"}`);
    }

    if (changes?.assigned_worker_ids) {
      const fromIds: string[] = Array.isArray(changes.assigned_worker_ids.from)
        ? changes.assigned_worker_ids.from
        : [];
      const toIds: string[] = Array.isArray(changes.assigned_worker_ids.to)
        ? changes.assigned_worker_ids.to
        : [];
      const added = toIds.filter((x) => !fromIds.includes(x));
      const removed = fromIds.filter((x) => !toIds.includes(x));
      const addedLabels = resolveWorkerLabels(added);
      const removedLabels = resolveWorkerLabels(removed);
      const parts: string[] = [];
      if (addedLabels.length) parts.push(`+${addedLabels.join(", ")}`);
      if (removedLabels.length) parts.push(`-${removedLabels.join(", ")}`);
      lines.push(`Trabajadores asignados: ${parts.length ? parts.join(" ") : "—"}`);
    }

    if (changes?.status) {
      const from = formatStatusLabel(changes.status.from);
      const to = formatStatusLabel(changes.status.to);
      lines.push(`Estado: ${from} → ${to}`);
    }

    if (changes?.payment_added) {
      const p = changes.payment_added;
      const amt = p?.amount ?? "—";
      const cur = p?.currency ?? "";
      const typ = p?.type ?? "PAGO";
      const method = p?.method ?? "";
      const auto = p?.auto ? " (auto)" : "";
      lines.push(`Pago: ${typ} ${amt} ${cur} ${method}${auto}`.trim());
    }

    if (changes?.item_added) {
      const it = changes.item_added;
      lines.push(
        `Servicio agregado: ${resolveServiceLabel(it?.service_id, it?.description)} · qty ${it?.qty ?? "—"}`
      );
    }

    if (changes?.item_updated) {
      const it = changes.item_updated;
      const label = resolveServiceLabel(it?.service_id, it?.description);
      const changeLines = it?.changes
        ? Object.entries(it.changes)
            .map(([k, v]: any) => `${k}: ${formatChangeValue(v?.from)} → ${formatChangeValue(v?.to)}`)
            .join(", ")
        : "";
      lines.push(`Servicio editado: ${label}${changeLines ? ` · ${changeLines}` : ""}`);
    }

    if (changes?.item_deleted) {
      const it = changes.item_deleted;
      lines.push(
        `Servicio eliminado: ${resolveServiceLabel(it?.service_id, it?.description)} · qty ${it?.qty ?? "—"}`
      );
    }

    if (changes?.consumable_added) {
      const c = changes.consumable_added;
      const label = c?.item_name ?? c?.item_code ?? c?.item_id ?? "—";
      lines.push(`Insumo agregado: ${label} · qty ${c?.qty ?? "—"}`);
    }

    if (changes?.consumable_updated) {
      const c = changes.consumable_updated;
      const label = c?.item_name ?? c?.item_code ?? c?.item_id ?? "—";
      const from = formatChangeValue(c?.qty?.from);
      const to = formatChangeValue(c?.qty?.to);
      lines.push(`Insumo editado: ${label} · qty ${from} → ${to}`);
    }

    if (changes?.consumable_deleted) {
      const c = changes.consumable_deleted;
      const label = c?.item_name ?? c?.item_code ?? c?.item_id ?? "—";
      lines.push(`Insumo eliminado: ${label} · qty ${c?.qty ?? "—"}`);
    }

    return lines;
  }

  return (
    <div style={{ padding: 16, maxWidth: 980, margin: "0 auto" }}>
      <div
        style={{
          padding: 16,
          border: "1px solid rgba(0,0,0,0.12)",
          borderRadius: 10,
        }}
      >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <Link to="/work-orders" className="ui-link-btn">← Volver a órdenes</Link>
          <h2 style={{ margin: "0 0 8px" }}>
            Orden #{order.order_number ?? "—"}{" "}
            <span style={{ opacity: 0.7, fontSize: 12 }}>
              · Creada: <b>{formatDateTime(order.created_at ?? (order as any).createdAt)}</b>
            </span>
          </h2>
          <div style={{ opacity: 0.8, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <div>
              Estado: <b>{formatStatusLabel(order.status)}</b>
            </div>
            <select
              value=""
              onChange={(e) => updateStatus(e.target.value)}
              disabled={updatingStatus || nextStatusOptions.length === 0 || !canLeaveDraft}
              className="ui-control"
              style={{ padding: "4px 6px" }}
            >
              <option value="" disabled>
                Cambiar estado
              </option>
              {nextStatusOptions.map((s) => (
                <option
                  key={s}
                  value={s}
                  disabled={(s === "CERRADO" && hasPendingBalance) || (currentStatus === "DRAFT" && !hasItems && s === "RECIBIDO")}
                >
                  {formatStatusLabel(s)}
                </option>
              ))}
            </select>
            <div>
              {" · "}Tipo:{" "}
              <b>
                {order.pricing_tier === "TD"
                  ? "Cliente directo"
                  : order.pricing_tier === "SC"
                  ? "Por subcontrato"
                  : order.pricing_tier ?? "—"}
              </b>
            </div>
          </div>

          {currentStatus === "ENTREGADO" && hasPendingBalance && (
            <div style={{ marginTop: 8, color: "#b45309", fontSize: 12 }}>
              No se puede CERRAR: saldo pendiente.
            </div>
          )}
          {currentStatus === "DRAFT" && !hasItems && (
            <div style={{ marginTop: 8, color: "#b45309", fontSize: 12 }}>
              Agrega al menos un servicio para poder avanzar a RECIBIDO.
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {items.length > 0 && (
            <button
              type="button"
              onClick={downloadInvoice}
              disabled={currentStatus === "DRAFT"}
              title={currentStatus === "DRAFT" ? "Finaliza la orden para descargar la nota de venta" : undefined}
              className="ui-btn"
            >
              Descargar nota de venta
            </button>
          )}
          {currentStatus === "DRAFT" && (
            <button
              type="button"
              onClick={deleteOrder}
              disabled={deletingOrder}
              className="ui-btn"
            >
              {deletingOrder ? "Eliminando…" : "Eliminar borrador"}
            </button>
          )}
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <div>
          <h3 style={{ marginTop: 0 }}>Cliente</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <div style={{ opacity: 0.7, fontSize: 12 }}>Nombre</div>
            <div>{order.customer_name ?? order.customer_id ?? "—"}</div>
          </div>
          <div>
            <div style={{ opacity: 0.7, fontSize: 12 }}>Teléfono</div>
            <div>{order.customer_phone ?? "—"}</div>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <div style={{ opacity: 0.7, fontSize: 12 }}>Dirección</div>
            <div>{order.customer_address ?? "—"}</div>
          </div>
        </div>

        {order.notes ? (
          <div style={{ marginTop: 12 }}>
            <div style={{ opacity: 0.7, fontSize: 12 }}>Notas</div>
            <div>{order.notes}</div>
          </div>
        ) : null}
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <h3 style={{ marginTop: 0 }}>Motor y piezas recibidas</h3>
          {!isClosed && (
            <button
              type="button"
              onClick={() => {
                if (isEditingMeta && order) {
                  setEngineModelId(String(order.engine_model_id ?? ""));
                  setOfferedForDate(order.offered_for_date ? String(order.offered_for_date) : "");
                  setReceivedPartIds(
                    Array.isArray(order.received_parts)
                      ? order.received_parts.map((p) => getReceivedPartId(p))
                      : []
                  );
                }
                setIsEditingMeta((prev) => !prev);
              }}
              className="ui-btn"
            >
              {isEditingMeta ? "Cerrar edición" : "Editar"}
            </button>
          )}
        </div>

        {!isEditingMeta ? (
          <div style={{ display: "grid", gap: 10, marginTop: 8 }}>
            <div>
              <div style={{ opacity: 0.7, fontSize: 12 }}>Tipo de motor</div>
              <div>{resolveEngineLabel(order.engine_model_id)}</div>
            </div>
            <div>
              <div style={{ opacity: 0.7, fontSize: 12 }}>Piezas recibidas</div>
              <div>
                {Array.isArray(order.received_parts) && order.received_parts.length > 0
                  ? order.received_parts.map((p) => p.label ?? getReceivedPartId(p)).join(", ")
                  : "—"}
              </div>
            </div>
            <div>
              <div style={{ opacity: 0.7, fontSize: 12 }}>Ofrecido para</div>
              <div>{formatChangeValue(order.offered_for_date)}</div>
            </div>
          </div>
        ) : (
          <div className="ui-panel ui-panel-body" style={{ display: "grid", gap: 12, marginTop: 8 }}>
            <label style={{ display: "grid", gap: 6, maxWidth: 360 }}>
              <span style={{ opacity: 0.7, fontSize: 12 }}>Tipo de motor</span>
              <select
                value={engineModelId}
                onChange={(e) => setEngineModelId(e.target.value)}
                disabled={engineModelsLoading || isClosed}
                className="ui-control"
              >
                <option value="">— Sin seleccionar —</option>
                {engineModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: "grid", gap: 6, maxWidth: 220 }}>
              <span style={{ opacity: 0.7, fontSize: 12 }}>Ofrecido para</span>
              <input
                type="date"
                value={offeredForDate}
                onChange={(e) => setOfferedForDate(e.target.value)}
                disabled={isClosed}
                className="ui-control"
              />
            </label>

            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ opacity: 0.7, fontSize: 12 }}>Piezas recibidas</div>
              {receivedPartsLoading ? (
                <div style={{ fontSize: 13, opacity: 0.7 }}>Cargando piezas…</div>
              ) : receivedParts.length === 0 ? (
                <div style={{ fontSize: 13, opacity: 0.7 }}>No hay piezas disponibles.</div>
              ) : (
                <div
                  className="ui-panel ui-panel-body workorder-detail-parts-grid"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                    gap: 8,
                    maxWidth: 800,
                  }}
                >
                  {receivedParts.map((p) => {
                    const checked = receivedPartIds.includes(p.id);
                    return (
                      <label
                        key={p.id}
                        className="workorder-detail-part-item"
                        style={{ display: "flex", alignItems: "center", gap: 8 }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={isClosed}
                          onChange={(e) => {
                            const next = e.target.checked;
                            setReceivedPartIds((prev) =>
                              next ? [...prev, p.id] : prev.filter((x) => x !== p.id)
                            );
                          }}
                        />
                        <span className="workorder-detail-part-label">{p.label}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {(engineModelsError || receivedPartsError) && (
              <div className="ui-error" style={{ fontSize: 13, marginBottom: 0 }}>
                {engineModelsError || receivedPartsError}
              </div>
            )}

            {!isClosed && (
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => {
                    if (!order) return;
                    setEngineModelId(String(order.engine_model_id ?? ""));
                    setOfferedForDate(order.offered_for_date ? String(order.offered_for_date) : "");
                    setReceivedPartIds(
                      Array.isArray(order.received_parts)
                        ? order.received_parts.map((p) => getReceivedPartId(p))
                        : []
                    );
                    setIsEditingMeta(false);
                  }}
                  className="ui-btn"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={saveMeta}
                  disabled={savingMeta || !metaHasChanges}
                  className="ui-btn ui-btn-primary"
                >
                  {savingMeta ? "Guardando…" : "Guardar cambios"}
                </button>
              </div>
            )}
            {isClosed && (
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                La orden está CERRADA. No se pueden editar estos datos.
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3>Servicios (items)</h3>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => setShowAddItemForm((v) => !v)}
              disabled={isClosed}
              title={isClosed ? "La orden está CERRADA" : undefined}
              className="ui-btn"
            >
              {showAddItemForm ? "Cerrar" : "Agregar servicio"}
            </button>
            <button
              type="button"
              onClick={() => setEnableEditItems((v) => !v)}
              disabled={isClosed}
              title={isClosed ? "La orden está CERRADA" : undefined}
              className="ui-btn"
            >
              {enableEditItems ? "Cerrar edición" : "Editar cantidades"}
            </button>
          </div>
        </div>

        {!order ? null : showAddItemForm ? (
          <div style={{ marginTop: 8, padding: 12, border: "1px solid rgba(0,0,0,0.12)", borderRadius: 10 }}>
            {isClosed ? (
              <div style={{ marginBottom: 10, color: "#b45309", fontSize: 12 }}>
                La orden está CERRADA. No se pueden agregar servicios.
              </div>
            ) : null}
            {servicesLoading ? (
              <p>Cargando servicios…</p>
            ) : servicesError ? (
              <div className="ui-error">{servicesError}</div>
            ) : services.length === 0 ? (
              <p style={{ opacity: 0.75 }}>No hay servicios disponibles.</p>
            ) : (
              <form onSubmit={addServiceToOrder} style={{ display: "grid", gap: 10 }}>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ opacity: 0.7, fontSize: 12 }}>Buscar servicio</span>
                  <input
                    className="ui-control"
                    placeholder="Nombre, descripción o parámetros…"
                    value={serviceQuery}
                    onChange={(e) => setServiceQuery(e.target.value)}
                  />
                </label>

                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ opacity: 0.7, fontSize: 12 }}>Servicio *</span>
                  <select value={serviceId} onChange={(e) => setServiceId(e.target.value)} className="ui-control">
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

                {selectedService?.description ? (
                  <div
                    style={{
                      padding: 10,
                      border: "1px solid rgba(0,0,0,0.10)",
                      borderRadius: 12,
                      background: "rgba(0,0,0,0.02)",
                      fontSize: 13,
                    }}
                  >
                    <div style={{ opacity: 0.8 }}>{selectedService.description}</div>
                  </div>
                ) : null}

                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ opacity: 0.7, fontSize: 12 }}>Cantidad</span>
                  <input
                    type="number"
                    min={1}
                    value={qty}
                    onChange={(e) => setQty(Number(e.target.value))}
                    className="ui-control"
                  />
                </label>

                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button
                    type="submit"
                    disabled={addingItem || isClosed || !serviceId || !Number.isFinite(qty) || qty <= 0}
                    className="ui-btn ui-btn-primary"
                  >
                    {addingItem ? "Agregando…" : "Agregar servicio"}
                  </button>
                </div>
              </form>
            )}
          </div>
        ) : null}
      </div>

      <div style={{ marginTop: 16 }}>
        {items.length === 0 ? (
          <p style={{ opacity: 0.75 }}>No hay servicios agregados a esta orden.</p>
        ) : (
          <div className="ui-table-wrap">
            <table className="ui-table">
              <thead>
                <tr>
                  <th>Servicio</th>
                  <th>Cantidad</th>
                  <th>Precio</th>
                  <th>Subtotal</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{it.service_name ?? it.description ?? it.service_id ?? "—"}</div>
                      {formatItemDetails(it) ? (
                        <div style={{ fontSize: 12, opacity: 0.7 }}>{formatItemDetails(it)}</div>
                      ) : null}
                    </td>
                    <td>
                      {enableEditItems ? (
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <input
                            type="number"
                            min={1}
                            value={it.qty ?? 1}
                            onChange={(e) => {
                              const next = Number(e.target.value);
                              setItems((prev) =>
                                prev.map((x) => (x.id === it.id ? { ...x, qty: next } : x))
                              );
                            }}
                            className="ui-control"
                            style={{ width: 80 }}
                          />
                          <button
                            type="button"
                            onClick={() => updateItemQty(it.id, Number(it.qty ?? 1))}
                            disabled={updatingItemId === it.id}
                            className="ui-btn"
                          >
                            {updatingItemId === it.id ? "Guardando…" : "Guardar"}
                          </button>
                        </div>
                      ) : (
                        <span>{it.qty ?? "—"}</span>
                      )}
                    </td>
                    <td>
                      {formatMoney(it.unit_price)}
                    </td>
                    <td>
                      {formatMoney(
                        it.subtotal ??
                          (it.qty !== undefined && it.unit_price !== undefined
                            ? Number(it.qty) * Number(it.unit_price)
                            : undefined)
                      )}
                    </td>
                    <td>
                      {enableEditItems ? (
                        <button
                          type="button"
                          onClick={() => deleteItem(it.id)}
                          disabled={deletingItemId === it.id}
                          className="ui-btn"
                        >
                          {deletingItemId === it.id ? "Eliminando…" : "Eliminar"}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div
              style={{
                marginTop: 12,
                padding: 12,
                textAlign: "right",
                fontWeight: 700,
              }}
            >
              Total servicios: {formatMoney(itemsTotal)}
            </div>
          </div>
        )}

      </div>

      <div style={{ marginTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ marginTop: 0 }}>Pagos</h3>
          <button
            type="button"
            onClick={() => setShowPaymentForm((v) => !v)}
            disabled={items.length === 0}
            title={
              items.length === 0
                ? "Agrega al menos un servicio para registrar pagos"
                : undefined
            }
            className="ui-btn"
          >
            {showPaymentForm ? "Cerrar" : "Agregar pago"}
          </button>
        </div>

        {showPaymentForm && (
          <div style={{ marginTop: 12 }}>
            <PaymentForm
              orderId={order.id}
              defaultType="ABONO"
              defaultCurrency="USD"
              defaultMethod="EFECTIVO"
              compact
              onSuccess={async (p: PaymentOut) => {
                setPayments((prev) => [p as Payment, ...prev]);
                setShowPaymentForm(false);

                try {
                  const refreshed = await api.get<WorkOrder>(`/work-orders/${order.id}`);
                  const merged = {
                    ...refreshed.data,
                    customer_name: order?.customer_name ?? refreshed.data.customer_name,
                    customer_phone: order?.customer_phone ?? refreshed.data.customer_phone,
                    customer_address: order?.customer_address ?? refreshed.data.customer_address,
                  };
                  setOrder(merged);
                  setEngineModelId(String(merged.engine_model_id ?? ""));
                  setOfferedForDate(merged.offered_for_date ? String(merged.offered_for_date) : "");
                  setReceivedPartIds(
                    Array.isArray(merged.received_parts)
                      ? merged.received_parts.map((p) => getReceivedPartId(p))
                      : []
                  );

                  if (
                    merged.customer_id &&
                    (!merged.customer_name || !merged.customer_phone || !merged.customer_address)
                  ) {
                    const info = await getCustomerName(merged.customer_id);
                    setOrder((prev) =>
                      prev
                        ? {
                            ...prev,
                            customer_name: prev.customer_name ?? info.name,
                            customer_phone: prev.customer_phone ?? info.phone,
                            customer_address: prev.customer_address ?? info.address,
                          }
                        : prev
                    );
                  }

                  await fetchHistory(order.id);
                } catch (e: any) {
                  setError(e?.response?.data?.detail ?? "No se pudo refrescar la orden");
                }
              }}
            />
          </div>
        )}

        {paymentsLoading ? (
          <p style={{ marginTop: 10 }}>Cargando pagos…</p>
        ) : paymentsError ? (
          <div className="ui-error" style={{ marginTop: 10 }}>{paymentsError}</div>
        ) : payments.length === 0 ? (
          <p style={{ marginTop: 10, opacity: 0.75 }}>Aún no hay pagos registrados.</p>
        ) : (
          <div className="ui-table-wrap" style={{ marginTop: 10 }}>
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
                      <td>
                        {p.created_at ? new Date(p.created_at).toLocaleString() : "—"}
                      </td>
                      <td>
                        {p.type}
                      </td>
                      <td>
                        {p.method}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {signed.toFixed(2)} {p.currency}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Resumen</h3>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ textAlign: "left" }}>
            <div style={{ opacity: 0.7, fontSize: 12 }}>Total</div>
            <div style={{ fontWeight: 700 }}>{formatMoney(order.total)}</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ opacity: 0.7, fontSize: 12 }}>Pagado</div>
            <div style={{ fontWeight: 700 }}>{formatMoney(order.paid_total ?? order.paid)}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ opacity: 0.7, fontSize: 12 }}>Saldo</div>
            <div style={{ fontWeight: 700 }}>{formatMoney(order.balance)}</div>
          </div>
        </div>
      </div>

      </div>
      <ConsumablesSection orderId={order.id} title="Insumos (Inventario)" />


      <div
        style={{
          marginTop: 16,
          padding: 16,
          border: "1px solid rgba(0,0,0,0.12)",
          borderRadius: 10,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <h3 style={{ marginTop: 0 }}>Operadores asignados</h3>
          {!isClosed && (
            <button
              type="button"
              disabled={!hasItems}
              title={!hasItems ? "Agrega al menos un servicio para asignar trabajadores." : undefined}
              onClick={() => {
                if (!hasItems) return;
                if (isEditingAssignments) {
                  const ids =
                    Array.isArray(order.assigned_workers) && order.assigned_workers.length > 0
                      ? order.assigned_workers.map((w) => String(w.id))
                      : order.assigned_worker_id
                      ? [String(order.assigned_worker_id)]
                      : [];
                  setSelectedWorkerIds(ids);
                }
                setIsEditingAssignments((v) => !v);
              }}
              className="ui-btn"
            >
              {isEditingAssignments ? "Cerrar edición" : "Asignar empleados"}
            </button>
          )}
        </div>

        {!isEditingAssignments ? (
          <div style={{ marginTop: 8, opacity: 0.85 }}>
            Actual:{" "}
            <b>
              {Array.isArray(order.assigned_workers) && order.assigned_workers.length > 0
                ? order.assigned_workers.map((w) => w.name).join(", ")
                : order.assigned_worker_id
                ? workers.find((w) => w.id === order.assigned_worker_id)?.name ?? order.assigned_worker_id
                : "—"}
            </b>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10, marginTop: 8 }}>
            {workersLoading ? (
              <div style={{ opacity: 0.75 }}>Cargando trabajadores…</div>
            ) : workers.length === 0 ? (
              <div style={{ opacity: 0.75 }}>No hay trabajadores disponibles.</div>
            ) : (
              <div
                style={{
                  border: "1px solid rgba(0,0,0,0.12)",
                  borderRadius: 10,
                  padding: 10,
                  display: "grid",
                  gap: 6,
                  maxWidth: 420,
                }}
              >
                {workers.map((w) => {
                  const checked = selectedWorkerIds.includes(w.id);
                  return (
                    <label key={w.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={assigningWorker || isClosed}
                        onChange={(e) => {
                          const next = e.target.checked;
                          setSelectedWorkerIds((prev) =>
                            next ? [...prev, w.id] : prev.filter((x) => x !== w.id)
                          );
                        }}
                      />
                      <span>
                        {w.name}
                        {w.job_role ? ` · ${w.job_role}` : ""}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}

            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={saveAssignedWorkers}
                disabled={assigningWorker || workersLoading || isClosed || !hasItems || selectedWorkerIds.length === 0}
                className="ui-btn ui-btn-primary"
              >
                {assigningWorker ? "Guardando…" : "Guardar asignación"}
              </button>
              <button
                type="button"
                onClick={() => setSelectedWorkerIds([])}
                disabled={assigningWorker || selectedWorkerIds.length === 0 || isClosed}
                className="ui-btn"
              >
                Quitar todos
              </button>
              <button
                type="button"
                onClick={() => {
                  const ids =
                    Array.isArray(order.assigned_workers) && order.assigned_workers.length > 0
                      ? order.assigned_workers.map((w) => String(w.id))
                      : order.assigned_worker_id
                      ? [String(order.assigned_worker_id)]
                      : [];
                  setSelectedWorkerIds(ids);
                  setIsEditingAssignments(false);
                }}
                disabled={assigningWorker}
                className="ui-btn"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {workersError && <div className="ui-error" style={{ marginTop: 10 }}>{workersError}</div>}
      </div>

      <div
        style={{
          marginTop: 16,
          padding: 16,
          border: "1px solid rgba(0,0,0,0.12)",
          borderRadius: 10,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <h3 style={{ marginTop: 0, marginBottom: 4 }}>Historial de cambios</h3>
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              Orden #{order.order_number ?? "—"}
            </div>
          </div>
          <button type="button" onClick={() => setShowHistory((v) => !v)} className="ui-btn">
            {showHistory ? "Ocultar" : "Ver historial"}
          </button>
        </div>

        {showHistory ? (
          <>
            {historyLoading ? (
              <div style={{ fontSize: 13, opacity: 0.7 }}>Cargando historial…</div>
            ) : historyError ? (
              <div className="ui-error" style={{ fontSize: 13, marginBottom: 0 }}>{historyError}</div>
            ) : history.length === 0 ? (
              <div style={{ fontSize: 13, opacity: 0.7 }}>Aún no hay cambios registrados.</div>
            ) : (
              <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                {history.map((h) => (
                  <div
                    key={h.id}
                    style={{
                      border: "1px solid rgba(0,0,0,0.08)",
                      borderRadius: 8,
                      padding: 10,
                    }}
                  >
                    <div style={{ fontSize: 12, opacity: 0.7 }}>
                      {h.changed_at ? new Date(h.changed_at).toLocaleString() : "—"}
                      {!isLikelyUuid(h.changed_by) && h.changed_by ? ` · ${h.changed_by}` : ""}
                    </div>
                    <div style={{ marginTop: 6, display: "grid", gap: 4 }}>
                      {formatHistoryChanges(h.changes).map((line, idx) => (
                        <div key={`${h.id}-c-${idx}`}>{line}</div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
