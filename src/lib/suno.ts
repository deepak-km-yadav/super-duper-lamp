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
  const response = await fetch(`${SUNO_API_BASE}/api/v1/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUNO_API_KEY}`,
    },
    body: JSON.stringify({
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
    }),
  });

  return response.json();
}

export async function getGenerationStatus(taskId: string): Promise<SunoStatusResponse> {
  const response = await fetch(
    `${SUNO_API_BASE}/api/v1/generate/status?taskId=${taskId}`,
    {
      headers: {
        Authorization: `Bearer ${SUNO_API_KEY}`,
      },
    }
  );

  return response.json();
}
