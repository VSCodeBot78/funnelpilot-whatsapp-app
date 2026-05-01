import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const MAX_WIDTH = 280;
const GAP = 10;
const VIEWPORT_MARGIN = 12;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export default function InfoHint({ title, text }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, width: MAX_WIDTH });
  const buttonRef = useRef(null);
  const tooltipRef = useRef(null);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleOutsideClick = (event) => {
      const target = event.target;
      if (
        buttonRef.current?.contains(target) ||
        tooltipRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("touchstart", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
    };
  }, [open]);

  const openTooltip = () => {
    const button = buttonRef.current;
    if (!button) {
      setPosition({ top: VIEWPORT_MARGIN, left: VIEWPORT_MARGIN, width: MAX_WIDTH });
      setOpen(true);
      return;
    }

    const rect = button.getBoundingClientRect();
    const width = Math.min(MAX_WIDTH, window.innerWidth - VIEWPORT_MARGIN * 2);
    const left = clamp(rect.left + rect.width / 2 - width / 2, VIEWPORT_MARGIN, window.innerWidth - width - VIEWPORT_MARGIN);
    const top = clamp(rect.bottom + GAP, VIEWPORT_MARGIN, window.innerHeight - VIEWPORT_MARGIN);

    setPosition({ top, left, width });
    setOpen(true);
  };

  const handleButtonClick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (open) {
      setOpen(false);
    } else {
      openTooltip();
    }
  };

  return (
    <span style={{ display: "inline-flex", alignItems: "center", marginLeft: 6 }}>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleButtonClick}
        aria-haspopup="dialog"
        aria-label={title ? `${title} Info` : "Info"}
        aria-expanded={open}
        style={{
          border: "none",
          background: "transparent",
          color: "inherit",
          cursor: "pointer",
          padding: 0,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 18,
          height: 18,
          borderRadius: "50%",
          backgroundColor: "rgba(255,255,255,0.08)",
          fontSize: 12,
          fontWeight: 700,
          lineHeight: 1,
        }}
      >
        i
      </button>
      {open && createPortal(
        <div
          ref={tooltipRef}
          role="tooltip"
          style={{
            position: "fixed",
            top: position.top,
            left: position.left,
            width: position.width,
            maxWidth: MAX_WIDTH,
            zIndex: 999999,
            background: "rgba(28, 31, 34, 0.96)",
            color: "#ffffff",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 10,
            padding: 12,
            boxShadow: "0 14px 30px rgba(0,0,0,0.16)",
            whiteSpace: "normal",
            lineHeight: 1.5,
            wordBreak: "break-word",
          }}
        >
          {title ? (
            <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 13 }}>
              {title}
            </div>
          ) : null}
          <div style={{ fontSize: 12, color: "#f0f0f0" }}>{text}</div>
        </div>,
        document.body,
      )}
    </span>
  );
}
