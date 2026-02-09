import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ error: "userId parameter required" }, { status: 400 });
    }

    const favorites = await prisma.favorite.findMany({
      where: { userId },
      include: {
        track: {
          include: { generation: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(favorites);
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const { userId, trackId } = await req.json();
    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }
    if (!trackId) {
      return NextResponse.json({ error: "trackId required" }, { status: 400 });
    }

    const favorite = await prisma.favorite.create({
      data: {
        userId,
        trackId,
      },
    });

    return NextResponse.json(favorite);
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get("userId");
    const trackId = req.nextUrl.searchParams.get("trackId");

    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }
    if (!trackId) {
      return NextResponse.json({ error: "trackId required" }, { status: 400 });
    }

    await prisma.favorite.deleteMany({
      where: {
        userId,
        trackId,
      },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
