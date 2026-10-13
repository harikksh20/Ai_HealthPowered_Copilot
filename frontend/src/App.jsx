import { useEffect, useMemo, useRef, useState } from "react";

import {

 Activity,

 ArrowRight,

 Bell,

 CalendarDays,

 CheckCircle2,

  ChevronDown,

  ChevronRight,

  CircleHelp,

  FileHeart,

  FilePlus2,

  FileText,

  FlaskConical,

  HeartPulse,

  Languages,

  LayoutDashboard,

  Menu,

  Pill,

  Search,

  ShieldCheck,

  Sparkles,

  Stethoscope,

  UploadCloud,

  X,

  AlertCircle,

} from "lucide-react";

import { translations } from "./translations.js";

import {

  ResponsiveContainer,

  LineChart,

  Line,

  XAxis,

  YAxis,

  CartesianGrid,

  Tooltip,

} from "recharts";

const sampleRecords = [

  {

    id: "sample-cbc",

    name: "Complete Blood Count.pdf",

    type: "Lab report",

    date: "12 Oct 2026",

    status: "Review needed",

    note: "Example record",

  },

  {

    id: "sample-rx",

    name: "Prescription — Dr. Kumar.jpg",

    type: "Prescription",

    date: "08 Oct 2026",

    status: "Review needed",

    note: "Example record",

  },

  {

    id: "sample-discharge",

    name: "Discharge summary.pdf",

    type: "Discharge summary",

    date: "22 Sep 2026",

    status: "Processed",

    note: "Example record",

  },

];

const API_BASE = (

  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000"

).replace(/\/$/, "");

