const express = require("express");
const {
  readSettings,
  writeSettings,
  resetSettings,
} = require("./settingsStore");

const router = express.Router();

router.get("/settings-config", (req, res) => {
  try {
    const settings = readSettings();
    return res.json({
      ok: true,
      settings,
    });
  } catch (error) {
    console.error("settings GET error:", error);
    return res.status(500).json({
      ok: false,
      error: "settings_load_failed",
    });
  }
});

router.post("/settings-config", (req, res) => {
  try {
    const nextSettings = writeSettings(req.body || {});
    return res.json({
      ok: true,
      settings: nextSettings,
    });
  } catch (error) {
    console.error("settings POST error:", error);
    return res.status(500).json({
      ok: false,
      error: "settings_save_failed",
    });
  }
});

router.post("/settings-config/reset", (req, res) => {
  try {
    const reset = resetSettings();
    return res.json({
      ok: true,
      settings: reset,
    });
  } catch (error) {
    console.error("settings RESET error:", error);
    return res.status(500).json({
      ok: false,
      error: "settings_reset_failed",
    });
  }
});

module.exports = router;
