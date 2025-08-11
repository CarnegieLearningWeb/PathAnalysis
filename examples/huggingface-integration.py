#!/usr/bin/env python3
"""
Example: Hugging Face to Path Analysis Tool Integration
This shows how to save generated CSV data directly to cloud storage.
"""

import requests
import csv
import io
from datetime import datetime

class HuggingFaceToPathAnalysis:
    def __init__(self, upload_url):
        self.upload_url = upload_url
        
    def save_csv_data(self, data, filename=None):
        """
        Save CSV data to Path Analysis Tool cloud storage.
        
        Args:
            data: List of dictionaries or pandas DataFrame
            filename: Optional custom filename
        """
        if filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"huggingface_generated_{timestamp}.csv"
            
        if not filename.endswith('.csv'):
            filename += '.csv'
            
        # Convert data to CSV string
        if hasattr(data, 'to_csv'):  # pandas DataFrame
            csv_content = data.to_csv(index=False)
        else:  # list of dictionaries
            if not data:
                raise ValueError("No data provided")
                
            output = io.StringIO()
            writer = csv.DictWriter(output, fieldnames=data[0].keys())
            writer.writeheader()
            writer.writerows(data)
            csv_content = output.getvalue()
        
        # Upload to cloud storage
        payload = {
            'filename': filename,
            'content': csv_content
        }
        
        try:
            response = requests.post(self.upload_url, json=payload, timeout=30)
            
            if response.status_code == 200:
                print(f"✅ Successfully saved {filename} to Path Analysis Tool")
                return True
            else:
                print(f"❌ Failed to save {filename}: {response.status_code} {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Error saving {filename}: {e}")
            return False

# Example usage in your Hugging Face app:

def generate_and_save_csv_data():
    """Example function showing how to generate and save CSV data."""
    
    # Your Hugging Face model generates this data
    generated_data = [
        {
            'Anon Student Id': 'student_001',
            'Time': '2024-01-15 10:30:00',
            'Step Name': 'Introduction',
            'Outcome': 'CORRECT',
            'CF (Workspace Progress Status)': 'GRADUATED',
            'Problem Name': 'ER_Problem_1'
        },
        {
            'Anon Student Id': 'student_001', 
            'Time': '2024-01-15 10:31:00',
            'Step Name': 'Setup',
            'Outcome': 'INCORRECT',
            'CF (Workspace Progress Status)': 'GRADUATED',
            'Problem Name': 'ER_Problem_1'
        },
        # ... more generated data
    ]
    
    # Initialize the integration (use your actual Vercel URL)
    uploader = HuggingFaceToPathAnalysis('https://your-app.vercel.app/api/upload-csv')
    
    # Save the data
    success = uploader.save_csv_data(
        data=generated_data,
        filename='generated_learning_paths'
    )
    
    if success:
        print("🎉 Data is now available in Path Analysis Tool!")
        print("📊 View at: https://your-app.vercel.app")
    
    return success

if __name__ == "__main__":
    generate_and_save_csv_data()