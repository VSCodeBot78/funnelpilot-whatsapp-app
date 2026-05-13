import React, { useState } from "react";

export default function CollapsibleSection({
  colors,
  title,
  description = "",
  defaultOpen = false,
  children,
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section
      style={{
        background: colors.panel,
        border: `1px solid ${colors.border}`,
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        style={{
          width: "100%",
          border: "none",
          borderBottom: open ? `1px solid ${colors.border}` : "none",
          background: "transparent",
          color: colors.text,
          padding: "12px 14px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          textAlign: "left",
        }}
      >
        <span style={{ minWidth: 0 }}>
          <span style={{ display: "block", fontWeight: 700, fontSize: 13 }}>
            {title}
          </span>
          {description ? (
            <span
              style={{
                display: "block",
                color: colors.sub,
                fontSize: 12,
                lineHeight: 1.45,
                marginTop: 4,
              }}
            >
              {description}
            </span>
          ) : null}
        </span>
        <span
          aria-hidden="true"
          style={{
            flex: "0 0 auto",
            color: colors.sub,
            fontSize: 16,
            lineHeight: 1,
          }}
        >
          {open ? "-" : "+"}
        </span>
      </button>

      {open ? <div style={{ padding: 14 }}>{children}</div> : null}
    </section>
  );
}
