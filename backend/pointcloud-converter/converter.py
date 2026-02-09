#!/usr/bin/env python3
"""
Point Cloud Converter for Hekamap
Converts LAS/LAZ files to both Potree and 3D Tiles formats.
Designed to run as a Cloud Run Job.
"""

import argparse
import subprocess
import os
import sys
import tempfile
import shutil
from pathlib import Path
from typing import Optional
import json
from urllib.parse import urlparse

# Third-party imports
import boto3
from botocore.config import Config
from supabase import create_client, Client


class PointCloudConverter:
    """Handles LAS/LAZ to Potree + 3D Tiles conversion."""
    
    def __init__(self, asset_id: str, input_url: str, output_bucket: str):
        self.asset_id = asset_id
        self.input_url = input_url
        self.output_bucket = output_bucket
        self.work_dir = Path(tempfile.mkdtemp(prefix=f"pc_{asset_id}_"))
        
        # R2 Client (S3-compatible)
        self.s3 = boto3.client(
            's3',
            endpoint_url=os.environ.get('R2_ENDPOINT'),
            aws_access_key_id=os.environ.get('R2_ACCESS_KEY'),
            aws_secret_access_key=os.environ.get('R2_SECRET_KEY'),
            config=Config(signature_version='s3v4'),
            region_name='auto'
        )
        self.bucket_name = os.environ.get('R2_BUCKET_NAME', 'hekamap-assets')
        
        # Supabase Client
        self.supabase: Client = create_client(
            os.environ['SUPABASE_URL'],
            os.environ['SUPABASE_KEY']
        )
        
    def log(self, message: str, level: str = "INFO"):
        """Simple logging to stdout (captured by Cloud Run)."""
        print(f"[{level}] [{self.asset_id}] {message}", flush=True)
        
    def download_input(self) -> Path:
        """Download LAS/LAZ file from R2."""
        self.log(f"Downloading from {self.input_url}")
        
        # Extract key from URL (handle custom domains or R2 dev URLs)
        parsed_url = urlparse(self.input_url)
        key = parsed_url.path.lstrip('/')
        
        # Determine extension
        ext = '.laz' if '.laz' in key.lower() else '.las'
        local_path = self.work_dir / f"input{ext}"
        
        self.log(f"Downloading key: '{key}' from bucket: '{self.bucket_name}'")
        self.s3.download_file(self.bucket_name, key, str(local_path))
        
        file_size = local_path.stat().st_size / (1024 * 1024)
        self.log(f"Downloaded {file_size:.2f} MB")
        
        return local_path
        
    def convert_to_potree(self, input_file: Path) -> Path:
        """Convert to Potree octree format using PotreeConverter."""
        self.log("Starting Potree conversion...")
        
        output_dir = self.work_dir / 'potree'
        output_dir.mkdir(parents=True, exist_ok=True)
        
        cmd = [
            'PotreeConverter',
            str(input_file),
            '-o', str(output_dir),
            '--generate-page', 'viewer'
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode != 0:
            self.log(f"PotreeConverter error: {result.stderr}", "ERROR")
            raise RuntimeError(f"PotreeConverter failed: {result.stderr}")
            
        self.log("Potree conversion complete")
        return output_dir
        
    def convert_to_3dtiles(self, input_file: Path) -> Path:
        """Convert to 3D Tiles format using py3dtiles."""
        self.log("Starting 3D Tiles conversion...")
        
        output_dir = self.work_dir / '3dtiles'
        output_dir.mkdir(parents=True, exist_ok=True)
        
        cmd = [
            'py3dtiles', 'convert',
            str(input_file),
            '--out', str(output_dir),
            '--srs', 'EPSG:4326'  # Default to WGS84, can be parameterized
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode != 0:
            self.log(f"py3dtiles error: {result.stderr}", "ERROR")
            raise RuntimeError(f"py3dtiles failed: {result.stderr}")
            
        self.log("3D Tiles conversion complete")
        return output_dir
        
    def upload_folder(self, local_folder: Path, r2_prefix: str) -> str:
        """Upload folder contents to R2 recursively."""
        self.log(f"Uploading {local_folder.name} to {r2_prefix}")
        
        file_count = 0
        for file_path in local_folder.rglob('*'):
            if file_path.is_file():
                relative_path = file_path.relative_to(local_folder)
                s3_key = f"{r2_prefix}/{relative_path}"
                
                # Determine content type
                content_type = 'application/octet-stream'
                if file_path.suffix == '.json':
                    content_type = 'application/json'
                elif file_path.suffix == '.html':
                    content_type = 'text/html'
                elif file_path.suffix == '.js':
                    content_type = 'application/javascript'
                    
                self.s3.upload_file(
                    str(file_path),
                    self.bucket_name,
                    s3_key,
                    ExtraArgs={'ContentType': content_type}
                )
                file_count += 1
                
        self.log(f"Uploaded {file_count} files")
        
        # Return public URL to the folder
        return f"{self.output_bucket}/{r2_prefix}"
        
    def update_database(self, potree_url: str, tiles_url: str, metadata: dict):
        """Update asset record in Supabase."""
        self.log("Updating database...")
        
        self.supabase.table('assets').update({
            'status': 'READY',
            'potree_url': potree_url,
            'tiles_url': tiles_url,
            'metadata': metadata,
            'error_message': None
        }).eq('id', self.asset_id).execute()
        
        self.log("Database updated successfully")
        
    def set_error(self, error_message: str):
        """Mark asset as failed in database."""
        self.log(f"Setting error status: {error_message}", "ERROR")
        
        try:
            self.supabase.table('assets').update({
                'status': 'ERROR',
                'error_message': error_message[:500]  # Truncate long messages
            }).eq('id', self.asset_id).execute()
        except Exception as e:
            self.log(f"Failed to update error status: {e}", "ERROR")
            
    def cleanup(self):
        """Remove temporary files."""
        self.log("Cleaning up temporary files...")
        shutil.rmtree(self.work_dir, ignore_errors=True)
        
    def run(self):
        """Execute the full conversion pipeline."""
        try:
            # 1. Download input
            input_file = self.download_input()
            
            # 2. Convert to Potree
            potree_output = self.convert_to_potree(input_file)
            
            # 3. Convert to 3D Tiles
            tiles_output = self.convert_to_3dtiles(input_file)
            
            # 4. Upload outputs
            potree_url = self.upload_folder(
                potree_output, 
                f"processed/potree/{self.asset_id}"
            )
            tiles_url = self.upload_folder(
                tiles_output, 
                f"processed/3dtiles/{self.asset_id}"
            )
            
            # 5. Extract metadata (point count from Potree output if available)
            metadata = {}
            metadata_file = potree_output / 'metadata.json'
            if metadata_file.exists():
                with open(metadata_file) as f:
                    potree_meta = json.load(f)
                    metadata['pointCount'] = potree_meta.get('points', 0)
                    metadata['boundingBox'] = potree_meta.get('boundingBox', {})
                    
            # 6. Update database
            self.update_database(potree_url, tiles_url, metadata)
            
            self.log("✅ Conversion complete!")
            
        except Exception as e:
            self.set_error(str(e))
            raise
            
        finally:
            self.cleanup()


def main():
    parser = argparse.ArgumentParser(description='Point Cloud Converter')
    parser.add_argument('--asset-id', required=True, help='Asset UUID')
    parser.add_argument('--input-url', required=True, help='R2 URL of input LAS/LAZ file')
    parser.add_argument('--output-bucket', required=True, help='Public R2 bucket URL')
    
    args = parser.parse_args()
    
    converter = PointCloudConverter(
        asset_id=args.asset_id,
        input_url=args.input_url,
        output_bucket=args.output_bucket
    )
    
    converter.run()


if __name__ == '__main__':
    main()
