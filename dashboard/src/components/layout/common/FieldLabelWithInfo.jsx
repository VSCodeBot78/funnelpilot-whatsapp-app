import React from "react";
import InfoHint from "./InfoHint";

export default function FieldLabelWithInfo({
  label,
  title,
  text,
  placement = "right",
  labelStyle,
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        marginBottom: 6,
        lineHeight: 1,
        ...labelStyle,
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 12 }}>{label}</div>
      <InfoHint title={title || label} text={text} placement={placement} />
    </div>
  );
}