export default function App() {

  const [language, setLanguage] = useState("English");

  const [activePage, setActivePage] = useState("overview");

  const [records, setRecords] = useState(sampleRecords);

  const [search, setSearch] = useState("");

  const [notice, setNotice] = useState("");

  const [busy, setBusy] = useState(false);

  const [syncing, setSyncing] = useState(false);

  const [menuOpen, setMenuOpen] = useState(false);

  const [reviewRecord, setReviewRecord] = useState(null);

  const [extracting, setExtracting] = useState(false);

  const [extractedObservations, setExtractedObservations] = useState([]);

  const [summarizing, setSummarizing] = useState(false);

  const [aiSummary, setAiSummary] = useState("");

  const [aiSummaryError, setAiSummaryError] = useState("");

  const [savedSummaries, setSavedSummaries] = useState([]);

  const [loadingSavedSummaries, setLoadingSavedSummaries] = useState(false);

  const [trendObservations, setTrendObservations] = useState([]);

  const [loadingTrends, setLoadingTrends] = useState(false);

  const [trendError, setTrendError] = useState("");

  const [selectedTest, setSelectedTest] = useState("");

  const [selectedDocumentType, setSelectedDocumentType] = useState("lab_report");

  const [extractedMedications, setExtractedMedications] = useState([]);

  const [timelineEntries, setTimelineEntries] = useState([]);

  const [loadingTimeline, setLoadingTimeline] = useState(false);

  const [timelineError, setTimelineError] = useState("");

  const inputRef = useRef(null);

  const t = translations[language];

  const isShowingSamples =

    records.length > 0 &&

    records.every((record) =>

      String(record.id).startsWith("sample-")

    );

  const navItems = [

    { id: "overview", label: t.overview, Icon: LayoutDashboard },

    { id: "records", label: t.records, Icon: FileHeart },

    { id: "medications", label: t.medications, Icon: Pill },

    { id: "timeline", label: t.timeline, Icon: CalendarDays },

  ];

  const visibleRecords = useMemo(

    () =>

      records.filter((record) =>

        `${record.name} ${record.type} ${record.status}`

          .toLowerCase()

          .includes(search.toLowerCase())

      ),

    [records, search]

  );

  // Load documents from Django.

  async function refreshRecords() {

    setSyncing(true);

    try {

      const response = await fetch(`${API_BASE}/api/documents/`);

      const payload = await response.json();

      if (!response.ok) {

        throw new Error(

          payload.error || `Request failed: HTTP ${response.status}`

        );

      }

      const list = Array.isArray(payload)

        ? payload

        : payload.results || payload.documents || [];

      setRecords(

        list.map((item) => ({

          id: item.id ?? item.pk,

          name:

            item.original_name ??

            item.name ??

            item.filename ??

            "Medical document",

          type:

            item.document_type ??

            item.type ??

            "Medical record",

          date: (item.uploaded_at || item.date)

             ? new Date(item.uploaded_at || item.date).toLocaleDateString()

            : "Date unavailable",

          status:

            item.extraction_status === "completed"

              ? "Processed"

              : item.extraction_status === "failed" ||

                  item.extraction_status === "empty_text"

                ? "Review needed"

                : "Uploaded",

          note: "From your records",

        }))

      );

      setNotice(`Synced ${list.length} document(s) successfully.`);

    } catch (error) {

      setNotice(`Sync failed: ${error.message}`);

    } finally {

      setSyncing(false);

    }

  }

  // Automatically sync documents when the dashboard opens.

  useEffect(() => {

    refreshRecords();

    loadHealthTrends();

  }, []);

  // Upload documents to Django.

  async function handleUpload(event) {

    const selected = Array.from(event.target.files || []);

    event.target.value = "";

    if (!selected.length) return;

    const allowed = /\.(pdf|png|jpe?g|webp|tif|tiff|bmp)$/i;

    const invalid = selected.find((file) => !allowed.test(file.name));

    if (invalid) {

      setNotice(`Unsupported file type: ${invalid.name}`);

      return;

    }

    setBusy(true);

    setNotice("");

    try {

      const added = [];

      for (const file of selected) {

        const body = new FormData();

        body.append("file", file);

        body.append("document_type", selectedDocumentType);

        const response = await fetch(`${API_BASE}/api/documents/`, {

          method: "POST",

          body,

        });

        const item = await response.json();

        if (!response.ok) {

          throw new Error(

            item.error || `Upload failed: HTTP ${response.status}`

          );

        }

        added.push({

          id: item.id ?? item.pk,

          name: item.original_name ?? item.name ?? file.name,

          type: item.document_type ?? item.type ?? "Medical record",

          date: item.uploaded_at

            ? new Date(item.uploaded_at).toLocaleDateString()

            : new Date().toLocaleDateString(),

          status: "Uploaded",

          note: "Awaiting extraction",

        });

      }

      await refreshRecords();

      setNotice(

        `Upload complete: ${added.length} document(s). Open a document to run OCR extraction.`

      );

    } catch (error) {

      setNotice(`Upload failed: ${error.message}`);

    } finally {

      setBusy(false);

    }

  }

  // Load saved summaries for a document.

function openRecord(record) {

  if (!record) return;

  setReviewRecord(record);

  setExtractedObservations([]);

  setAiSummary("");

  setAiSummaryError("");

  setSavedSummaries([]);

  if (String(record.id).startsWith("sample-")) {

    setLoadingSavedSummaries(false);

    return;

  }

  loadSavedSummaries(record.id);

}

function closeRecord() {

  setReviewRecord(null);

  setExtractedObservations([]);

  setAiSummary("");

  setAiSummaryError("");

  setSavedSummaries([]);

  setLoadingSavedSummaries(false);

}

async function loadSavedSummaries(documentId) {

  setLoadingSavedSummaries(true);

  try {

    const response = await fetch(

      `${API_BASE}/api/documents/${documentId}/ai-summaries/`

    );

    const payload = await response.json();

    if (!response.ok) {

      throw new Error(payload.error || `HTTP ${response.status}`);

    }

    setSavedSummaries(payload.summaries || []);

  } catch (error) {

    console.error("Saved summaries error:", error);

    setNotice(`Could not load saved summaries: ${error.message}`);

  } finally {

    setLoadingSavedSummaries(false);

  }

}

async function runExtraction() {

  if (!reviewRecord || String(reviewRecord.id).startsWith("sample-")) {

    setNotice("This is sample data. Upload a real document before running extraction.");

    return;

  }

  setExtracting(true);

  setExtractedObservations([]);

  setExtractedMedications([]);

  setAiSummary("");

  setAiSummaryError("");

  try {

    const extractResponse = await fetch(

      `${API_BASE}/api/documents/${reviewRecord.id}/extract/`,

      { method: "POST" }

    );

    const extractPayload = await extractResponse.json();

    if (!extractResponse.ok) {

      throw new Error(

        extractPayload.details || extractPayload.error ||

        `Extraction failed: HTTP ${extractResponse.status}`

      );

    }

    const isPrescription =

      String(reviewRecord.type).toLowerCase().includes("prescription") ||

      reviewRecord.document_type === "prescription";

    if (isPrescription) {

      const medications = extractPayload.medications || [];

      setExtractedMedications(medications);

      setNotice(

        medications.length

          ? `Prescription extraction returned ${medications.length} medication candidate(s). Verify every detail against the original prescription.`

          : "Text extraction completed, but no medication candidates were recognized. Review the original prescription."

      );

    } else {

      const observationsResponse = await fetch(

        `${API_BASE}/api/documents/${reviewRecord.id}/observations/`

      );

      const observationsPayload = await observationsResponse.json();

      if (!observationsResponse.ok) {

        throw new Error(

          observationsPayload.error ||

          `Could not load observations: HTTP ${observationsResponse.status}`

        );

      }

      const observations =

        observationsPayload.observations || extractPayload.observations || [];

      setExtractedObservations(observations);

      setNotice(

        observations.length

          ? `Extraction complete: ${observations.length} observation(s). Verify every value against the original report.`

          : "Text extraction completed, but no lab observations were recognized. Check the extracted text and parser."

      );

    }

    await refreshRecords();

    await loadHealthTrends();

    if (activePage === "timeline" || activePage === "medications") {

      await loadTimeline();

    }

  } catch (error) {

    setNotice(`Extraction failed: ${error.message}`);

  } finally {

    setExtracting(false);

  }

}

async function loadHealthTrends() {

  setLoadingTrends(true);

  setTrendError("");

  try {

    const response = await fetch(`${API_BASE}/api/documents/`);

    const payload = await response.json();

    if (!response.ok) {

      throw new Error(payload.error || `HTTP ${response.status}`);

    }

    const documents = Array.isArray(payload)

      ? payload

      : payload.results || payload.documents || [];

    const results = await Promise.all(

      documents.map(async (document) => {

        const id = document.id ?? document.pk;

        if (!id || document.extraction_status !== "completed") {

          return [];

        }

        const resultResponse = await fetch(

          `${API_BASE}/api/documents/${id}/observations/`

        );

        if (!resultResponse.ok) return [];

        const resultPayload = await resultResponse.json();

        return (resultPayload.observations || []).map((observation) => ({

          ...observation,

          document_id: id,

          document_name: document.original_name || document.name || "Medical report",

          report_date:

            observation.effective_date ||

            document.uploaded_at ||

            document.date ||

            null,

        }));

      })

    );

    const combined = results.flat();

    const uniqueResults = Array.from(

      new Map(

        combined.map((item) => [

          `${item.document_id}-${item.id}`,

           item,

        ])

      ).values()

    );

    setTrendObservations(uniqueResults);

    const testNames = [

      ...new Set(

        combined

          .filter((item) => item.report_date && item.value !== "")

          .map((item) => item.test_name)

      ),

    ];

    setSelectedTest((current) =>

      testNames.includes(current) ? current : testNames[0] || ""

    );

  } catch (error) {

    setTrendError(error.message || "Unable to load health trends.");

  } finally {

    setLoadingTrends(false);

  }

}

  async function loadTimeline() {

    setLoadingTimeline(true);

    setTimelineError("");

    try {

      const response = await fetch(`${API_BASE}/api/timeline/`);

      const payload = await response.json();

      if (!response.ok) {

        throw new Error(payload.error || `Timeline request failed: HTTP ${response.status}`);

      }

      setTimelineEntries(payload.timeline || []);

    } catch (error) {

      setTimelineError(error.message || "Unable to load the health timeline.");

    } finally {

      setLoadingTimeline(false);

    }

  }

  useEffect(() => {

    if (activePage === "timeline" || activePage === "medications") {

      loadTimeline();

    }

  }, [activePage]);

  // Generate and save a Gemini summary.

  async function generateAiSummary() {

    if (

      !reviewRecord ||

      String(reviewRecord.id).startsWith("sample-")

    ) {

      setAiSummaryError(

        "Select an uploaded document instead of a sample record."

      );

      return;

    }

    setSummarizing(true);

    setAiSummary("");

    setAiSummaryError("");

    try {

      const response = await fetch(

        `${API_BASE}/api/documents/${reviewRecord.id}/ai-summary/`,

        { method: "POST" }

      );

      const payload = await response.json();

      if (!response.ok) {

        throw new Error(

          payload.details ||

            payload.error ||

            `Request failed: HTTP ${response.status}`

        );

      }

      if (!payload.summary) {

        throw new Error("The API returned an empty summary.");

      }

      setAiSummary(payload.summary);

      // Reload summaries because the backend saves the new summary.

      await loadSavedSummaries(reviewRecord.id);

    } catch (error) {

      setAiSummaryError(

        error.message || "Unable to generate the AI summary."

      );

    } finally {

      setSummarizing(false);

    }

  }

  function showQuestionPrompt() {

    setNotice(t.questionPrompt);

  }

  const isReviewingPrescription = Boolean(

    reviewRecord && (

      String(reviewRecord.document_type || "").toLowerCase() === "prescription" ||

      String(reviewRecord.type || "").toLowerCase().includes("prescription")

    )

  );

  return (

    <div className="app-shell">

      <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>

        <div className="brand">

          <div className="brand-mark">

            <HeartPulse size={22} />

          </div>

          <div>

            <strong>

              wellnest<span>.</span>

            </strong>

            <small>YOUR PERSONAL HEALTH COPILOT</small>

          </div>

          <button

            className="close-menu"

            aria-label="Close navigation"

            onClick={() => setMenuOpen(false)}

          >

            <X size={18} />

          </button>

        </div>

        <div className="profile-switch">

          <div className="avatar">S</div>

          <div className="profile-text">

            <strong>{t.profile}</strong>

            <span>Personal account</span>

          </div>

          <ChevronDown size={16} />

        </div>

        <div className="nav-caption">{t.workspace}</div>

        <nav aria-label="Main navigation">

          {navItems.map(({ id, label, Icon }) => (

            <button

              key={id}

              className={`nav-item ${

                activePage === id ? "active" : ""

              }`}

              onClick={() => {

                setActivePage(id);

                setMenuOpen(false);

              }}

            >

              <Icon size={18} />

              <span>{label}</span>

              {id === "records" && (

                <span className="nav-count">{records.length}</span>

              )}

            </button>

          ))}

        </nav>

        <div className="sidebar-bottom">

          <div className="privacy-card">

            <ShieldCheck size={19} />

            <strong>{t.privacy}</strong>

            <p>{t.privacyBody}</p>

          </div>

          <button

            className="nav-item help-link"

            onClick={() =>

              setNotice(

                "Wellnest is a prototype. Contact a qualified healthcare professional for medical concerns."

              )

            }

          >

            <CircleHelp size={18} />

            {t.help}

          </button>

          <div className="sidebar-foot">

            Made for people, not just records <span>♥</span>

          </div>

        </div>

      </aside>

      {menuOpen && (

        <button

          className="scrim"

          aria-label="Close menu"

          onClick={() => setMenuOpen(false)}

        />

      )}

      <main className="main">

        <header className="topbar">

          <div className="top-left">

            <button

              className="mobile-menu icon-btn"

              aria-label="Open navigation"

              onClick={() => setMenuOpen(true)}

            >

              <Menu size={20} />

            </button>

            <div className="breadcrumb">

              Wellnest <ChevronRight size={14} />

              <strong>

                {navItems.find((item) => item.id === activePage)?.label}

              </strong>

            </div>

          </div>

          <div className="top-actions">

            <label className="language-control">

              <Languages size={16} />

              <span className="sr-only">{t.language}</span>

              <select

                value={language}

                onChange={(event) => {

                  setLanguage(event.target.value);

                  document.documentElement.lang = {

                    English: "en",

                    தமிழ்: "ta",

                    हिन्दी: "hi",

                    తెలుగు: "te",

                  }[event.target.value];

                }}

                aria-label={t.language}

              >

                {Object.keys(translations).map((name) => (

                  <option key={name}>{name}</option>

                ))}

              </select>

              <ChevronDown size={14} />

            </label>

            <button

              className="icon-btn"

              aria-label="Notifications"

              onClick={() =>

                setNotice(

                  "You're all caught up. There are no new reminders in this prototype."

                )

              }

            >

              <Bell size={18} />

            </button>

            <div className="top-avatar" aria-label="Profile">

              S

            </div>

          </div>

        </header>

        <div className="page-content">

          {activePage === "overview" && (

            <>

          <section className="welcome-row">

            <div>

              <div className="eyebrow">

                <span className="live-dot" />

                {t.eyebrow}

              </div>

              <h1>

                {t.greeting} <span className="wave">✦</span>

              </h1>

              <p className="subheading">{t.subtitle}</p>

            </div>

            <div className="date-pill">

              <CalendarDays size={16} />

              <span>{new Date().toLocaleDateString()}</span>

            </div>

          </section>

          {notice && (

            <div className="notice" role="status">

              <div>

                <AlertCircle size={17} />

                <span>{notice}</span>

              </div>

              <button

                aria-label="Dismiss message"

                onClick={() => setNotice("")}

              >

                <X size={16} />

              </button>

            </div>

          )}

          {isShowingSamples && (

            <div className="sample-notice">

              <Sparkles size={15} />

              <span>

                <b>{t.sample}:</b> {t.sampleNotice}

              </span>

            </div>

          )}

          <section className="hero-card">

            <div className="hero-copy">

              <div className="ai-label">

                <Sparkles size={14} /> {t.healthBrief}

              </div>

              <h2>{t.heroTitle}</h2>

              <p>{t.heroBody}</p>

              <label className="trend-select-label" style={{ display: "block", marginBottom: 12 }}>

                Document type

                <select

                  value={selectedDocumentType}

                  onChange={(event) => setSelectedDocumentType(event.target.value)}

                  disabled={busy}

                  style={{ display: "block", width: "100%", marginTop: 6 }}

                >

                  <option value="lab_report">Lab report</option>

                  <option value="prescription">Prescription</option>

                  <option value="discharge_summary">Discharge summary</option>

                  <option value="other">Other medical record</option>

                </select>

              </label>

                            <button

                className="hero-btn"

                onClick={() => inputRef.current?.click()}

                disabled={busy}

              >

                <UploadCloud size={17} />

                {busy ? "Uploading…" : t.upload}

                <ArrowRight size={16} />

              </button>

              <input

                ref={inputRef}

                type="file"

                hidden

                multiple

                accept=".pdf,.png,.jpg,.jpeg,.webp,.tif,.tiff,.bmp"

                onChange={handleUpload}

              />

              <div className="hero-foot">

                <ShieldCheck size={14} />

                {t.uploadHint}

              </div>

            </div>

            <div className="hero-art" aria-hidden="true">

              <div className="orbit orbit-one" />

              <div className="orbit orbit-two" />

              <div className="art-glow" />

              <div className="health-orb">

                <HeartPulse size={50} strokeWidth={1.5} />

              </div>

              <div className="float-chip chip-top">

                <span className="chip-icon purple">

                  <Sparkles size={14} />

                </span>

                <div>

                  <b>Human-friendly insights</b>

                  <small>Complex to clear</small>

                </div>

              </div>

              <div className="float-chip chip-bottom">

                <span className="chip-icon green">

                  <CheckCircle2 size={15} />

                </span>

                <div>

                  <b>One health profile</b>

                  <small>Care in context</small>

                </div>

              </div>

              <span className="tiny-star star-one">✳</span>

              <span className="tiny-star star-two">✦</span>

            </div>

          </section>

          <section className="stats-grid" aria-label="Health record summary">

            <div className="stat-card">

              <div className="stat-top">

                <span className="stat-icon violet">

                  <FileText size={18} />

                </span>

                <span className="stat-label">IN YOUR PROFILE</span>

              </div>

              <div className="stat-value">

                {String(records.length).padStart(2, "0")}

                <span> records</span>

              </div>

              <p>Medical documents in your profile</p>

              <div className="stat-bottom">

                <span className="mini-bar">

                  <i style={{ width: "72%" }} />

                </span>

                <span>Organised</span>

              </div>

            </div>

            <div className="stat-card">

              <div className="stat-top">

                <span className="stat-icon mint">

                  <FlaskConical size={18} />

                </span>

                <span className="stat-label">RECORD REVIEW</span>

              </div>

              <div className="stat-value">

                {String(

                  records.filter((record) =>

                    /review|upload|pending/i.test(record.status)

                  ).length

                ).padStart(2, "0")}

                <span> to check</span>

              </div>

              <p>Records that may need your attention</p>

              <div className="stat-bottom">

                <span className="mini-bar mint-bar">

                  <i style={{ width: "48%" }} />

                </span>

                <span>Stay up to date</span>

              </div>

            </div>

            <div className="stat-card">

              <div className="stat-top">

                <span className="stat-icon peach">

                  <Activity size={18} />

                </span>

                <span className="stat-label">YOUR NEXT STEP</span>

              </div>

              <div className="stat-value">

                01<span> simple action</span>

              </div>

              <p>Keep questions ready for your care team</p>

              <div className="stat-bottom">

                <span className="mini-bar peach-bar">

                  <i style={{ width: "35%" }} />

                </span>

                <span>Be prepared</span>

              </div>

            </div>

          </section>

<section className="panel health-trends-panel">

  <div className="panel-header">

    <div>

      <div className="section-kicker">YOUR HEALTH OVER TIME</div>

      <h3>Health trends</h3>

      <p>Compare extracted laboratory results across your reports.</p>

    </div>

    <Activity size={22} />

  </div>

  <button

    className="outline-btn"

    onClick={loadHealthTrends}

    disabled={loadingTrends}

  >

    {loadingTrends ? "Loading trends..." : "Refresh health trends"}

  </button>

  {trendError && (

    <p role="alert">{trendError}</p>

  )}

  {!loadingTrends && !trendError && (

    <>

      {(() => {

        const tests = [

          ...new Set(

            trendObservations

              .filter((item) => item.report_date && item.value !== "")

              .map((item) => item.test_name)

          ),

        ];

        const points = trendObservations

          .filter(

            (item) =>

              item.test_name === selectedTest &&

              item.report_date &&

              Number.isFinite(Number(item.value))

          )

          .map((item) => ({

            ...item,

             value: Number(item.value),

          }))

          .sort(

            (a, b) =>

              new Date(a.report_date) - new Date(b.report_date)

          );

        return (

          <>

            <label className="trend-select-label">

              Select laboratory test

              <select

                value={selectedTest}

                onChange={(event) => setSelectedTest(event.target.value)}

              >

                {tests.map((test) => (

                  <option key={test} value={test}>

                    {test}

                  </option>

                ))}

              </select>

            </label>

            {points.length >= 2 ? (

              <div style={{ width: "100%", height: 280, marginTop: 20 }}>

                <ResponsiveContainer width="100%" height="100%">

                  <LineChart data={points}>

                    <CartesianGrid strokeDasharray="3 3" />

                  <XAxis

                    dataKey="report_date"

                    tickFormatter={(date) =>

                      new Date(date).toLocaleDateString()

                    }

                  />

                  <YAxis />

                  <Tooltip

                    labelFormatter={(date) =>

                      new Date(date).toLocaleDateString()

                    }

                  />

                  <Line

                    type="monotone"

                    dataKey="value"

                    name={selectedTest}

                    stroke="#16a34a"

                    strokeWidth={3}

                    dot={{ r: 5 }}

                  />

                </LineChart>

              </ResponsiveContainer>

            </div>

          ) : (

            <div className="empty-state">

              <Activity size={24} />

              <b>Not enough dated results yet</b>

              <span>

                Upload a second report containing the same test to compare values.

              </span>

            </div>

          )}

          </>

        );

      })()}

    </>

  )}

</section>

          <section className="content-grid">

            <div className="panel records-panel">

              <div className="panel-header">

                <div>

                  <div className="section-kicker">YOUR LIBRARY</div>

                  <h3>{t.documents}</h3>

                  <p>{t.recordsHint}</p>

                </div>

                <button

                  className="text-link"

                  onClick={() => setActivePage("records")}

                >

                  {t.records} <ChevronRight size={15} />

                </button>

              </div>

              <div className="record-tools">

                <div className="searchbox">

                  <Search size={16} />

                  <input

                    value={search}

                    onChange={(event) => setSearch(event.target.value)}

                    placeholder={t.search}

                    aria-label={t.search}

                  />

                </div>

                <button

                  className="upload-small"

                  onClick={() => inputRef.current?.click()}

                  disabled={busy}

                >

                  <FilePlus2 size={16} /> {t.add}

                </button>

              </div>

              <div className="records-list">

                {visibleRecords.slice(0, 5).map((record) => (

                  <div

                    className="record-row"

                    key={record.id}

                    role="button"

                    tabIndex={0}

                    onClick={() => openRecord(record)}

                    onKeyDown={(event) => {

                      if (event.key === "Enter" || event.key === " ") {

                        event.preventDefault();

                        openRecord(record);

                      }

                   }}

>

                    <div

                      className={`file-icon ${

                        record.type.toLowerCase().includes("lab")

                          ? "lab-file"

                          : record.type

                                .toLowerCase()

                                .includes("prescription")

                            ? "rx-file"

                            : "other-file"

                      }`}

                    >

                      {record.type.toLowerCase().includes("lab") ? (

                        <FlaskConical size={18} />

                      ) : record.type

                          .toLowerCase()

                          .includes("prescription") ? (

                        <Pill size={18} />

                      ) : (

                        <FileText size={18} />

                      )}

                    </div>

                    <div className="record-info">

                      <strong>{record.name}</strong>

                      <span>

                        {record.type} <i>·</i> {record.date}

                      </span>

                    </div>

                    <span

                      className={`status ${

                        /review|upload|pending/i.test(record.status)

                          ? "status-review"

                          : "status-ok"

                      }`}

                    >

                      <span />

                      {record.status}

                    </span>

                    <button

                      className="row-more"

                      title="Review record"

                      aria-label={`Review ${record.name}`}

                      onClick={(event) => {

                        event.stopPropagation();

                        openRecord(record);

                      }}

                    >

                      <ChevronRight size={18} />

                    </button>

                  </div>

                ))}

                {!visibleRecords.length && (

                  <div className="empty-state">

                    <FileText size={25} />

                    <b>{t.noRecords}</b>

                    <span>{t.noRecordsHint}</span>

                  </div>

                )}

              </div>

              <div className="panel-footer">

                <span>{visibleRecords.length} records found</span>

                <button onClick={refreshRecords} disabled={syncing}>

                  {syncing ? "Syncing..." : "Sync records"}

                  <ArrowRight size={14} />

                </button>

              </div>

            </div>

            <div className="panel insights-panel">

              <div className="panel-header">

                <div>

                  <div className="section-kicker">PLAIN-LANGUAGE GUIDE</div>

                  <h3>{t.labInsights}</h3>

                  <p>{t.labHint}</p>

                </div>

                <div className="sparkle-badge">

                  <Sparkles size={16} />

                </div>

              </div>

              <div className="insight-intro">
                <div className="insight-symbol">
                  <Activity size={19} />
                </div>
                <div>
                  <strong>Health insights</strong>
                  <p>Based on your extracted laboratory results</p>
                </div>
              </div>

              {(() => {
                const latestByTest = new Map();

                [...trendObservations]
                  .filter(
                    (item) =>
                      item.test_name &&
                      item.value !== "" &&
                      item.value !== null &&
                      item.value !== undefined
                  )
                  .sort(
                    (a, b) =>
                      new Date(b.report_date || 0).getTime() -
                      new Date(a.report_date || 0).getTime()
                  )
                  .forEach((item) => {
                    if (!latestByTest.has(item.test_name)) {
                      latestByTest.set(item.test_name, item);
                    }
                  });

                const latestResults = Array.from(latestByTest.values()).slice(0, 3);

                if (latestResults.length === 0) {
                  return (
                    <div className="empty-state">
                      <Activity size={24} />
                      <b>No laboratory results available</b>
                      <span>
                        Upload a lab report and run OCR extraction to see your results here.
                      </span>
                    </div>
                  );
                }

                return latestResults.map((item, index) => (
                  <div
                    className="lab-highlight"
                    key={`${item.document_id || "report"}-${item.test_name}-${index}`}
                  >
                    <div>
                      <span className="lab-label">{item.test_name}</span>
                      <div className="lab-reading">
                        {item.value} <small>{item.unit || "Unit not provided"}</small>
                      </div>
                    </div>

                    <div className="range-labels">
                      <span>
                        Reference range: {item.reference_range || "Not provided"}
                      </span>
                    </div>

                    <p className="insight-note">
                      Compare this result with the reference range on the original report.
                      Automated extraction is educational and is not a diagnosis.
                    </p>
                  </div>
                ));
              })()}

              <div className="insight-note">
                <Sparkles size={15} />
                <p>
                  <b>{t.inSimpleTerms}:</b> Your extracted results are for educational use.
                  Check each value against the original report and discuss questions with
                  a qualified clinician.
                </p>
              </div>

              <button
                className="outline-btn"
                onClick={() => openRecord(records[0] || null)}
              >
                {t.review} <ChevronRight size={16} />
              </button>
            </div>
          </section>

          <section className="bottom-grid">

            <div className="panel timeline-panel">

              <div className="panel-header">

                <div>

                  <div className="section-kicker">YOUR JOURNEY</div>

                  <h3>{t.timelineTitle}</h3>

                  <p>{t.timelineHint}</p>

                </div>

                <button

                  className="text-link"

                  onClick={() => setActivePage("timeline")}

                >

                  {t.timeline} <ChevronRight size={15} />

                </button>

              </div>

              <div className="timeline">

                {records.slice(0, 3).map((record, index) => (

                  <div className="timeline-item" key={record.id}>

                    <div

                      className={`timeline-marker ${

                        index === 0

                          ? "lab-marker"

                          : index === 1

                            ? "rx-marker"

                            : "file-marker"

                      }`}

                    >

                      {index === 0 ? (

                        <FlaskConical size={15} />

                      ) : index === 1 ? (

                        <Pill size={15} />

                      ) : (

                        <Stethoscope size={15} />

                      )}

                    </div>

                    <div className="timeline-body">

                      <div>

                        <strong>{record.name}</strong>

                        <span className="timeline-date">{record.date}</span>

                      </div>

                      <p>

                        {record.type} · {record.status}

                      </p>

                    </div>

                    <span className="timeline-dot" />

                  </div>

                ))}

              </div>

            </div>

            <div className="care-card">

              <div className="care-illustration">

                <div className="care-circle">

                  <Stethoscope size={29} />

                </div>

                <span className="care-spark">✦</span>

              </div>

              <div className="section-kicker">{t.nextStep}</div>

              <h3>{t.nextTitle}</h3>

              <p>{t.nextBody}</p>

              <button onClick={showQuestionPrompt}>

                {t.questions} <ChevronRight size={15} />

              </button>

            </div>

          </section>

          <footer className="disclaimer">

            <ShieldCheck size={16} />

            <p>

              <b>{t.safetyTitle}.</b> {t.safetyBody}

            </p>

          </footer>

            </>

          )}

          {activePage === "records" && (

            <section className="panel" style={{ padding: 24 }}>

              <div className="panel-header">

                <div>

                  <div className="section-kicker">YOUR LIBRARY</div>

                  <h3>Medical records</h3>

                  <p>Open a record to extract and review its contents.</p>

                </div>

                <button className="outline-btn" onClick={refreshRecords} disabled={syncing}>

                  {syncing ? "Syncing..." : "Refresh records"}

                </button>

              </div>

              <div className="records-list">

                {visibleRecords.map((record) => (

                  <div className="record-row" key={record.id} role="button" tabIndex={0}

                    onClick={() => openRecord(record)}

                    onKeyDown={(event) => {

                      if (event.key === "Enter" || event.key === " ") {

                        event.preventDefault();

                        openRecord(record);

                      }

                    }}>

                    <div className="file-icon other-file"><FileText size={18} /></div>

                    <div className="record-info">

                      <strong>{record.name}</strong>

                      <span>{record.type} · {record.date}</span>

                    </div>

                    <span className="status status-review">{record.status}</span>

                    <button className="row-more" aria-label={`Review ${record.name}`}

                      onClick={(event) => { event.stopPropagation(); openRecord(record); }}>

                      <ChevronRight size={18} />

                    </button>

                  </div>

                ))}

                {!visibleRecords.length && <div className="empty-state"><FileText size={24} /><b>No records found</b></div>}

              </div>

            </section>

          )}

          {activePage === "medications" && (

            <section className="panel" style={{ padding: 24 }}>

              <div className="panel-header">

                <div>

                  <div className="section-kicker">PRESCRIPTION REVIEW</div>

                  <h3>Medication candidates</h3>

                  <p>These details are extracted from prescription text and must be checked against the original document.</p>

                </div>

                <button className="outline-btn" onClick={loadTimeline} disabled={loadingTimeline}>

                  {loadingTimeline ? "Loading..." : "Refresh"}

                </button>

              </div>

              {timelineError && <p role="alert">{timelineError}</p>}

              {loadingTimeline ? <p>Loading medication records...</p> : (

                <div className="records-list">

                  {timelineEntries.filter((entry) => entry.event_type === "medication").map((entry, index) => (

                    <div className="record-row" key={`${entry.document_id}-${entry.medicine_name}-${index}`}>

                      <div className="file-icon rx-file"><Pill size={18} /></div>

                      <div className="record-info">

                        <strong>{entry.medicine_name}</strong>

                        <span>{entry.dosage || "Dosage not recognized"} · {entry.frequency || "Frequency not recognized"}</span>

                        <span>{entry.duration || "Duration not recognized"} · {entry.document_name}</span>

                      </div>

                      <span className="status status-review">Verify</span>

                    </div>

                  ))}

                  {!timelineEntries.some((entry) => entry.event_type === "medication") && (

                    <div className="empty-state"><Pill size={24} /><b>No medication candidates yet</b><span>Upload a prescription, select “Prescription” as its document type, open it, then run OCR extraction.</span></div>

                  )}

                </div>

              )}

              <div className="modal-warning" style={{ marginTop: 18 }}>

                <AlertCircle size={16} /><span>Do not use OCR results as medication instructions without checking the original prescription and a qualified clinician or pharmacist.</span>

              </div>

            </section>

          )}

          {activePage === "timeline" && (

            <section className="panel" style={{ padding: 24 }}>

              <div className="panel-header">

                <div>

                  <div className="section-kicker">YOUR HEALTH JOURNEY</div>

                  <h3>Unified health timeline</h3>

                  <p>Documents, lab observations, medication candidates and saved AI summaries in date order.</p>

                </div>

                <button className="outline-btn" onClick={loadTimeline} disabled={loadingTimeline}>

                  {loadingTimeline ? "Loading..." : "Refresh timeline"}

                </button>

              </div>

              {timelineError && <p role="alert">{timelineError}</p>}

              {loadingTimeline ? <p>Loading timeline...</p> : (

                <div className="timeline">

                  {timelineEntries.map((entry, index) => (

                    <div className="timeline-item" key={`${entry.event_type}-${entry.document_id}-${entry.summary_id || entry.test_name || entry.medicine_name || index}-${index}`}>

                      <div className={`timeline-marker ${entry.event_type === "medication" ? "rx-marker" : entry.event_type === "lab_observation" ? "lab-marker" : "file-marker"}`}>

                        {entry.event_type === "medication" ? <Pill size={15} /> : entry.event_type === "lab_observation" ? <FlaskConical size={15} /> : entry.event_type === "ai_summary" ? <Sparkles size={15} /> : <FileText size={15} />}

                      </div>

                      <div className="timeline-body">

                        <div>

                          <strong>{entry.event_type === "lab_observation" ? `${entry.test_name}: ${entry.value} ${entry.unit || ""}` : entry.event_type === "medication" ? entry.medicine_name : entry.event_type === "ai_summary" ? "Saved AI summary" : entry.document_name}</strong>

                          <span className="timeline-date">{entry.date ? new Date(entry.date).toLocaleString() : "Date unavailable"}</span>

                        </div>

                        <p>{entry.event_type === "lab_observation" ? `Source: ${entry.document_name}` : entry.event_type === "medication" ? `${entry.dosage || "Dosage not recognized"} · ${entry.frequency || "Frequency not recognized"} · Verify against prescription` : entry.event_type === "ai_summary" ? entry.summary : `${entry.document_type || "Medical document"} · ${entry.extraction_status || "Uploaded"}`}</p>

                      </div>

                      <span className="timeline-dot" />

                    </div>

                  ))}

                  {!timelineEntries.length && !timelineError && <div className="empty-state"><CalendarDays size={24} /><b>Your timeline is empty</b><span>Upload and process a medical document to begin.</span></div>}

                </div>

              )}

            </section>

          )}

        </div>

      </main>

      {/* Document review modal */}

      {reviewRecord && (

        <div className="modal-backdrop" onClick={closeRecord}>

          <section

            className="review-modal"

            role="dialog"

            aria-modal="true"

            aria-labelledby="review-title"

            onClick={(event) => event.stopPropagation()}

          >

            <button

              className="modal-close"

              aria-label="Close"

              onClick={closeRecord}

            >

              <X size={18} />

            </button>

            <div className="modal-icon">

              <FileHeart size={22} />

            </div>

            <div className="section-kicker">RECORD DETAILS</div>

            <h2 id="review-title">{reviewRecord.name}</h2>

            <p className="modal-subtitle">

              Review document details and compare extracted values with the

              original report.

            </p>

            <div className="review-summary">

              <div>

                <span>Document type</span>

                <b>{reviewRecord.type}</b>

              </div>

              <div>

                <span>Date</span>

                <b>{reviewRecord.date}</b>

              </div>

              <div>

                <span>Status</span>

                <b>{reviewRecord.status}</b>

              </div>

              <div>

                <span>Source</span>

                <b>{reviewRecord.note}</b>

              </div>

            </div>

{extractedObservations.length > 0 && (

  <div className="modal-observations">

    <h3>Extracted observations</h3>

    {extractedObservations.map((observation) => {

      const interpretation = observation.interpretation || {

        status: "needs_review",

        status_label: "Needs review",

        explanation:

          "Verify this result against the original report.",

      };

      const statusClass = [

        "within_range",

        "low",

        "high",

      ].includes(interpretation.status)

        ? interpretation.status

        : "needs_review";

      return (

        <div

          className="observation-row"

          key={

            observation.id ||

            `${observation.test_name}-${observation.value}`

          }

        >

          <div className="observation-main">

            <b>{observation.test_name}</b>

            <span className="observation-value">

              {observation.value} {observation.unit}

            </span>

            <small>

              Reference range:{" "}

              {observation.reference_range || "Not provided"}

            </small>

            <span

              className={`observation-status ${statusClass}`}

            >

              {interpretation.status_label || "Needs review"}

            </span>

            <small className="observation-explanation">

              {interpretation.explanation}

            </small>

          </div>

        </div>

      );

    })}

  </div>

)}

                          {extractedMedications.length > 0 && (

                <div className="modal-observations">

                  <h3>Extracted medication candidates</h3>

                  {extractedMedications.map((medication, index) => (

                    <div className="observation-row" key={medication.id || `${medication.medicine_name}-${index}`}>

                      <div className="observation-main">

                        <b>{medication.medicine_name}</b>

                        <span className="observation-value">{medication.dosage || "Dosage not recognized"}</span>

                        <small>Frequency: {medication.frequency || "Not recognized"}</small>

                        <small>Duration: {medication.duration || "Not recognized"}</small>

                        <small>{medication.instructions}</small>

                        <span className="observation-status needs_review">Manual verification required</span>

                      </div>

                    </div>

                  ))}

                </div>

              )}

            {!isReviewingPrescription && (

              <>

{/* Previously saved summaries */}

            <div className="saved-summaries-section">

              <h3>Previously saved summaries</h3>

              {loadingSavedSummaries && (

                <p>Loading saved summaries...</p>

              )}

              {!loadingSavedSummaries &&

                savedSummaries.length === 0 && (

                  <p>No saved summaries yet.</p>

                )}

              {savedSummaries.map((item) => (

                <div className="saved-summary-card" key={item.id}>

                  <small>

                    {item.created_at

                      ? new Date(item.created_at).toLocaleString()

                      : "Saved summary"}

                  </small>

                  <p>{item.summary}</p>

                </div>

              ))}

            </div>

            {/* Gemini AI summary */}

            <div className="ai-summary-section">

              <div className="ai-summary-heading">

                <div>

                  <div className="section-kicker">WELLNEST AI</div>

                  <h3>Understand your report</h3>

                  <p>

                    Get an educational explanation of your extracted

                    laboratory results.

                  </p>

                </div>

                <Sparkles size={21} />

              </div>

              <button

                className="ai-summary-button"

                onClick={generateAiSummary}

                disabled={summarizing || extracting}

              >

                <Sparkles size={17} />

                {summarizing

                  ? "Generating summary..."

                  : "Generate AI Summary"}

              </button>

              {summarizing && (

                <div className="ai-summary-loading" role="status">

                  <span className="ai-spinner" />

                  <span>

                    Gemini is reviewing your observations. This may take a

                    few seconds.

                  </span>

                </div>

              )}

              {aiSummaryError && (

                <div className="ai-summary-error" role="alert">

                  <AlertCircle size={17} />

                  <span>{aiSummaryError}</span>

                </div>

              )}

              {aiSummary && (

                <div className="ai-summary-result">

                  <div className="ai-summary-result-title">

                    <CheckCircle2 size={17} />

                    Educational summary

                  </div>

                  <div className="ai-summary-text">{aiSummary}</div>

                  <p className="ai-summary-disclaimer">

                    AI-generated educational information, not a diagnosis.

                    Verify all extracted values against the original report

                    and discuss questions with a qualified clinician.

                  </p>

                </div>

              )}

            </div>

              </>

            )}

            <div className="modal-warning">

              <AlertCircle size={16} />

              <span>

                Verify extracted information against the original medical

                document. Discuss health questions with a qualified clinician.

              </span>

            </div>

            <div className="modal-actions">

              <button

                className="modal-secondary"

                disabled={extracting || summarizing}

                onClick={runExtraction}

              >

                <FlaskConical size={16} />

                {extracting ? "Extracting…" : "Run OCR extraction"}

              </button>

              <button

                className="modal-primary"

                disabled={extracting || summarizing}

                onClick={closeRecord}

              >

                Done <CheckCircle2 size={17} />

              </button>

            </div>

          </section>

        </div>

      )}

    </div>

  );

}
