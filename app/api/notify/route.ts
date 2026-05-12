import { NextRequest, NextResponse } from "next/server";
import { Server as SocketIOServer } from "socket.io";

declare global {
  var io: SocketIOServer | undefined;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (global.io) {
      global.io.emit("notification", { message: body.message || "Notification from Next.js API" });
      return NextResponse.json({ success: true, message: "Notification sent via Socket.IO" });
    } else {
      return NextResponse.json(
        { success: false, error: "Socket.IO not initialized on global object" },
        { status: 500 }
      );
    }
  } catch (error) {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json({ message: "Use POST to send a notification via Socket.IO" });
}
