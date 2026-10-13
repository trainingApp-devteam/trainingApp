import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Record from "./pages/Record";
import SelectRecordMode from "./pages/SelectRecordMode";
import SelectMenu from "./pages/SelectMenu";
import History from "./pages/History";
import HistoryDetail from "./pages/HistoryDetail";
import Body from "./pages/Body";
import Menu from "./pages/Menu";
import Account from "./pages/Account";
import Header from "./components/Header";

export default function App(): JSX.Element {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 text-white">
      <BrowserRouter>
        <Header />
        <main className="pt-6">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/record" element={<Record />} />
            <Route path="/record/select" element={<SelectRecordMode />} />
            <Route path="/record/select-menu" element={<SelectMenu />} />
            <Route path="/history" element={<History />} />
            <Route path="/history/:id" element={<HistoryDetail />} />
            <Route path="/body" element={<Body />} />
            <Route path="/menu" element={<Menu />} />
            <Route path="/account" element={<Account />} />
          </Routes>
        </main>
      </BrowserRouter>
    </div>
  );
}
