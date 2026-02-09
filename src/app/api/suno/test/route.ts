import { NextResponse } from "next/server";

export async function GET() {
  try {
    const sunoApiKey = process.env.SUNO_API_KEY;
    const sunoApiBase = process.env.SUNO_API_BASE_URL || "https://api.sunoapi.org";
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;

    // Test basic configuration
    const config = {
      hasApiKey: !!sunoApiKey,
      apiKeyLength: sunoApiKey?.length || 0,
      apiKeyPrefix: sunoApiKey ? sunoApiKey.substring(0, 10) + "..." : "NOT SET",
      apiBase: sunoApiBase,
      appUrl: appUrl || "NOT SET",
    };

    console.log("[Test] Configuration:", config);

    // Test a simple API call
    if (!sunoApiKey) {
      return NextResponse.json({
        success: false,
        error: "SUNO_API_KEY is not configured",
        config,
      });
    }

    // Try a minimal request to test API connectivity
    const testBody = {
      prompt: "A simple test song",
      model: "V4_5ALL",
      customMode: false,
      instrumental: false,
    };

    console.log("[Test] Sending test request to Suno API:", testBody);

    const response = await fetch(`${sunoApiBase}/api/v1/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sunoApiKey}`,
      },
      body: JSON.stringify(testBody),
    });

    const responseText = await response.text();
    console.log("[Test] Response status:", response.status);
    console.log("[Test] Response body:", responseText);

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }

    return NextResponse.json({
      success: response.ok,
      status: response.status,
      statusText: response.statusText,
      config,
      response: responseData,
    });
  } catch (error) {
    console.error("[Test] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
