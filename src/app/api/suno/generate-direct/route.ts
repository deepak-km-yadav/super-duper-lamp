import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const sunoApiKey = process.env.SUNO_API_KEY;
    const sunoApiBase = process.env.SUNO_API_BASE_URL || "https://api.sunoapi.org";

    console.log("[Direct API] Suno API Configuration:", {
      apiKeyConfigured: !!sunoApiKey,
      apiBase: sunoApiBase,
    });

    if (!sunoApiKey) {
      return NextResponse.json(
        {
          error: "SUNO_API_KEY is not configured. Please add it to your Vercel environment variables.",
        },
        { status: 500 }
      );
    }

    const body = await req.json();
    const {
      prompt,
      style,
      title,
      customMode = false,
      instrumental = false,
      model = "V4_5ALL",
    } = body;

    // Build request body
    const requestBody: Record<string, string | boolean> = {
      prompt: prompt || "A beautiful romantic song",
      model,
      customMode,
      instrumental,
    };

    if (style) requestBody.style = style;
    if (title) requestBody.title = title;

    console.log("[Direct API] Sending request to Suno:", {
      url: `${sunoApiBase}/api/v1/generate`,
      body: requestBody,
    });

    const response = await fetch(`${sunoApiBase}/api/v1/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sunoApiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    console.log("[Direct API] Response status:", response.status);

    const responseText = await response.text();
    console.log("[Direct API] Response body:", responseText);

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }

    if (!response.ok) {
      return NextResponse.json(
        {
          error: "Suno API request failed",
          status: response.status,
          statusText: response.statusText,
          details: responseData,
        },
        { status: response.status }
      );
    }

    return NextResponse.json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    console.error("[Direct API] Exception:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
