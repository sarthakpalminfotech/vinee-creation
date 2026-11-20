import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { ensureSeed } from './db/repo';

import MastersPage from './pages/masters/MastersPage';
import MasterDetailPage from './pages/masters/MasterDetailPage';
import SettingsPage from './pages/SettingsPage';
import PoListPage from './pages/po/PoListPage';
import CreatePoPage from './pages/po/CreatePoPage';
import PoDetailPage from './pages/po/PoDetailPage';
import ReceiptListPage from './pages/receipts/ReceiptListPage';
import CreateReceiptPage from './pages/receipts/CreateReceiptPage';
import ReceiptDetailPage from './pages/receipts/ReceiptDetailPage';

import DispatchListPage from './pages/dispatch/DispatchListPage';
import CreateDispatchPage from './pages/dispatch/CreateDispatchPage';
import DispatchDetailPage, { DispatchPreviewPage, OldDispatchDetailPage } from './pages/dispatch/DispatchDetailPage';

import ProgramListPage from './pages/programs/ProgramListPage';
import CreateProgramPage from './pages/programs/CreateProgramPage';
import ProgramDetailPage, { ProgramPreviewPage } from './pages/programs/ProgramDetailPage';
import ReceiveProgramPage from './pages/programs/ReceiveProgramPage';
import AddToProgramPage from './pages/programs/AddToProgramPage';

import OrderListPage from './pages/orders/OrderListPage';
import CreateOrderPage from './pages/orders/CreateOrderPage';
import OrderDetailPage from './pages/orders/OrderDetailPage';

import FoldingPage from './pages/folding/FoldingPage';
import InMillPage from './pages/folding/InMillPage';

import InventoryPage from './pages/inventory/InventoryPage';
import InventoryDetailPage from './pages/inventory/InventoryDetailPage';
import AvailabilityPage from './pages/orders/AvailabilityPage';
import ShrinkagePage from './pages/reports/ShrinkagePage';

import JobWorkListPage from './pages/jobwork/JobWorkListPage';
import JobWorkDetailPage from './pages/jobwork/JobWorkDetailPage';
import JobWorkForm from './pages/jobwork/JobWorkForm';
import ReceiveJobWorkPage from './pages/jobwork/ReceiveJobWorkPage';
import FgOtherForm from './pages/withdraw/FgOtherForm';
import SellToOrderPage from './pages/withdraw/SellToOrderPage';
import GreySellForm from './pages/withdraw/GreySellForm';
import GreyOtherForm from './pages/withdraw/GreyOtherForm';
import WithdrawalDetailPage from './pages/withdraw/WithdrawalDetailPage';
import GreySaleDetailPage from './pages/withdraw/GreySaleDetailPage';

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
          <Route path="masters/view/:kind/:id" element={<MasterDetailPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="masters/items" element={<Navigate to="/masters/qualities" replace />} />
          <Route path="masters/locations" element={<Navigate to="/masters/qualities" replace />} />
          <Route path="masters" element={<Navigate to="/masters/weavers" replace />} />
          
          <Route path="po" element={<PoListPage />} />
          <Route path="po/new" element={<CreatePoPage />} />
          <Route path="po/:id" element={<PoDetailPage />} />
          <Route path="po/:id/edit" element={<CreatePoPage />} />
          
          <Route path="receipts" element={<ReceiptListPage />} />
          <Route path="receipts/new" element={<CreateReceiptPage />} />
          <Route path="receipts/:id" element={<ReceiptDetailPage />} />
          <Route path="receipts/:id/edit" element={<CreateReceiptPage />} />

          <Route path="dispatch" element={<DispatchListPage />} />
          <Route path="dispatch/new" element={<CreateDispatchPage />} />
          <Route path="dispatch/old/:id" element={<OldDispatchDetailPage />} />
          <Route path="dispatch/:id" element={<DispatchDetailPage />} />
          <Route path="dispatch/:id/preview" element={<DispatchPreviewPage />} />

          <Route path="programs" element={<ProgramListPage />} />
          <Route path="programs/new" element={<CreateProgramPage />} />
          <Route path="programs/:id" element={<ProgramDetailPage />} />
          <Route path="programs/:id/preview" element={<ProgramPreviewPage />} />
          <Route path="programs/:id/receive" element={<ReceiveProgramPage />} />
          <Route path="programs/:id/add" element={<AddToProgramPage />} />

          <Route path="inventory" element={<InventoryPage />} />
          <Route path="inventory/withdraw/fg-job" element={<JobWorkForm />} />
          <Route path="inventory/withdraw/fg-other" element={<FgOtherForm />} />
          <Route path="inventory/withdraw/fg-order" element={<SellToOrderPage />} />
          <Route path="inventory/withdraw/grey-sell" element={<GreySellForm />} />
          <Route path="inventory/withdraw/grey-other" element={<GreyOtherForm />} />
          <Route path="inventory/:view/:qualityId" element={<InventoryDetailPage />} />
          <Route path="withdrawals/:id" element={<WithdrawalDetailPage />} />
          <Route path="grey-sales/:id" element={<GreySaleDetailPage />} />
          <Route path="job-work" element={<JobWorkListPage />} />
          <Route path="job-work/new" element={<JobWorkForm />} />
          <Route path="job-work/:id" element={<JobWorkDetailPage />} />
          <Route path="job-work/:id/receive" element={<ReceiveJobWorkPage />} />
          <Route path="availability" element={<AvailabilityPage />} />
          <Route path="reports/shrinkage" element={<ShrinkagePage />} />
          <Route path="folding" element={<FoldingPage />} />
          <Route path="folding/in-mill" element={<InMillPage />} />
          <Route path="folding/in-mill/:id/receive" element={<ReceiveProgramPage mode="folding" />} />
          {/* racks are retired: the old pages go to the nearest new page */}
          <Route path="assignment" element={<Navigate to="/inventory" replace />} />

          <Route path="orders" element={<OrderListPage />} />
          <Route path="orders/new" element={<CreateOrderPage />} />
          <Route path="orders/:id" element={<OrderDetailPage />} />
          <Route path="orders/:id/edit" element={<CreateOrderPage />} />
          {/* Add other routes here as they are built */}
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
