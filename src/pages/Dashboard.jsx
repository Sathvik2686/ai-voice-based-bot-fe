import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Editor from "@monaco-editor/react";
import API from "../services/api";

export default function Dashboard() {
  const navigate = useNavigate();
  const [loadingAuth, setLoadingAuth] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) navigate("/");
    setLoadingAuth(false);
  }, [navigate]);

  const [code, setCode] = useState("// Write your code here...");
  const [input, setInput] = useState("");
  const [result, setResult] = useState("");
  const [targetLang, setTargetLang] = useState("javascript");

  const [activeAI, setActiveAI] = useState(null);

  const [history, setHistory] = useState([]);
  const [search, setSearch] = useState("");

  const [deletedItem, setDeletedItem] = useState(null);
  const [undoTimer, setUndoTimer] = useState(null);

  const isBusy = activeAI !== null;

  useEffect(() => {
    API.get("/history").then((res) => setHistory(res.data || []));
  }, []);

  const isValidCode = (code) => {
    return /[{};]|function|class|def|return|if|for|while|console\.log|print|=|=>/.test(code);
  };

  const detectLanguage = (code) => {
    if (/#include|cout|cin/.test(code)) return "cpp";
    if (/System\.out\.println|public class/.test(code)) return "java";
    if (/def |print\(|import /.test(code)) return "python";
    if (/console\.log|function|=>/.test(code)) return "javascript";
    return targetLang;
  };

  useEffect(() => {
    const detected = detectLanguage(code);
    if (detected !== targetLang) setTargetLang(detected);
  }, [code]);

  useEffect(() => {
    const handler = (e) => {
      if (e.ctrlKey && e.key === "l") setResult("");
      if (e.ctrlKey && e.key === "e") runAI("/ai/explain");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [code]);

  const runAI = async (endpoint) => {
    if (!code.trim()) return setResult("⚠️ Enter code");
    if (!isValidCode(code)) return setResult("⚠️ Invalid code");

    setActiveAI(endpoint);
    setResult("");

    try {
      const res = await API.post(endpoint, { code, targetLang });

      setResult(
        res.data.output?.code ||
        res.data.output ||
        res.data.translatedCode ||
        JSON.stringify(res.data, null, 2) ||
        "No output"
      );

    } catch {
      setResult("⚠️ AI failed");
    } finally {
      setActiveAI(null);
    }
  };

  // ✅ FIXED DOWNLOAD - no backend call needed
  const handleDownload = () => {
    if (!result) return alert("Nothing to download");

    const blob = new Blob([result], { type: "text/plain" });
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "translated_code.txt";
    a.click();

    window.URL.revokeObjectURL(url);
  };

  const handleDelete = async (id) => {
    const item = history.find((i) => i._id === id);
    if (!item) return;

    setHistory((prev) => prev.filter((i) => i._id !== id));
    setDeletedItem(item);

    try {
      await API.delete(`/history/${id}`);
    } catch {}

    if (undoTimer) clearTimeout(undoTimer);

    const timer = setTimeout(() => {
      setDeletedItem(null);
    }, 5000);

    setUndoTimer(timer);
  };

  const handleUndo = () => {
    if (!deletedItem) return;

    if (undoTimer) clearTimeout(undoTimer);

    setHistory((prev) => [deletedItem, ...prev]);
    setDeletedItem(null);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/");
  };

  const filteredHistory = history.filter((item) =>
    item.originalCode?.toLowerCase().includes(search.toLowerCase())
  );

  if (loadingAuth) return null;

  return (
    <div className="h-screen bg-[#0b0f14] text-white flex flex-col overflow-hidden">

      {/* HEADER */}
      <div className="flex justify-between items-center px-6 py-3 border-b border-gray-800">
        <h1 className="text-cyan-400 font-bold">AI CODE STUDIO ⚡</h1>
        <button onClick={handleLogout} className="btn-neon-sm">Logout</button>
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* LEFT HISTORY */}
        <div className="w-64 border-r border-gray-800 p-3 flex flex-col">
          <input
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-neon mb-3"
          />

          <div className="flex-1 overflow-y-auto space-y-2">
            {filteredHistory.map((item) => (
              <div key={item._id} className="history-card flex items-start gap-2">

                <div
                  onClick={() => {
                    setCode(item.originalCode);
                    setResult(item.output);
                  }}
                  className="cursor-pointer flex-1 min-w-0"
                >
                  <div className="text-cyan-400 text-xs font-semibold">
                    {item.sourceLang} → {item.targetLang}
                  </div>
                  <div className="text-xs opacity-70 truncate">
                    {item.originalCode?.slice(0, 40)}
                  </div>
                </div>

                <button
                  onClick={() => handleDelete(item._id)}
                  className="delete-btn shrink-0"
                  disabled={isBusy}
                >
                  ✕
                </button>

              </div>
            ))}
          </div>
        </div>

        {/* CENTER + RIGHT */}
        <div className="flex flex-1 overflow-hidden">

          {/* CENTER */}
          <div className="flex-1 flex flex-col overflow-hidden">

            <div className="flex gap-2 p-3 border-b border-gray-800 flex-wrap">

              <select
                value={targetLang}
                onChange={(e) => setTargetLang(e.target.value)}
                className="input-neon"
              >
                <option value="javascript">JS</option>
                <option value="python">Python</option>
                <option value="java">Java</option>
                <option value="cpp">C++</option>
              </select>

              {["translate","explain","fix","review","optimize","testcases","analyze"].map((type) => (
                <button
                  key={type}
                  onClick={() => runAI(`/ai/${type}`)}
                  className="btn-neon"
                  disabled={isBusy}
                >
                  {activeAI === `/ai/${type}` ? <span className="loader" /> : type}
                </button>
              ))}

            </div>

            <div className="flex-1">
              <Editor
                height="100%"
                value={code}
                onChange={(v) => setCode(v)}
                theme="vs-dark"
              />
            </div>

            <textarea
              placeholder="Input..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="h-28 bg-[#0b0f14] border-t border-gray-800 p-2"
            />
          </div>

          {/* TERMINAL */}
          <div className="w-[40%] border-l border-gray-800 flex flex-col">

            <div className="flex justify-between px-3 py-2 border-b border-gray-800">
              <span className="text-cyan-400 text-sm">TERMINAL</span>

              <div className="flex gap-2">
                <button onClick={() => setResult("")} className="btn-neon-sm">Clear</button>

                <button
                  onClick={() => result && navigator.clipboard.writeText(result)}
                  className="btn-neon-sm"
                >
                  Copy
                </button>

                <button
                  onClick={handleDownload}
                  className="btn-neon-sm"
                  disabled={!result}
                >
                  Download
                </button>
              </div>
            </div>

            <Editor
              height="100%"
              value={result || "// Output will appear here"}
              theme="vs-dark"
              options={{
                readOnly: true,
                wordWrap: "on",
                minimap: { enabled: false },
                fontSize: 13,
                scrollBeyondLastLine: false
              }}
            />

          </div>

        </div>
      </div>

      {/* UNDO */}
      {deletedItem && (
        <div className="fixed bottom-5 right-5 bg-[#111] border border-cyan-500 px-4 py-2 rounded flex gap-3 shadow-lg">
          <span>Item deleted</span>
          <button onClick={handleUndo} className="btn-neon-sm">Undo</button>
        </div>
      )}

      {/* STYLES */}
      <style>{`
        .btn-neon {
          padding: 4px 12px;
          border: 1px solid #00ffff55;
          color: #00ffff;
          border-radius: 6px;
        }
        .btn-neon:hover {
          box-shadow: 0 0 10px #00ffff;
        }
        .btn-neon-sm {
          padding: 4px 10px;
          border: 1px solid #00ffff55;
          color: #00ffff;
          border-radius: 6px;
        }
        .btn-neon-sm:hover {
          box-shadow: 0 0 8px #00ffff;
        }
        .input-neon {
          border: 1px solid #00ffff33;
          background: transparent;
          padding: 4px;
          border-radius: 5px;
          color: white;
        }
        .history-card {
          padding: 8px;
          border-radius: 8px;
          background: #111;
        }
        .history-card:hover {
          box-shadow: 0 0 10px #00ffff;
        }
        .delete-btn {
          color: red;
          font-size: 12px;
          border: 1px solid #ff444455;
          padding: 2px 6px;
          border-radius: 4px;
        }
        .delete-btn:hover {
          background: red;
          color: white;
          box-shadow: 0 0 8px red;
        }
        .loader {
          width: 14px;
          height: 14px;
          border: 2px solid #555;
          border-top: 2px solid #00ffff;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
          100% { transform: rotate(360deg); }
        }
      `}</style>

    </div>
  );
}