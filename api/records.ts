import { Request, Response } from "express";
import fs from "fs";
import path from "path";

const RECORDS_ROOT = path.join(process.cwd(), "records");

// Ensure base folders exist on startup
function initializeRecordsFolder() {
  const dirs = ["", "modulator", "ai_chat", "uploads"];
  dirs.forEach((dir) => {
    const targetPath = path.join(RECORDS_ROOT, dir);
    if (!fs.existsSync(targetPath)) {
      fs.mkdirSync(targetPath, { recursive: true });
    }
  });
}

// Initialize on load
initializeRecordsFolder();

export interface ServerFile {
  name: string;
  path: string; // relative to records root
  url: string;  // public access URL
  size: number;
  timestamp: number;
}

export interface FolderStructure {
  name: string;
  files: ServerFile[];
}

// 1. LIST FILES AND DIRECTORIES
async function listRecords(req: Request, res: Response) {
  try {
    initializeRecordsFolder(); // double-check
    const folders: FolderStructure[] = [];

    // Read top level of records
    const topItems = await fs.promises.readdir(RECORDS_ROOT, { withFileTypes: true });

    for (const item of topItems) {
      if (item.isDirectory()) {
        const folderPath = path.join(RECORDS_ROOT, item.name);
        const fileNames = await fs.promises.readdir(folderPath, { withFileTypes: true });
        
        const files: ServerFile[] = [];
        for (const file of fileNames) {
          if (file.isFile()) {
            const filePath = path.join(folderPath, file.name);
            const stats = await fs.promises.stat(filePath);
            
            files.push({
              name: file.name,
              path: `${item.name}/${file.name}`,
              url: `/records/${item.name}/${file.name}`,
              size: stats.size,
              timestamp: stats.mtimeMs,
            });
          }
        }
        
        // Sort files by newest first
        files.sort((a, b) => b.timestamp - a.timestamp);

        folders.push({
          name: item.name,
          files,
        });
      }
    }

    res.json({ folders });
  } catch (error: any) {
    console.error("List records error:", error);
    res.status(500).json({ error: "Failed to list records on server: " + error.message });
  }
}

// 2. CREATE A SUBFOLDER
async function createFolder(req: Request, res: Response) {
  try {
    const { folderName } = req.body;
    if (!folderName || typeof folderName !== "string") {
      res.status(400).json({ error: "Invalid or missing folderName" });
      return;
    }

    // Sanitize folder name (alphanumeric and underscores/hyphens only)
    const sanitized = folderName.replace(/[^a-zA-Z0-9_\-]/g, "_").trim().toLowerCase();
    if (!sanitized) {
      res.status(400).json({ error: "Folder name is empty after sanitization" });
      return;
    }

    const targetPath = path.join(RECORDS_ROOT, sanitized);
    if (fs.existsSync(targetPath)) {
      res.status(400).json({ error: "Folder already exists" });
      return;
    }

    await fs.promises.mkdir(targetPath, { recursive: true });
    res.json({ success: true, folderName: sanitized });
  } catch (error: any) {
    console.error("Create folder error:", error);
    res.status(500).json({ error: "Failed to create folder: " + error.message });
  }
}

// 3. SAVE FILE TO A FOLDER
async function saveFileToFolder(req: Request, res: Response) {
  try {
    const file = req.file;
    const { folderName, customName } = req.body;

    if (!file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    const targetFolder = folderName ? folderName.replace(/[^a-zA-Z0-9_\-]/g, "_") : "uploads";
    const folderPath = path.join(RECORDS_ROOT, targetFolder);

    // Ensure folder exists
    if (!fs.existsSync(folderPath)) {
      await fs.promises.mkdir(folderPath, { recursive: true });
    }

    // Determine target name
    let fileName = customName ? customName.replace(/[^a-zA-Z0-9_.\-]/g, "_") : file.originalname;
    
    // Ensure file extension matches
    const originalExt = path.extname(file.originalname) || ".webm";
    if (!fileName.endsWith(originalExt)) {
      fileName = fileName + originalExt;
    }

    const targetFilePath = path.join(folderPath, fileName);
    
    // Write file to server storage
    await fs.promises.writeFile(targetFilePath, file.buffer);

    res.json({
      success: true,
      file: {
        name: fileName,
        path: `${targetFolder}/${fileName}`,
        url: `/records/${targetFolder}/${fileName}`,
        size: file.size,
        timestamp: Date.now(),
      }
    });
  } catch (error: any) {
    console.error("Save file error:", error);
    res.status(500).json({ error: "Failed to save file: " + error.message });
  }
}

// 4. DELETE A FILE
async function deleteFile(req: Request, res: Response) {
  try {
    const { filePath } = req.body; // e.g., "modulator/sound.webm"
    if (!filePath || typeof filePath !== "string") {
      res.status(400).json({ error: "Missing or invalid filePath" });
      return;
    }

    // Sanitize path relative to root to prevent directory traversal
    const safePath = path.normalize(filePath).replace(/^(\.\.(\/|\\|$))+/, "");
    const fullPath = path.join(RECORDS_ROOT, safePath);

    if (!fs.existsSync(fullPath)) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    // Ensure we are not deleting the records root or top-level initial folders
    if (fullPath === RECORDS_ROOT) {
      res.status(400).json({ error: "Cannot delete records root directory" });
      return;
    }

    const stats = await fs.promises.stat(fullPath);
    if (stats.isDirectory()) {
      // If it's a folder, only allow deleting if empty, and not an initial default folder
      const relativeFolder = path.relative(RECORDS_ROOT, fullPath);
      if (["", "modulator", "ai_chat", "uploads"].includes(relativeFolder)) {
        res.status(400).json({ error: "Cannot delete system default folders" });
        return;
      }

      await fs.promises.rmdir(fullPath);
    } else {
      await fs.promises.unlink(fullPath);
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error("Delete file error:", error);
    res.status(500).json({ error: "Failed to delete file: " + error.message });
  }
}

// Route distributor based on method / query
export default async function handler(req: Request, res: Response) {
  const { action } = req.query;

  if (req.method === "GET") {
    return listRecords(req, res);
  }

  if (req.method === "POST") {
    if (action === "create-folder") {
      return createFolder(req, res);
    }
    if (action === "save-file") {
      return saveFileToFolder(req, res);
    }
    if (action === "delete") {
      return deleteFile(req, res);
    }
  }

  res.status(405).json({ error: "Method not allowed" });
}
