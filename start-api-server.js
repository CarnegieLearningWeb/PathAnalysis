#!/usr/bin/env node

// Simple Node.js script to start the Express API server
// This runs separately from the Vite dev server

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

// Enable CORS for API calls
app.use(cors());
app.use(express.json());

// Data directory path (one level up from PathAnalysis)
const dataDirectory = path.resolve(__dirname, '../Data');

// API endpoint to list available CSV files
app.get('/api/data-files', (_req, res) => {
  try {
    if (!fs.existsSync(dataDirectory)) {
      return res.json({ files: [], error: 'Data directory not found' });
    }
    
    const files = fs.readdirSync(dataDirectory)
      .filter(file => file.endsWith('.csv'))
      .map(filename => {
        const filePath = path.join(dataDirectory, filename);
        const stats = fs.statSync(filePath);
        return {
          filename,
          size: stats.size,
          modified: stats.mtime.toISOString(),
          path: `/api/data-files/${encodeURIComponent(filename)}`
        };
      })
      .sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime());
    
    res.json({ files, dataDirectory });
  } catch (error) {
    console.error('Error listing data files:', error);
    res.status(500).json({ error: 'Failed to list data files' });
  }
});

// API endpoint to serve specific CSV files
app.get('/api/data-files/:filename', (req, res) => {
  try {
    const filename = decodeURIComponent(req.params.filename);
    const filePath = path.join(dataDirectory, filename);
    
    // Security check: ensure file is within data directory
    if (!filePath.startsWith(dataDirectory)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Set appropriate headers for CSV download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    
  } catch (error) {
    console.error('Error serving data file:', error);
    res.status(500).json({ error: 'Failed to serve file' });
  }
});

// API endpoint to get CSV file content as text
app.get('/api/data-files/:filename/content', (req, res) => {
  try {
    const filename = decodeURIComponent(req.params.filename);
    const filePath = path.join(dataDirectory, filename);
    
    // Security check: ensure file is within data directory
    if (!filePath.startsWith(dataDirectory)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    const content = fs.readFileSync(filePath, 'utf-8');
    res.setHeader('Content-Type', 'text/plain');
    res.send(content);
    
  } catch (error) {
    console.error('Error reading data file:', error);
    res.status(500).json({ error: 'Failed to read file' });
  }
});

app.listen(port, () => {
  console.log(`🚀 Path Analysis Tool API Server running on port ${port}`);
  console.log(`📁 Data directory: ${dataDirectory}`);
  console.log(`🔗 Available endpoints:`);
  console.log(`   - GET /api/data-files (list CSV files)`);
  console.log(`   - GET /api/data-files/:filename (download CSV)`);
  console.log(`   - GET /api/data-files/:filename/content (get CSV content)`);
  console.log(`\n💡 Start Vite dev server with: npm run dev`);
});