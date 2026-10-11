import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { ensureSeed } from './db/repo';

import MastersPage from './pages/masters/MastersPage';
import PoListPage from './pages/po/PoListPage';
import CreatePoPage from './pages/po/CreatePoPage';
import PoDetailPage from './pages/po/PoDetailPage';
import ReceiptListPage from './pages/receipts/ReceiptListPage';
import CreateReceiptPage from './pages/receipts/CreateReceiptPage';
import ReceiptDetailPage from './pages/receipts/ReceiptDetailPage';

import DispatchListPage from './pages/dispatch/DispatchListPage';
import CreateDispatchPage from './pages/dispatch/CreateDispatchPage';
import DispatchDetailPage from './pages/dispatch/DispatchDetailPage';

import ProgramListPage from './pages/programs/ProgramListPage';
import CreateProgramPage from './pages/programs/CreateProgramPage';
import ProgramDetailPage from './pages/programs/ProgramDetailPage';
import ReceiveProgramPage from './pages/programs/ReceiveProgramPage';

import OrderListPage from './pages/orders/OrderListPage';
import CreateOrderPage from './pages/orders/CreateOrderPage';
import OrderDetailPage from './pages/orders/OrderDetailPage';

import FoldingPage from './pages/folding/FoldingPage';
import LocationAssignmentPage from './pages/assignment/LocationAssignmentPage';

import InventoryPage from './pages/inventory/InventoryPage';
import AvailabilityPage from './pages/orders/AvailabilityPage';
import ShrinkagePage from './pages/reports/ShrinkagePage';

import DashboardPage from './pages/DashboardPage';

export default function App() {
  const [ready, setReady] = useState(false);
  const [startError, setStartError] = useState('');

  useEffect(() => {
    ensureSeed().then(() => setReady(true)).catch((e) => { console.error(e); setStartError(e.message); });
  }, []);

  if (startError) return <div className="flex h-screen items-center justify-center p-6 text-center text-red-600">Could not open the database: {startError}</div>;
  if (!ready) return <div className="flex h-screen items-center justify-center text-slate-500">Loading App...</div>;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="masters/:tab" element={<MastersPage />} />
          <Route path="masters" element={<Navigate to="/masters/weavers" replace />} />
          
          <Route path="po" element={<PoListPage />}>
            <Route path="new" element={<CreatePoPage />} />
            <Route path=":id" element={<PoDetailPage />} />
          </Route>
          
          <Route path="receipts" element={<ReceiptListPage />}>
            <Route path="new" element={<CreateReceiptPage />} />
            <Route path=":id" element={<ReceiptDetailPage />} />
          </Route>

          <Route path="dispatch" element={<DispatchListPage />}>
            <Route path="new" element={<CreateDispatchPage />} />
            <Route path=":id" element={<DispatchDetailPage />} />
          </Route>

          <Route path="programs" element={<ProgramListPage />}>
            <Route path="new" element={<CreateProgramPage />} />
            <Route path=":id" element={<ProgramDetailPage />} />
            <Route path=":id/receive" element={<ReceiveProgramPage />} />
          </Route>

          <Route path="inventory" element={<InventoryPage />} />
          <Route path="availability" element={<AvailabilityPage />} />
          <Route path="reports/shrinkage" element={<ShrinkagePage />} />
          <Route path="folding" element={<FoldingPage />} />
          <Route path="assignment" element={<LocationAssignmentPage />} />

          <Route path="orders" element={<OrderListPage />}>
            <Route path="new" element={<CreateOrderPage />} />
            <Route path=":id" element={<OrderDetailPage />} />
          </Route>
          {/* Add other routes here as they are built */}
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
