export function getDashboardColors(darkMode) {
  return darkMode
    ? {
        bg: "#111111",
        sidebar: "#181818",
        surface: "#1e1e1e",
        card: "#1e1e1e",
        panel: "#252526",
        panelSoft: "#202020",
        border: "#2d2d30",
        borderStrong: "#3a3d41",
        text: "#d4d4d4",
        sub: "#9da1a6",
        inputBg: "#181818",
        accent: "#0e639c",
        accentSoft: "#094771",
        activeTab: "#1f1f1f",
        hover: "#2a2d2e",
        success: "#89d185",
        warning: "#d7ba7d",
      }
    : {
        bg: "#f3f3f3",
        sidebar: "#ffffff",
        surface: "#ffffff",
        card: "#ffffff",
        panel: "#fafafa",
        panelSoft: "#f7f7f7",
        border: "#d9d9d9",
        borderStrong: "#c7c7c7",
        text: "#1f1f1f",
        sub: "#666666",
        inputBg: "#ffffff",
        accent: "#0e639c",
        accentSoft: "#dcefff",
        activeTab: "#ffffff",
        hover: "#f0f0f0",
        success: "#2e7d32",
        warning: "#8a5a00",
      };
}

export function inputStyle(colors) {
  return {
    width: "100%",
    padding: "9px 10px",
    border: `1px solid ${colors.borderStrong}`,
    background: colors.inputBg,
    color: colors.text,
    outline: "none",
    boxSizing: "border-box",
    fontSize: 12,
  };
}

export function primaryButtonStyle(colors) {
  return {
    border: `1px solid ${colors.accent}`,
    background: colors.accent,
    color: "#ffffff",
    padding: "8px 12px",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600,
  };
}

export function secondaryButtonStyle(colors) {
  return {
    border: `1px solid ${colors.borderStrong}`,
    background: "transparent",
    color: colors.text,
    padding: "8px 12px",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600,
  };
}

export function ghostButtonStyle(colors) {
  return {
    border: `1px solid ${colors.borderStrong}`,
    background: colors.panelSoft,
    color: colors.text,
    padding: "8px 12px",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 500,
  };
}
