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
    // Combined files from GitHub repository and Hugging Face
    const allFiles: any[] = [];

    // Get files from GitHub repository
    try {
      const apiUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${DATA_PATH}`;
      
      const headers: any = {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'PathAnalysisTool'
      };
      
      if (GITHUB_TOKEN) {
        headers.Authorization = `token ${GITHUB_TOKEN}`;
      }

      const response = await fetch(apiUrl, { headers });
      
      if (response.ok) {
        const data = await response.json();
        
        if (Array.isArray(data)) {
          const githubFiles = data
            .filter(item => item.type === 'file' && item.name.endsWith('.csv'))
            .map(file => ({
              filename: file.name,
              size: file.size || 0,
              modified: new Date().toISOString(),
              path: `/api/data-files/${encodeURIComponent(file.name)}`,
              downloadUrl: file.download_url,
              source: 'github'
            }));
          allFiles.push(...githubFiles);
        }
      }
    } catch (error) {
      console.warn('GitHub files not accessible:', error);
    }

    // Fetch files dynamically from Hugging Face Dataset
    try {
      const hfDatasetUrl = 'https://huggingface.co/api/datasets/suryadev1/generated-csvs/tree/main';
      const hfResponse = await fetch(hfDatasetUrl, {
        headers: {
          'User-Agent': 'PathAnalysisTool'
        }
      });
      
      if (hfResponse.ok) {
        const hfData = await hfResponse.json();
        
        if (Array.isArray(hfData)) {
          const huggingFaceFiles = hfData
            .filter(item => item.type === 'file' && item.path.endsWith('.csv'))
            .map(file => ({
              filename: file.path,
              size: file.size || 0,
              modified: new Date(file.lastCommit?.date || Date.now()).toISOString(),
              path: `/api/data-files/${encodeURIComponent(file.path)}`,
              downloadUrl: `https://huggingface.co/datasets/suryadev1/generated-csvs/resolve/main/${file.path}`,
              source: 'huggingface'
            }));
          allFiles.push(...huggingFaceFiles);
        }
      }
    } catch (error) {
      console.warn('Hugging Face dataset files not accessible:', error);
    }
    
    // Sort files by filename
    const sortedFiles = allFiles.sort((a, b) => a.filename.localeCompare(b.filename));
    
    res.status(200).json({ 
      files: sortedFiles, 
      sources: { github: `${GITHUB_OWNER}/${GITHUB_REPO}`, huggingface: 'suryadev1/generated-csvs' }
    });
  } catch (error) {
    console.error('Error listing data files:', error);
    res.status(500).json({ error: 'Failed to list data files' });
  }
}