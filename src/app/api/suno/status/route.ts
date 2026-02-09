import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getGenerationStatus } from "@/lib/suno";

export async function GET(req: NextRequest) {
  try {
    const generationId = req.nextUrl.searchParams.get("id");
    if (!generationId) {
      return NextResponse.json({ error: "Generation ID required" }, { status: 400 });
    }

    const generation = await prisma.generation.findFirst({
      where: { id: generationId },
      include: { tracks: true },
    });

    if (!generation) {
      return NextResponse.json({ error: "Generation not found" }, { status: 404 });
    }

    // If already completed or failed, return current state
    if (generation.status === "completed" || generation.status === "failed") {
      return NextResponse.json(generation);
    }

    // If it's a demo task, check if demo tracks exist
    if (generation.taskId?.startsWith("demo-")) {
      const withTracks = await prisma.generation.findFirst({
        where: { id: generationId },
        include: { tracks: true },
      });
      return NextResponse.json(withTracks);
    }

    // Poll Suno for status
    if (generation.taskId) {
      try {
        const status = await getGenerationStatus(generation.taskId);

        if (status.data?.status === "completed" && status.data.clips) {
          // Save tracks
          for (const clip of status.data.clips) {
            await prisma.generationTrack.create({
              data: {
                generationId: generation.id,
                audioUrl: clip.audioUrl,
                title: clip.title,
                duration: clip.duration,
                modelUsed: clip.model,
                styleTags: clip.style,
                imageUrl: clip.imageUrl,
              },
            });
          }

          await prisma.generation.update({
            where: { id: generation.id },
            data: { status: "completed" },
          });
        } else if (status.data?.status === "failed") {
          await prisma.generation.update({
            where: { id: generation.id },
            data: {
              status: "failed",
              errorMessage: status.data.errorMessage || "Generation failed",
            },
          });
        }
      } catch (error) {
        console.error("[Status Route] Error polling Suno API:", error);
        // Suno API unreachable, return current state
      }
    }

    const updated = await prisma.generation.findFirst({
      where: { id: generationId },
      include: { tracks: true },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[Status Route] Unexpected error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
