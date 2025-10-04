// src/TerraChat.jsx
import { useRef, useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import Navbar from "./Navbar";

const API_BASE = "https://bot-five-liard.vercel.app";

export default function TerraChat() {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hi! I can only answer questions about NASA Terra (ASTER, CERES, MISR, MODIS)." }
  ]);
  const boxRef = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => {
    boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function send() {
    const userMessage = input.trim();
    if (!userMessage || busy) return;

    setMessages((m) => [...m, { role: "user", content: userMessage }, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: userMessage }),
        signal: ctrl.signal,
      });

      // Try streaming (SSE: text/event-stream). If not streamable, fallback to .text()
      const reader = res.body?.getReader();
      if (!reader) {
        const text = await res.text();
        setMessages((m) => {
          const out = [...m];
          out[out.length - 1] = { role: "assistant", content: text };
          return out;
        });
      } else {
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Split by SSE event boundary
          const events = buffer.split("\n\n");
          buffer = events.pop() || "";

          for (const ev of events) {
            if (!ev.startsWith("data: ")) continue;
            const data = ev.slice(6);

            if (data === "[DONE]") {
              // stream finished
              break;
            }
            if (data.startsWith("[ERROR]")) {
              setMessages((m) => {
                const out = [...m];
                out[out.length - 1] = { role: "assistant", content: `Server error: ${data.slice(7)}` };
                return out;
              });
              break;
            }

            // Append chunk to the last assistant message
            setMessages((m) => {
              const out = [...m];
              const last = out[out.length - 1];
              if (last?.role === "assistant") {
                out[out.length - 1] = { ...last, content: (last.content || "") + data };
              }
              return out;
            });
          }
        }
      }
    } catch (err) {
      if (err.name === "AbortError") return;
      setMessages((m) => [...m, { role: "assistant", content: `Error contacting server: ${String(err)}` }]);
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  function onKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  function stop() {
    abortRef.current?.abort();
    abortRef.current = null;
    setBusy(false);
  }

  return (
    <div>
      <Navbar />
      <div style={page}>
        <div style={bg} aria-hidden>
          <div style={radial} />
          <Stars />
        </div>

        <header style={header}>
          <div style={brandRow}>
            <h2 style={brandText}></h2>
          </div>
          <div style={badge}>ASTER • CERES • MISR • MODIS</div>
        </header>

        <main style={card}>
          <p style={subtitle}>
            Ask about Terra sensors, products (NDVI, LST, AOD, fire), or country-level use cases. Off-topic questions are declined.
          </p>

          <div ref={boxRef} style={chatBox}>
            {messages.map((m, i) => (
              <div key={i} style={m.role === "user" ? userRow : botRow}>
                <div style={tag}>{m.role === "user" ? "You" : "Terra AI"}</div>
                <div style={m.role === "user" ? userBubble : botBubble}>
                  {m.role === "user" ? (
                    m.content
                  ) : (
                    <ReactMarkdown>{m.content || (busy && i === messages.length - 1 ? "…" : "")}</ReactMarkdown>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div style={bar}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="e.g., MOD13A2 NDVI trend for Bangladesh (2001–2024)"
              rows={3}
              style={ta}
              disabled={busy}
            />
            {!busy ? (
              <button onClick={send} disabled={!input.trim()} style={btn}>
                Send
              </button>
            ) : (
              <button onClick={stop} style={{ ...btn, background: "#6b7280" }}>
                Stop
              </button>
            )}
          </div>

          {/* <div style={note}>Backend endpoint: {API_BASE}/chat (SSE)</div> */}
        </main>

        <footer style={footer}>
          <small>
            Built by <strong>CosmoMinds</strong> • NASA Space Apps
          </small>
        </footer>
      </div>
    </div>
  );
}

/*** Decorative bits ***/
function Stars() {
  const stars = new Array(80).fill(0).map(() => ({
    left: Math.random() * 100 + "%",
    top: Math.random() * 100 + "%",
    size: Math.random() * 2 + 1,
  }));
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {stars.map((s, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: s.left,
            top: s.top,
            width: s.size,
            height: s.size,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(255,255,255,0.9), rgba(255,255,255,0) 60%)",
            opacity: 0.9,
          }}
        />
      ))}
    </div>
  );
}

/*** Styles ***/
const page = {
  minHeight: "100vh",
  color: "#E6F0FF",
  position: "relative",
  overflow: "hidden",
  fontFamily:
    "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
};

const bg = {
  position: "fixed",
  inset: 0,
  zIndex: 0,
  background: "linear-gradient(180deg, #020817 0%, #031735 100%)",
};

const radial = {
  position: "absolute",
  width: 1600,
  height: 800,
  left: "-10%",
  top: "-20%",
  background:
    "radial-gradient(1000px 600px at 20% 10%, rgba(26,115,232,0.35), rgba(3,10,30,0) 60%)",
  filter: "blur(10px)",
};

const header = {
  zIndex: 2,
  position: "relative",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "16px 20px",
};
const brandRow = { display: "flex", alignItems: "center", gap: 10 };
const brandText = { margin: 0, fontSize: 18 };
const badge = {
  border: "1px solid rgba(168,197,255,0.25)",
  background: "rgba(255,255,255,0.06)",
  padding: "6px 10px",
  borderRadius: 999,
  fontSize: 12,
  letterSpacing: 0.3,
};

const card = {
  zIndex: 2,
  position: "relative",
  maxWidth: 960,
  margin: "12px auto 24px",
  padding: 16,
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(168,197,255,0.15)",
  borderRadius: 16,
  boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
};
const subtitle = { opacity: 0.85, margin: "4px 0 12px" };

const chatBox = {
  height: "56vh",
  overflowY: "auto",
  background: "rgba(2,8,23,0.35)",
  border: "1px solid rgba(168,197,255,0.15)",
  borderRadius: 12,
  padding: 12,
};

const bar = { display: "flex", gap: 8, marginTop: 10 };
const ta = {
  flex: 1,
  background: "rgba(255,255,255,0.06)",
  color: "white",
  border: "1px solid rgba(168,197,255,0.2)",
  borderRadius: 10,
  padding: 10,
  outline: "none",
  resize: "vertical",
};
const btn = {
  background: "#1a73e8",
  color: "white",
  border: "none",
  borderRadius: 10,
  padding: "0 16px",
  fontWeight: 700,
  minWidth: 110,
  cursor: "pointer",
};

const note = { opacity: 0.7, fontSize: 12, marginTop: 8 };
const footer = {
  textAlign: "center",
  opacity: 0.6,
  margin: "6px 0 20px",
  position: "relative",
  zIndex: 2,
};

const rowBase = { display: "flex", flexDirection: "column", margin: "8px 0" };
const userRow = { ...rowBase, alignItems: "flex-end" };
const botRow = { ...rowBase, alignItems: "flex-start" };
const tag = { fontSize: 11, opacity: 0.7, marginBottom: 4 };

const bubbleBase = {
  maxWidth: "92%",
  padding: 12,
  borderRadius: 12,
  lineHeight: 1.5,
  border: "1px solid rgba(168,197,255,0.18)",
  whiteSpace: "pre-wrap",
};
const userBubble = {
  ...bubbleBase,
  background:
    "linear-gradient(180deg, rgba(26,115,232,0.25), rgba(26,115,232,0.10))",
  boxShadow: "0 2px 14px rgba(26,115,232,0.25)",
};
const botBubble = {
  ...bubbleBase,
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.04))",
  boxShadow: "0 2px 14px rgba(0,0,0,0.25)",
};
