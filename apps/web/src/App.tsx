import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";

import Dashboard from "./pages/Dashboard";
import Services from "./pages/Services";
import EngineModels from "./pages/EngineModels";
import ReceivedParts from "./pages/ReceivedParts";
import Customers from "./pages/Customers";
import CustomerDetail from "./pages/CustomerDetail";
import WorkOrders from "./pages/WorkOrders";
import WorkOrderCreate from "./pages/WorkOrderCreate";
import WorkOrderDetail from "./pages/WorkOrderDetail";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />

          <Route path="/services" element={<Services />} />
          <Route path="/engine-models" element={<EngineModels />} />
          <Route path="/received-parts" element={<ReceivedParts />} />

          <Route path="/customers" element={<Customers />} />
          <Route path="/customers/:id" element={<CustomerDetail />} />

          <Route path="/work-orders" element={<WorkOrders />} />
          <Route path="/work-orders/new" element={<WorkOrderCreate />} />
          <Route path="/work-orders/:id" element={<WorkOrderDetail />} />

          {/* fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
