import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter, Route, Routes } from "react-router-dom";
import "antd/dist/reset.css";
import "./i18n";
import { blockRussianFederation } from "./geo/blockRussia";
import App from "./App";
import { CalculatorPage } from "./pages/CalculatorPage";
import { RatingPage } from "./pages/RatingPage";

// Best-effort geo-block; runs in the background and never blocks rendering.
void blockRussianFederation();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HashRouter>
      <Routes>
        <Route path="/" element={<App />}>
          <Route index element={<CalculatorPage />} />
          <Route path="rating" element={<RatingPage />} />
        </Route>
      </Routes>
    </HashRouter>
  </React.StrictMode>,
);
