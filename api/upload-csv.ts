import { VercelRequest, VercelResponse } from '@vercel/node';
import { IncomingForm } from 'formidable';

const GITHUB_OWNER = process.env.GITHUB_OWNER || 'CarnegieLearningWeb';
const GITHUB_REPO = process.env.GITHUB_REPO || 'PathAnalysis';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const DATA_PATH = 'csv-data';

export const config = {
  api: {
    bodyParser: false, // Disable body parsing for file uploads
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!GITHUB_TOKEN) {
    return res.status(500).json({ error: 'GitHub token not configured' });
  }

  try {
    let filename: string;
    let content: string;

    // Parse multipart form data or handle direct CSV content
    if (req.headers['content-type']?.includes('multipart/form-data')) {
      // Handle file upload from form
      const form = new IncomingForm();
      const [fields, files] = await form.parse(req);
      
      const uploadedFile = Array.isArray(files.file) ? files.file[0] : files.file;
      if (!uploadedFile) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const fs = require('fs');
      content = fs.readFileSync(uploadedFile.filepath, 'utf-8');
      filename = uploadedFile.originalFilename || `upload-${Date.now()}.csv`;
    } else {
      // Handle direct CSV content from Hugging Face
      const body = JSON.parse(req.body);
      filename = body.filename;
      content = body.content;
      
      if (!filename || !content) {
        return res.status(400).json({ error: 'Filename and content are required' });
      }
    }

    await uploadToGitHub(filename, content);
    res.status(200).json({ message: 'File uploaded successfully', filename });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
}

async function uploadToGitHub(filename: string, content: string) {
  const filePath = `${DATA_PATH}/${filename}`;
  const apiUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath}`;
  
  // Check if file already exists (to get SHA if updating)
  let sha: string | undefined;
  try {
    const checkResponse = await fetch(apiUrl, {
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'PathAnalysisTool'
      }
    });
    
    if (checkResponse.ok) {
      const existingFile = await checkResponse.json();
      sha = existingFile.sha;
    }
  } catch (error) {
    // File doesn't exist, which is fine
  }
  
  // Create or update file
  const payload = {
    message: `Add/Update CSV data: ${filename}`,
    content: Buffer.from(content).toString('base64'),
    ...(sha && { sha }) // Include SHA if file exists (for update)
  };
  
  const response = await fetch(apiUrl, {
    method: 'PUT',
    headers: {
      'Authorization': `token ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'PathAnalysisTool',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`GitHub API error: ${response.status} ${JSON.stringify(errorData)}`);
  }
  
  return await response.json();
}