import React from "react";

// Accessible switch with an explicit draft-only meaning. Never calls a provider.
export default function DraftToggle({
  label, hint, checked, onChange, colors, disabled = false,
}) {
  return (
    <label className="fp-draft-toggle-row" style={{
      border: `1px solid ${colors.border}`, color: colors.text,
      background: colors.panel, opacity: disabled ? 0.65 : 1,
    }}>
      <span className="fp-draft-toggle-copy">
        <strong>{label}</strong>
        {hint && <small style={{ color: colors.sub }}>{hint}</small>}
      </span>
      <input type="checkbox" role="switch" className="fp-draft-toggle-input"
        aria-label={label} checked={checked} disabled={disabled}
        onChange={(e) => onChange(e.target.checked)} />
      <span aria-hidden="true" className="fp-draft-toggle-track" />
    </label>
  );
}
