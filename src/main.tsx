import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./WorkspaceSidebar.css";
import "./ButtonHierarchy.css";
import "./SuccessFeedback.css";
import "./FocusTreatment.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
