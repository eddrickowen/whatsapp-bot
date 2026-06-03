import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import child_process from 'child_process';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const reqPath = searchParams.get('path');

  try {
    if (!reqPath || reqPath === '/' || reqPath.trim() === '') {
      // List Windows drives
      const output = child_process.execSync('wmic logicaldisk get name').toString();
      const drives = output
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length === 2 && line.endsWith(':'))
        .map(drive => drive + '\\');

      return NextResponse.json({
        currentPath: '',
        directories: drives,
        parentPath: null,
      });
    }

    // List subdirectories for a given absolute path
    const absolutePath = path.resolve(reqPath);
    
    if (!fs.existsSync(absolutePath)) {
      return NextResponse.json({ error: 'Path not found' }, { status: 404 });
    }

    const items = fs.readdirSync(absolutePath, { withFileTypes: true });
    const directories = items
      .filter(item => item.isDirectory() && !item.name.startsWith('.'))
      .map(item => item.name);

    let parentPath: string | null = path.dirname(absolutePath);
    if (parentPath === absolutePath) {
      parentPath = null;
    }

    return NextResponse.json({
      currentPath: absolutePath,
      directories,
      parentPath,
    });
  } catch (error: any) {
    console.error('Error reading file system:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
