const SUNO_API_BASE = process.env.SUNO_API_BASE_URL || "https://apibox.erweima.ai";
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
      throw new Error("SUNO_API_KEY is not configured");
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
      console.error("[Suno API] Error response:", errorText);

      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { msg: errorText || `HTTP ${response.status} error` };
      }

      return {
        code: response.status,
        msg: errorData.msg || errorData.message || `API request failed with status ${response.status}`,
        data: undefined,
      };
    }

    const data = await response.json();
    console.log("[Suno API] Success response:", data);
    return data;
  } catch (error) {
    console.error("[Suno API] Exception:", error);
    throw error;
  }
}

export async function getGenerationStatus(taskId: string): Promise<SunoStatusResponse> {
  try {
    if (!SUNO_API_KEY) {
      throw new Error("SUNO_API_KEY is not configured");
    }

    const response = await fetch(
      `${SUNO_API_BASE}/api/v1/generate/status?taskId=${taskId}`,
      {
        headers: {
          Authorization: `Bearer ${SUNO_API_KEY}`,
        },
      }
    );

    console.log("[Suno API] Status check response:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Suno API] Status check error:", errorText);

      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { msg: errorText || `HTTP ${response.status} error` };
      }

      return {
        code: response.status,
        msg: errorData.msg || errorData.message || `Status check failed with status ${response.status}`,
        data: undefined,
      };
    }

    const data = await response.json();
    console.log("[Suno API] Status response:", data);
    return data;
  } catch (error) {
    console.error("[Suno API] Status check exception:", error);
    throw error;
  }
}
