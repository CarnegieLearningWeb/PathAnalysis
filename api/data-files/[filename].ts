import { VercelRequest, VercelResponse } from '@vercel/node';

const GITHUB_OWNER = process.env.GITHUB_OWNER || 'CarnegieLearningWeb';
const GITHUB_REPO = process.env.GITHUB_REPO || 'PathAnalysis';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const DATA_PATH = 'csv-data'; // Folder in the repo to store CSV files

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const { filename } = req.query;
    
    if (!filename || typeof filename !== 'string') {
      return res.status(400).json({ error: 'Filename is required' });
    }

    const decodedFilename = decodeURIComponent(filename);
    
    // Try to fetch from Hugging Face dataset first (for dynamically generated files)
    try {
      const hfUrl = `https://huggingface.co/datasets/suryadev1/generated-csvs/resolve/main/${decodedFilename}`;
      
      const hfResponse = await fetch(hfUrl, {
        headers: {
          'User-Agent': 'PathAnalysisTool'
        }
      });
      
      if (hfResponse.ok) {
        const content = await hfResponse.text();
        res.setHeader('Content-Type', 'text/plain');
        res.status(200).send(content);
        return;
      }
    } catch (error) {
      // Continue to try GitHub if Hugging Face fails
    }
    
    // Try GitHub repository for other files
    const apiUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${DATA_PATH}/${decodedFilename}`;
    
    const headers: any = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'PathAnalysisTool'
    };
    
    if (GITHUB_TOKEN) {
      headers.Authorization = `token ${GITHUB_TOKEN}`;
    }

    const response = await fetch(apiUrl, { headers });
    
    if (!response.ok) {
      if (response.status === 404) {
        return res.status(404).json({ error: 'File not found' });
      }
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data.type !== 'file') {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Decode base64 content
    const content = Buffer.from(data.content, 'base64').toString('utf-8');
    
    res.setHeader('Content-Type', 'text/plain');
    res.status(200).send(content);
    
  } catch (error: any) {
    console.error('Error serving GitHub file:', error);
    res.status(500).json({ error: 'Failed to serve file from GitHub' });
  }
}