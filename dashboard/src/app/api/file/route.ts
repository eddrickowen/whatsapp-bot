import { NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import { extname } from 'path';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const filePath = searchParams.get('path');

  if (!filePath) {
    return new NextResponse('File path is required', { status: 400 });
  }

  // Security check: Only allow paths within the classified directory
  // In a real production environment, this needs strict sanitization
  if (!filePath.toLowerCase().includes('classified')) {
    return new NextResponse('Access Denied', { status: 403 });
  }

  try {
    if (!existsSync(filePath)) {
      return new NextResponse('File not found', { status: 404 });
    }

    const fileBuffer = readFileSync(filePath);
    const ext = extname(filePath).toLowerCase();
    
    let mimeType = 'application/octet-stream';
    if (ext === '.jpeg' || ext === '.jpg') mimeType = 'image/jpeg';
    else if (ext === '.png') mimeType = 'image/png';
    else if (ext === '.webp') mimeType = 'image/webp';
    else if (ext === '.pdf') mimeType = 'application/pdf';

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': mimeType,
        'Cache-Control': 'public, max-age=86400', // Cache for 1 day
      },
    });
  } catch (error) {
    console.error("Error reading file:", error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
