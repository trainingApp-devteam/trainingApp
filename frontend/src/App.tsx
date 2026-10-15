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
import RequireAuth from "./components/RequireAuth";
import { AuthProvider } from "./auth/AuthContext";

export default function App(): JSX.Element {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 text-white">
      <BrowserRouter>
        <AuthProvider>
          <Header />
          <main className="pt-6">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/account" element={<Account />} />
              <Route path="/record" element={<RequireAuth><Record /></RequireAuth>} />
              <Route path="/record/select" element={<RequireAuth><SelectRecordMode /></RequireAuth>} />
              <Route path="/record/select-menu" element={<RequireAuth><SelectMenu /></RequireAuth>} />
              <Route path="/history" element={<RequireAuth><History /></RequireAuth>} />
              <Route path="/history/:id" element={<RequireAuth><HistoryDetail /></RequireAuth>} />
              <Route path="/body" element={<RequireAuth><Body /></RequireAuth>} />
              <Route path="/menu" element={<RequireAuth><Menu /></RequireAuth>} />
            </Routes>
          </main>
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}