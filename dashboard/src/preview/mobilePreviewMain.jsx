import React from "react";
import { createRoot } from "react-dom/client";
import MobileDashboardPreview from "./MobileDashboardPreview.jsx";
import "../campaigns/campaignsView.css";
import "./mobilePreview.css";

createRoot(document.getElementById("root")).render(<MobileDashboardPreview />);
