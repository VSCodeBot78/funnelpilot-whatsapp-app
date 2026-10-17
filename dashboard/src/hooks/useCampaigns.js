import { useEffect, useState } from "react";
import {
  makeId,
  getDefaultBookingConfig,
  getNormalizedBookingConfig,
  getDefaultOfferContext,
  getNormalizedOfferContext,
  getDefaultEntryConfig,
  getNormalizedEntryConfig,
  getNormalizedPeteCampaignConfig,
} from "../utils/dashboardHelpers";
import { applyCampaignStarterTemplate } from "../campaigns/campaignTemplates.js";
import { getCampaignDraftChanges } from "../campaigns/campaignDraftChanges.js";
import {
  loadCampaignSchedulingConfigFromApi,
  saveCampaignSchedulingConfigToApi,
  loadCampaignsFromApi,
  createCampaignInApi,
  updateCampaignInApi,
  deleteCampaignInApi,
} from "../services/campaignsApi";

export function createInitialCampaigns(settings) {
  return [
    {
      id: "fit",
      name: "Mama Papa Kampagne",
      trigger:
        "Hi Jochen, ich habe deine Anzeige gesehen und interessiere mich für die ELTERN VITAL METHODE. Kannst du mir mehr Infos schicken?",
      askNameFirst: true,
      useGlobalBookingDefaults: false,
      offerContext: getDefaultOfferContext(),
      peteCampaign: getNormalizedPeteCampaignConfig(),
      entryConfig: getDefaultEntryConfig(
        "Hi Jochen, ich habe deine Anzeige gesehen und interessiere mich fÃ¼r die ELTERN VITAL METHODE. Kannst du mir mehr Infos schicken?",
      ),
      slot1: "Montag 19:00",
      slot2: "Montag 19:45",
      booking: {
        provider: "calendly",
        calendarId: settings.calendarId || "",
        externalBookingUrl: settings.defaultBookingUrl,
        videoProvider: "none",
        meetingType: "phone",
        durationMinutes: 15,
        maxSuggestions: Number(settings.maxSuggestions || 2),
        notes: "Produktive Hauptkampagne mit Backend-Flowtexten als Referenz.",
        bookingPrompt: settings.bookingPrompt,
        starterCheckoutUrl: settings.starterCheckoutUrl,
        onboardingBookingUrl: settings.onboardingBookingUrl,
      },
      welcome: `Freut mich [Name]
Bevor ich dir einfach irgendwas schicke,
lass uns kurz schauen, ob das überhaupt zu deiner Situation passt.
Ich stelle dir dazu kurz ein paar schnelle Fragen, ok?`,
      q1: `Was merkst du aktuell im Alltag am meisten?
a) ich bin oft müde / platt
b) ich fühle mich nicht mehr wohl in meinem Körper
c) ich kriege Bewegung nicht mehr richtig unter
d) irgendwie alles zusammen`,
      q2: `Hast du bisher schon mal was versucht, um etwas zu verändern?`,
      q3: `Und wenn sich in den nächsten 2-3 Monaten nichts verändert:
Was würde dich daran am meisten nerven?`,
      goal: `Und wenn du 3-6 Monate weiter wärst, was wäre für dich der wichtigste Unterschied?
a) wieder mehr Energie im Alltag
b) mich wieder wohler in meinem Körper fühlen
c) wieder regelmäßig Bewegung schaffen
d) endlich alles zusammen in meinem Griff bekommen`,
      scale: `Und wenn du jetzt 100% ehrlich bist:
Wie wichtig ist dir das gerade auf einer Skala von 1-10, das wirklich anzugehen?`,
      hot: `Ein kurzer Austausch ist hier am sinnvollsten.
Wann passt es dir eher?
a) unter der Woche abends
b) Freitag oder Samstag tagsüber
c) ich bin flexibel`,
      followUp24h: `Hey [Name] 😊
Kurze Erinnerung – ich weiß, der Elternalltag ist manchmal hektisch.
Wenn du noch interessiert bist, bin ich da.`,
      followUp3d: `Hey [Name] 😊
Letzte Erinnerung von mir.`,
    },
    {
      id: "reset",
      name: "Dummy Kampagne",
      trigger: "DUMMY TEST",
      askNameFirst: true,
      useGlobalBookingDefaults: false,
      offerContext: getDefaultOfferContext(),
      peteCampaign: getNormalizedPeteCampaignConfig(),
      entryConfig: getDefaultEntryConfig("DUMMY TEST"),
      slot1: "Mittwoch 12:00",
      slot2: "Donnerstag 18:30",
      booking: {
        provider: "manual",
        calendarId: settings.calendarId || "",
        externalBookingUrl: "",
        videoProvider: "none",
        meetingType: "phone",
        durationMinutes: 15,
        maxSuggestions: Number(settings.maxSuggestions || 2),
        notes: "Bewusste Testkampagne zum Rumprobieren ohne Risiko für den Hauptflow.",
        bookingPrompt:
          "Dummy Buchungsfrage:\nWann würdest du prinzipiell Zeit finden?\n" +
          "a) eher morgens\n" +
          "b) eher abends\n" +
          "c) ganz unterschiedlich",
        starterCheckoutUrl: settings.starterCheckoutUrl,
        onboardingBookingUrl: settings.onboardingBookingUrl,
      },
      welcome: `Hey [Name] 😊
das ist die Dummy Kampagne.
Hier kannst du frei testen, wie der Bot auf andere Hooks oder Antworten reagiert.`,
      q1: `Was soll hier getestet werden?
a) Hook
b) Frage
c) Einwand
d) Booking`,
      q2: `Was genau willst du ausprobieren?`,
      q3: `Woran würdest du merken, dass die Antwort besser ist?`,
      goal: `Was ist in dieser Dummy Kampagne gerade dein Ziel?
a) bessere Hooks
b) besserer Flow
c) bessere Antworten
d) einfach testen`,
      scale: `Wie wichtig ist dir dieser Test gerade auf einer Skala von 1-10?`,
      hot: `Alles klar 👍
Dann testen wir hier weiter, ohne die Hauptkampagne anzufassen.`,
      followUp24h: `Dummy Follow-up nach 24h.`,
      followUp3d: `Dummy Follow-up nach 3 Tagen.`,
    },
  ];
}

