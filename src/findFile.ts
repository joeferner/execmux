import { promises as fs } from 'fs';
import path from 'path';

export async function findFile(fileName: string): Promise<string> {
    return _findFile(__dirname, fileName);
}

async function _findFile(parent: string, fileName: string): Promise<string> {
    const absolutePath = path.join(parent, fileName);
    try {
        await fs.access(absolutePath);
    } catch (err) {
        if (err.code === 'ENOENT') {
            return _findFile(path.dirname(parent), fileName);
        }
    }
    return absolutePath;
}
