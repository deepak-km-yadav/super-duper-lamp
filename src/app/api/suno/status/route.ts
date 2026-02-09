import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getGenerationStatus } from "@/lib/suno";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const generationId = req.nextUrl.searchParams.get("id");
    if (!generationId) {
      return NextResponse.json({ error: "Generation ID required" }, { status: 400 });
    }

    const generation = await prisma.generation.findFirst({
      where: { id: generationId, userId: session.user.id },
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
      } catch {
        // Suno API unreachable, return current state
      }
    }

    const updated = await prisma.generation.findFirst({
      where: { id: generationId },
      include: { tracks: true },
    });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