const emptyCampaignForm = {
  id: "",
  name: "",
  trigger: "",
  askNameFirst: false,
  useGlobalBookingDefaults: false,
  offerContext: getDefaultOfferContext(),
  entryConfig: getDefaultEntryConfig(),
  peteCampaign: getNormalizedPeteCampaignConfig(),
  slot1: "",
  slot2: "",
  booking: getDefaultBookingConfig({}),
  welcome: "",
  q1: "",
  q2: "",
  q3: "",
  goal: "",
  scale: "",
  hot: "",
  followUp24h: "",
  followUp3d: "",
};

export function useCampaigns({
  settings,
  initialCampaigns = [],
  initialCampaignId = "fit",
}) {
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [activeCampaignId, setActiveCampaignId] = useState(initialCampaignId);
  const [campaignForm, setCampaignForm] = useState(initialCampaigns[0] || null);
  // Latest confirmed/loaded values, separate from locally edited fields.
  const [campaignFormBaseline, setCampaignFormBaseline] = useState(initialCampaigns[0] || null);
  const [campaignMessage, setCampaignMessage] = useState("");
  const [campaignSaving, setCampaignSaving] = useState(false);
  const [campaignLoading, setCampaignLoading] = useState(false);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [backendCampaignIds, setBackendCampaignIds] = useState(
    () => new Set(initialCampaigns.map((campaign) => campaign.id)),
  );

  useEffect(() => {
    // Discard in-flight booking loads when the owner selects another campaign.
    let cancelled = false;
    const campaign = campaigns.find((c) => c.id === activeCampaignId);
    // A background refresh or save response must not erase unsaved edits.
    // An explicit campaign switch has a different ID and loads normally.
    if (campaignForm?.id === activeCampaignId &&
        campaignFormBaseline?.id === activeCampaignId &&
        getCampaignDraftChanges(campaignForm, campaignFormBaseline, settings)) {
      return () => { cancelled = true; };
    }

    if (campaign) {
      const nextCampaignForm = {
        ...campaign,
        useGlobalBookingDefaults: campaign.useGlobalBookingDefaults === true,
        offerContext: getNormalizedOfferContext(campaign),
        entryConfig: getNormalizedEntryConfig(campaign),
        peteCampaign: getNormalizedPeteCampaignConfig(campaign),
        booking: getNormalizedBookingConfig(campaign, settings),
      };

      setCampaignForm(nextCampaignForm);
      setCampaignFormBaseline(nextCampaignForm);
      loadSchedulingConfigForCampaign(nextCampaignForm);
    }

    async function loadSchedulingConfigForCampaign(campaignToLoad) {
      if (!campaignToLoad?.id) return;

      try {
        setCampaignLoading(true);
        setCampaignMessage("");

        const bookingConfig = await loadCampaignSchedulingConfigFromApi({
          apiBaseUrl: settings.apiBaseUrl,
          campaign: campaignToLoad,
          settings,
        });

        if (cancelled || campaignToLoad.useGlobalBookingDefaults === true) {
          return;
        }

        // A late backend response must never clobber a different campaign
        // or an owner-edited booking form.
        setCampaignForm((prev) => {
          if (prev?.id !== campaignToLoad.id) return prev;
          const bookingWasNotEdited =
            JSON.stringify(getNormalizedBookingConfig(prev, settings)) ===
            JSON.stringify(getNormalizedBookingConfig(campaignToLoad, settings));
          return bookingWasNotEdited ? { ...prev, booking: bookingConfig } : prev;
        });
        setCampaignFormBaseline((prev) => prev?.id === campaignToLoad.id
          ? { ...prev, booking: bookingConfig }
          : prev);
      } catch (error) {
        if (!cancelled) {
          console.error("scheduling config load error:", error);
          setCampaignMessage(
            error instanceof Error
              ? error.message
              : "Scheduling-Konfiguration konnte nicht geladen werden.",
          );
        }
      } finally {
        if (!cancelled) setCampaignLoading(false);
      }
    }

    return () => { cancelled = true; };
  }, [activeCampaignId, campaigns, settings]);

  useEffect(() => {
    let cancelled = false;
    async function loadCampaigns() {
      try {
        setCampaignsLoading(true);
        setCampaignMessage("");

        const loadedCampaigns = await loadCampaignsFromApi(settings.apiBaseUrl);
        if (cancelled) return;
        if (Array.isArray(loadedCampaigns) && loadedCampaigns.length) {
          const normalizedCampaigns = loadedCampaigns.map((campaign) => ({
            ...campaign,
            offerContext: getNormalizedOfferContext(campaign),
            entryConfig: getNormalizedEntryConfig(campaign),
            peteCampaign: getNormalizedPeteCampaignConfig(campaign),
          }));

          setCampaigns(normalizedCampaigns);
          setBackendCampaignIds(
            new Set(normalizedCampaigns.map((campaign) => campaign.id)),
          );

          setActiveCampaignId((currentId) =>
            normalizedCampaigns.some((campaign) => campaign.id === currentId)
              ? currentId : normalizedCampaigns[0].id);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("campaigns load error:", error);
          setCampaignMessage(
            error instanceof Error
              ? error.message
              : "Kampagnen konnten nicht geladen werden.",
          );
        }
      } finally {
        if (!cancelled) setCampaignsLoading(false);
      }
    }

    loadCampaigns();
    return () => { cancelled = true; };
  }, [settings.apiBaseUrl]);

  useEffect(() => {
    if (!campaignMessage) return;
    const timeout = setTimeout(() => setCampaignMessage(""), 3000);
    return () => clearTimeout(timeout);
  }, [campaignMessage]);

  async function createNewCampaign(templateId = "blank") {
    // Fail closed on an unknown template and never show a phantom saved campaign.
    let newCampaign;
    try {
      newCampaign = applyCampaignStarterTemplate({
        ...emptyCampaignForm,
        id: makeId(),
        name: "Neue Kampagne",
        trigger: "",
        slot1: "", slot2: "",
        booking: getDefaultBookingConfig(settings),
        offerContext: getDefaultOfferContext(),
        peteCampaign: getNormalizedPeteCampaignConfig(),
        entryConfig: getDefaultEntryConfig(""),
        useGlobalBookingDefaults: false,
      }, templateId);
    } catch (error) {
      setCampaignMessage("Vorlage nicht gefunden. Keine Kampagne angelegt.");
      return;
    }
    setCampaignSaving(true);
    setCampaignMessage("");
    try {
      const created = await createCampaignInApi(newCampaign, settings.apiBaseUrl);
      // Backend confirmation is the only point at which a campaign is created locally.
      const saved = {
        ...newCampaign, ...created,
        peteCampaign: getNormalizedPeteCampaignConfig(created),
        offerContext: getNormalizedOfferContext(created),
        entryConfig: getNormalizedEntryConfig(created),
      };
      setBackendCampaignIds((prev) => new Set(prev).add(saved.id));
      setCampaigns((prev) => [...prev, saved]);
      setActiveCampaignId(saved.id);
      setCampaignForm(saved);
      setCampaignFormBaseline(saved);
      setCampaignMessage("Kampagne aus Vorlage angelegt. Noch kein Live-Versand.");
    } catch (error) {
      console.error("campaign create error:", error);
      setCampaignMessage("Kampagne konnte nicht im Backend angelegt werden. Bitte erneut versuchen.");
    } finally {
      setCampaignSaving(false);
    }
  }

  async function saveCampaign() {
    if (!campaignForm?.id) return false;

    let campaignSavedToBackend = false;
    try {
      setCampaignSaving(true);
      setCampaignMessage("");

      const cleanTrigger = campaignForm.trigger.trim();
      const cleanName = campaignForm.name.trim();

      const updatedCampaign = {
        ...campaignForm,
        useGlobalBookingDefaults: campaignForm.useGlobalBookingDefaults === true,
        name: cleanName || "Neue Kampagne",
        trigger: cleanTrigger,
        offerContext: getNormalizedOfferContext(campaignForm),
        peteCampaign: getNormalizedPeteCampaignConfig(campaignForm),
        entryConfig: getNormalizedEntryConfig({
          ...campaignForm,
          trigger: cleanTrigger,
        }),
        booking: getNormalizedBookingConfig(campaignForm, settings),
      };

      const campaignExistsInBackend = backendCampaignIds.has(updatedCampaign.id);
      if (campaignExistsInBackend) {
        await updateCampaignInApi(updatedCampaign, settings.apiBaseUrl);
      } else {
        const created = await createCampaignInApi(updatedCampaign, settings.apiBaseUrl);
        setBackendCampaignIds((prev) => new Set(prev).add(created.id));
      }

      // Only show a persisted campaign after the backend confirms its write.
      campaignSavedToBackend = true;
      setCampaigns((prev) =>
        prev.map((campaign) =>
          campaign.id === updatedCampaign.id ? updatedCampaign : campaign,
        ),
      );
      // Preserve edits made while a save was in flight; the baseline still
      // advances to what the backend actually confirmed.
      setCampaignForm((prev) =>
        prev?.id === updatedCampaign.id &&
          !getCampaignDraftChanges(prev, campaignForm, settings)
          ? updatedCampaign : prev);
      setCampaignFormBaseline((prev) =>
        prev?.id === updatedCampaign.id ? updatedCampaign : prev);

      await saveCampaignSchedulingConfigToApi({
        apiBaseUrl: settings.apiBaseUrl,
        campaign: updatedCampaign,
        settings,
      });

      setCampaignMessage("Kampagne und Buchungslogik gespeichert.");
      return true;
    } catch (error) {
      console.error("campaign save error:", error);
      setCampaignMessage(campaignSavedToBackend
        ? "Kampagne gespeichert, aber Buchungslogik nicht bestätigt. Bitte erneut speichern."
        : "Kampagne nicht im Backend gespeichert. Änderungen bleiben im Formular.");
      return false;
    } finally {
      setCampaignSaving(false);
    }
  }

  async function deleteCampaign() {
    if (!campaignForm?.id) return null;

    if (campaigns.length <= 1) {
      alert("Mindestens eine Kampagne muss bestehen bleiben.");
      return null;
    }

    const deleteId = campaignForm.id;

    if (backendCampaignIds.has(deleteId)) {
      try {
        await deleteCampaignInApi(deleteId, settings.apiBaseUrl);
        setBackendCampaignIds((prev) => {
          const next = new Set(prev);
          next.delete(deleteId);
          return next;
        });
      } catch (error) {
        console.error("campaign delete error:", error);
        setCampaignMessage(
          error instanceof Error
            ? error.message
            : "Kampagne konnte nicht im Backend gelöscht werden.",
        );
        return null;
      }
    }

    const remaining = campaigns.filter((campaign) => campaign.id !== deleteId);
    const fallbackCampaign = remaining[0];

    if (!fallbackCampaign) return null;

    setCampaigns(remaining);
    setActiveCampaignId(fallbackCampaign.id);
    setCampaignForm(fallbackCampaign);
    setCampaignFormBaseline(fallbackCampaign);

    return {
      deletedCampaignId: deleteId,
      fallbackCampaignId: fallbackCampaign.id,
    };
  }

  return {
    campaigns,
    activeCampaignId,
    campaignForm,
    campaignFormBaseline,
    campaignMessage,
    campaignSaving,
    campaignLoading,
    setCampaigns,
    setActiveCampaignId,
    setCampaignForm,
    createNewCampaign,
    saveCampaign,
    deleteCampaign,
  };
}
