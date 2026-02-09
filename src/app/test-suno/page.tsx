"use client";

import { useState } from "react";

export default function TestSunoPage() {
  const [prompt, setPrompt] = useState("A beautiful romantic love song");
  const [style, setStyle] = useState("Pop, Romantic");
  const [title, setTitle] = useState("Love Song");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const testDirect = async () => {
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/suno/generate-direct", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
          style,
          title,
          customMode: false,
          instrumental: false,
          model: "V4_5ALL",
        }),
      });

      const data = await response.json();
      setResult({
        status: response.status,
        ok: response.ok,
        data,
      });
    } catch (error) {
      setResult({
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setLoading(false);
    }
  };

  const testConfig = async () => {
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/suno/test");
      const data = await response.json();
      setResult({
        status: response.status,
        ok: response.ok,
        data,
      });
    } catch (error) {
      setResult({
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "2rem", maxWidth: "800px", margin: "0 auto" }}>
      <h1>Suno API Test Page</h1>

      <div style={{ marginBottom: "2rem" }}>
        <h2>Test Configuration</h2>
        <button
          onClick={testConfig}
          disabled={loading}
          style={{
            padding: "0.5rem 1rem",
            backgroundColor: "#0070f3",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Testing..." : "Test API Configuration"}
        </button>
      </div>

      <div style={{ marginBottom: "2rem" }}>
        <h2>Test Direct API Call</h2>

        <div style={{ marginBottom: "1rem" }}>
          <label style={{ display: "block", marginBottom: "0.5rem" }}>
            Prompt:
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              style={{
                width: "100%",
                padding: "0.5rem",
                marginTop: "0.25rem",
                border: "1px solid #ccc",
                borderRadius: "4px",
              }}
            />
          </label>
        </div>

        <div style={{ marginBottom: "1rem" }}>
          <label style={{ display: "block", marginBottom: "0.5rem" }}>
            Style:
            <input
              type="text"
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              style={{
                width: "100%",
                padding: "0.5rem",
                marginTop: "0.25rem",
                border: "1px solid #ccc",
                borderRadius: "4px",
              }}
            />
          </label>
        </div>

        <div style={{ marginBottom: "1rem" }}>
          <label style={{ display: "block", marginBottom: "0.5rem" }}>
            Title:
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{
                width: "100%",
                padding: "0.5rem",
                marginTop: "0.25rem",
                border: "1px solid #ccc",
                borderRadius: "4px",
              }}
            />
          </label>
        </div>

        <button
          onClick={testDirect}
          disabled={loading}
          style={{
            padding: "0.5rem 1rem",
            backgroundColor: "#10b981",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Generating..." : "Generate Music (Direct API)"}
        </button>
      </div>

      {result && (
        <div style={{ marginTop: "2rem" }}>
          <h2>Result:</h2>
          <pre
            style={{
              backgroundColor: "#f5f5f5",
              padding: "1rem",
              borderRadius: "4px",
              overflow: "auto",
              maxHeight: "400px",
            }}
          >
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
