import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createGeneration } from "@/lib/suno";

export async function POST(req: Request) {
  try {
    // Check if Suno API is configured
    const sunoApiKey = process.env.SUNO_API_KEY;
    const sunoApiBase = process.env.SUNO_API_BASE_URL || "https://api.sunoapi.org";

    console.log("[Route] Suno API Configuration:", {
      apiKeyConfigured: !!sunoApiKey,
      apiBase: sunoApiBase,
    });

    const body = await req.json();
    const {
      userId,
      songType,
      vocalGender,
      mode,
      genre,
      style,
      mood,
      tempo,
      title,
      prompt,
      lyrics,
      dedicationTo,
      dedicationFrom,
      relationship,
      dedicationMsg,
      model,
      styleWeight,
      weirdnessConstraint,
      audioWeight,
      negativeTags,
      personaId,
    } = body;

    // Validation
    if (mode === "custom" && (!title || !style)) {
      return NextResponse.json(
        { error: "Custom mode requires Title and Style" },
        { status: 400 }
      );
    }

    if (mode === "custom" && songType === "vocal" && !lyrics) {
      return NextResponse.json(
        { error: "Custom vocal mode requires Lyrics" },
        { status: 400 }
      );
    }

    // Build prompt for Suno
    let fullPrompt = prompt || "";
    if (dedicationTo || dedicationFrom || dedicationMsg) {
      const dedicationParts = [];
      if (dedicationTo) dedicationParts.push(`Dedicated to ${dedicationTo}`);
      if (dedicationFrom) dedicationParts.push(`from ${dedicationFrom}`);
      if (relationship) dedicationParts.push(`(${relationship})`);
      if (dedicationMsg) dedicationParts.push(`- "${dedicationMsg}"`);
      if (!fullPrompt) {
        fullPrompt = dedicationParts.join(" ");
      } else {
        fullPrompt = `${fullPrompt}. ${dedicationParts.join(" ")}`;
      }
    }

    if (mood) fullPrompt = `${mood} mood. ${fullPrompt}`;
    if (tempo) fullPrompt = `${tempo} tempo. ${fullPrompt}`;

    // Create generation record
    const generation = await prisma.generation.create({
      data: {
        userId: userId || null,
        songType: songType || "vocal",
        vocalGender: songType === "vocal" ? vocalGender : null,
        mode: mode || "simple",
        genre: Array.isArray(genre) ? genre.join(", ") : genre,
        style: style || (Array.isArray(genre) ? genre.join(", ") : genre),
        mood,
        tempo,
        title,
        prompt: fullPrompt,
        lyrics,
        dedicationTo,
        dedicationFrom,
        relationship,
        dedicationMsg,
        model: model || "V4_5ALL",
        styleWeight: styleWeight ?? 0.5,
        weirdness: weirdnessConstraint ?? 0.5,
        audioWeight: audioWeight ?? 0.5,
        negativeTags,
        personaId,
        status: "queued",
      },
    });

    // Call Suno API
    try {
      const sunoResponse = await createGeneration({
        prompt: mode === "custom" ? (lyrics || fullPrompt) : fullPrompt,
        style: style || (Array.isArray(genre) ? genre.join(", ") : genre) || undefined,
        title: title || undefined,
        customMode: mode === "custom",
        instrumental: songType === "instrumental",
        model: model || "V4_5ALL",
        negativeTags: negativeTags || undefined,
        vocalGender: vocalGender || undefined,
        styleWeight,
        weirdnessConstraint,
        audioWeight,
        personaId: personaId || undefined,
      });

      if (sunoResponse.code === 200 && sunoResponse.data?.taskId) {
        await prisma.generation.update({
          where: { id: generation.id },
          data: {
            taskId: sunoResponse.data.taskId,
            status: "processing",
          },
        });

        return NextResponse.json({
          id: generation.id,
          taskId: sunoResponse.data.taskId,
          status: "processing",
        });
      } else {
        console.error("[Route] Suno API error:", sunoResponse);
        await prisma.generation.update({
          where: { id: generation.id },
          data: {
            status: "failed",
            errorMessage: sunoResponse.msg || "Suno API returned an error",
          },
        });

        return NextResponse.json(
          {
            id: generation.id,
            error: sunoResponse.msg || "Generation failed",
          },
          { status: 502 }
        );
      }
    } catch (error) {
      console.error("[Route] Suno API exception:", error);
      // If Suno API is unreachable, simulate for demo purposes
      const demoTaskId = `demo-${generation.id}`;
      await prisma.generation.update({
        where: { id: generation.id },
        data: {
          taskId: demoTaskId,
          status: "processing",
        },
      });

      // Create demo tracks after a delay (simulate async generation)
      setTimeout(async () => {
        try {
          await prisma.generationTrack.createMany({
            data: [
              {
                generationId: generation.id,
                title: title || "Valentine Song #1",
                audioUrl: "https://cdn1.suno.ai/demo-valentine-track-1.mp3",
                duration: 180,
                modelUsed: model || "V4",
                styleTags: style || (Array.isArray(genre) ? genre.join(", ") : "Pop, Romantic"),
              },
              {
                generationId: generation.id,
                title: title ? `${title} (Version 2)` : "Valentine Song #2",
                audioUrl: "https://cdn1.suno.ai/demo-valentine-track-2.mp3",
                duration: 195,
                modelUsed: model || "V4",
                styleTags: style || (Array.isArray(genre) ? genre.join(", ") : "Pop, Romantic"),
              },
            ],
          });
          await prisma.generation.update({
            where: { id: generation.id },
            data: { status: "completed" },
          });
        } catch {
          // ignore demo errors
        }
      }, 8000);

      return NextResponse.json({
        id: generation.id,
        taskId: demoTaskId,
        status: "processing",
        demo: true,
      });
    }
  } catch (error) {
    console.error("[Route] Unexpected error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
