import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { taskId, status, clips, errorMessage } = body;

    if (!taskId) {
      return NextResponse.json({ error: "taskId required" }, { status: 400 });
    }

    const generation = await prisma.generation.findFirst({
      where: { taskId },
    });

    if (!generation) {
      return NextResponse.json({ error: "Generation not found" }, { status: 404 });
    }

    if (status === "completed" && clips) {
      for (const clip of clips) {
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
    } else if (status === "failed") {
      await prisma.generation.update({
        where: { id: generation.id },
        data: {
          status: "failed",
          errorMessage: errorMessage || "Generation failed",
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
