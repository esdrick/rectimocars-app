import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "../pages/Login";
import Dashboard from "../pages/Dashboard";
import Services from "../pages/Services";
import EngineModels from "../pages/EngineModels";
import ReceivedParts from "../pages/ReceivedParts";
import WorkOrders from "../pages/WorkOrders";
import WorkOrderDetail from "../pages/WorkOrderDetail";
import Customers from "../pages/Customers";
import CustomerDetail from "../pages/CustomerDetail";
import CustomerCreate from "../pages/CustomerCreate";
import WorkOrderCreate from "../pages/WorkOrderCreate";
import Layout from "../components/Layout";
import AccountsReceivable from "../pages/AccountsReceivable";
import Workers from "../pages/Workers";
import Suppliers from "../pages/Suppliers";
import Inventory from "../pages/Inventory";
import InventoryDetail from "../pages/InventoryDetail";
import InventorySummary from "../pages/InventorySummary";
import AccountsPayable from "../pages/AccountsPayable";
import CashflowReport from "../pages/CashflowReport";


export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" />} />
        <Route path="/login" element={<Login />} />
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/services" element={<Services />} />
          <Route path="/engine-models" element={<EngineModels />} />
          <Route path="/received-parts" element={<ReceivedParts />} />
          <Route path="/work-orders" element={<WorkOrders />} />
          <Route path="/work-orders/:id" element={<WorkOrderDetail />} />
          <Route path="/work-orders/new" element={<WorkOrderCreate />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/customers/new" element={<CustomerCreate />} />
          <Route path="/customers/:id" element={<CustomerDetail />} />
          <Route path="/accounts-receivable" element={<AccountsReceivable />} />
          <Route path="/accounts-payable" element={<AccountsPayable />} />
          <Route path="/reports/cashflow" element={<CashflowReport />} />
          <Route path="/workers" element={<Workers />} />
          <Route path="/suppliers" element={<Suppliers />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/inventory/summary" element={<InventorySummary />} />
          <Route path="/inventory/:id" element={<InventoryDetail />} />

        </Route>

      </Routes>
    </BrowserRouter>
  );
}
