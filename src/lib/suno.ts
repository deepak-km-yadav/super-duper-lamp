const SUNO_API_BASE = process.env.SUNO_API_BASE_URL || "https://api.sunoapi.org";
const SUNO_API_KEY = process.env.SUNO_API_KEY || "";

interface SunoGenerateParams {
  prompt: string;
  style?: string;
  title?: string;
  lyrics?: string;
  model?: string;
  customMode?: boolean;
  instrumental?: boolean;
  callBackUrl?: string;
  negativeTags?: string;
  styleWeight?: number;
  weirdnessConstraint?: number;
  audioWeight?: number;
  personaId?: string;
}

interface SunoResponse {
  code: number;
  msg: string;
  data?: {
    taskId: string;
  };
}

interface SunoStatusResponse {
  code: number;
  msg: string;
  data?: {
    taskId: string;
    status: string;
    clips?: Array<{
      id: string;
      audioUrl: string;
      title: string;
      duration: number;
      model: string;
      style: string;
      imageUrl?: string;
    }>;
    errorMessage?: string;
  };
}

export async function createGeneration(params: SunoGenerateParams): Promise<SunoResponse> {
  try {
    if (!SUNO_API_KEY) {
      console.error("[Suno API] SUNO_API_KEY is not configured");
      return {
        code: 500,
        msg: "SUNO_API_KEY environment variable is not configured. Please add it to your Vercel environment variables.",
        data: undefined,
      };
    }

    const requestBody = {
      prompt: params.prompt,
      style: params.style || undefined,
      title: params.title || undefined,
      customMode: params.customMode || false,
      instrumental: params.instrumental || false,
      model: params.model || "V4",
      callBackUrl: params.callBackUrl || `${process.env.NEXT_PUBLIC_APP_URL}/api/suno/callback`,
      negativeTags: params.negativeTags || undefined,
      styleWeight: params.styleWeight,
      weirdnessConstraint: params.weirdnessConstraint,
      audioWeight: params.audioWeight,
      personaId: params.personaId || undefined,
    };

    console.log("[Suno API] Request:", {
      url: `${SUNO_API_BASE}/api/v1/generate`,
      baseUrl: SUNO_API_BASE,
      hasApiKey: !!SUNO_API_KEY,
      apiKeyPrefix: SUNO_API_KEY ? SUNO_API_KEY.substring(0, 10) + "..." : "none",
      body: requestBody,
    });

    const response = await fetch(`${SUNO_API_BASE}/api/v1/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUNO_API_KEY}`,
      },
      body: JSON.stringify(requestBody),
    });

    console.log("[Suno API] Response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Suno API] Error response:", {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
      });

      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { msg: errorText || `HTTP ${response.status} error` };
      }

      return {
        code: response.status,
        msg: errorData.msg || errorData.message || `API request failed with status ${response.status}: ${response.statusText}`,
        data: undefined,
      };
    }

    const data = await response.json();
    console.log("[Suno API] Success response:", data);
    return data;
  } catch (error) {
    console.error("[Suno API] Exception:", error);
    return {
      code: 500,
      msg: error instanceof Error ? error.message : "Unknown error occurred",
      data: undefined,
    };
  }
}

export async function getGenerationStatus(taskId: string): Promise<SunoStatusResponse> {
  try {
    if (!SUNO_API_KEY) {
      console.error("[Suno API] SUNO_API_KEY is not configured");
      return {
        code: 500,
        msg: "SUNO_API_KEY environment variable is not configured",
        data: undefined,
      };
    }

    const url = `${SUNO_API_BASE}/api/v1/generate/status?taskId=${taskId}`;
    console.log("[Suno API] Status check URL:", url);

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${SUNO_API_KEY}`,
      },
    });

    console.log("[Suno API] Status check response:", {
      status: response.status,
      statusText: response.statusText,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Suno API] Status check error:", {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
      });

      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { msg: errorText || `HTTP ${response.status} error` };
      }

      return {
        code: response.status,
        msg: errorData.msg || errorData.message || `Status check failed with status ${response.status}: ${response.statusText}`,
        data: undefined,
      };
    }

    const data = await response.json();
    console.log("[Suno API] Status response:", data);
    return data;
  } catch (error) {
    console.error("[Suno API] Status check exception:", error);
    return {
      code: 500,
      msg: error instanceof Error ? error.message : "Unknown error occurred",
      data: undefined,
    };
  }
}
