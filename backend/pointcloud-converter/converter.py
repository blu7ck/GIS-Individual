#!/usr/bin/env python3
"""Point Cloud Converter for Hekamap (Potree Octree only)

- Downloads LAS/LAZ from Cloudflare R2 (S3-compatible)
- Converts to Potree octree using PotreeConverter
- Uploads Potree output folder back to R2
- Updates Supabase assets table

Designed to run as a Cloud Run Job.
"""

import argparse
import subprocess
import os
import tempfile
import shutil
from pathlib import Path
import json
from urllib.parse import urlparse

import boto3
from botocore.config import Config
from supabase import create_client, Client


def _require_env(name: str) -> str:
    v = os.environ.get(name, "").strip()
    if not v:
        raise ValueError(f"{name} must be set")
    return v


class PointCloudConverter:
    def __init__(self, asset_id: str, input_url: str, output_bucket: str, input_key: str | None = None):
        self.asset_id = asset_id
        self.input_url = input_url
        self.output_bucket = (output_bucket or "").rstrip("/")
        self.input_key = input_key
        self.work_dir = Path(tempfile.mkdtemp(prefix=f"pc_{asset_id}_"))

        # --- Validate env early (fail fast with readable errors) ---
        r2_access = _require_env("R2_ACCESS_KEY")
        r2_secret = _require_env("R2_SECRET_KEY")
        r2_endpoint = _require_env("R2_ENDPOINT")
        self.bucket_name = os.environ.get("R2_BUCKET_NAME", "hekamap-assets").strip() or "hekamap-assets"

        sb_url = _require_env("SUPABASE_URL")
        sb_key = _require_env("SUPABASE_KEY")

        # R2 Client (S3-compatible)
        self.s3 = boto3.client(
            "s3",
            endpoint_url=r2_endpoint,
            aws_access_key_id=r2_access,
            aws_secret_access_key=r2_secret,
            config=Config(signature_version="s3v4"),
            region_name="auto",
        )

        endpoint = r2_endpoint
        self.log(
            f"R2 Configuration: Bucket={self.bucket_name}, Endpoint={'Global' if '.eu.' not in endpoint else 'EU-Jurisdiction'}"
        )

        # Supabase Client
        self.supabase: Client = create_client(sb_url, sb_key)

    def log(self, message: str, level: str = "INFO") -> None:
        print(f"[{level}] [{self.asset_id}] {message}", flush=True)

    def _derive_key(self) -> str:
        """Derive an object key from input_key or input_url.

        Best practice is to pass --input-key. URL parsing is a fallback.
        """
        if self.input_key:
            key = self.input_key.lstrip("/")
            if not key:
                raise ValueError("input_key is empty")
            return key

        if not self.input_url:
            raise ValueError("input_url is empty (provide --input-key or --input-url)")

        parsed = urlparse(self.input_url)
        key = (parsed.path or "").lstrip("/")

        # If URL includes bucket name in the path (common for some public URL patterns), strip it.
        # Example: /hekamap-assets/uploads/a.laz  -> uploads/a.laz
        if key.startswith(self.bucket_name + "/"):
            key = key[len(self.bucket_name) + 1 :]

        if not key:
            raise ValueError("Failed to derive object key from input_url; pass --input-key instead.")

        return key

    def download_input(self) -> Path:
        self.log(f"Downloading from {self.input_url or '(input_key mode)'}")

        key = self._derive_key()

        # Determine extension
        lower = key.lower()
        if lower.endswith(".laz"):
            ext = ".laz"
        elif lower.endswith(".las"):
            ext = ".las"
        else:
            # Fallback: guess from URL, else default to .laz
            ext = ".laz" if ".laz" in lower else ".las"

        local_path = self.work_dir / f"input{ext}"

        self.log(f"Downloading key: '{key}' from bucket: '{self.bucket_name}'")
        self.s3.download_file(self.bucket_name, key, str(local_path))

        file_size = local_path.stat().st_size / (1024 * 1024)
        self.log(f"Downloaded {file_size:.2f} MB")

        return local_path

    def convert_to_potree(self, input_file: Path) -> Path:
        self.log("Starting Potree conversion...")

        if not input_file.exists():
            raise RuntimeError(f"Input file not found: {input_file}")

        output_dir = self.work_dir / "potree"
        output_dir.mkdir(parents=True, exist_ok=True)

        # NOTE: No viewer generation here (keeps output smaller and faster to upload).
        cmd = [
            "/opt/potree/PotreeConverter",
            str(input_file),
            "-o",
            str(output_dir),
        ]

        result = subprocess.run(cmd, capture_output=True, text=True)

        # Always log stdout for troubleshooting (PotreeConverter is chatty and useful).
        if result.stdout.strip():
            self.log(result.stdout.strip())

        if result.returncode != 0:
            err = (result.stderr or "").strip()
            if err:
                self.log(f"PotreeConverter stderr: {err}", "ERROR")
            raise RuntimeError(f"PotreeConverter failed (code {result.returncode})")

        self.log("Potree conversion complete")
        return output_dir

    def _content_args_for(self, file_path: Path) -> dict:
        """Return ExtraArgs for S3 upload based on file extension."""
        suffix = file_path.suffix.lower()

        # Basic content types for Potree viewer assets / metadata.
        content_type_map = {
            ".json": "application/json",
            ".html": "text/html",
            ".js": "application/javascript",
            ".css": "text/css",
            ".wasm": "application/wasm",
            ".bin": "application/octet-stream",
            ".txt": "text/plain",
            ".svg": "image/svg+xml",
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".gif": "image/gif",
            ".map": "application/json",
            ".xml": "application/xml",
        }

        extra: dict = {"ContentType": content_type_map.get(suffix, "application/octet-stream")}

        # If you're actually uploading pre-gzipped assets with .gz extension, set encoding.
        if suffix == ".gz":
            extra["ContentEncoding"] = "gzip"
            # Try to guess original type from the second suffix (e.g., .js.gz)
            parts = file_path.name.lower().split(".")
            if len(parts) >= 3:
                orig_suffix = "." + parts[-2]
                extra["ContentType"] = content_type_map.get(orig_suffix, "application/octet-stream")

        return extra

    def upload_folder(self, local_folder: Path, r2_prefix: str) -> str:
        self.log(f"Uploading {local_folder.name} to {r2_prefix}")

        file_count = 0
        for file_path in local_folder.rglob("*"):
            if not file_path.is_file():
                continue

            relative_path = file_path.relative_to(local_folder).as_posix()
            s3_key = f"{r2_prefix.rstrip('/')}/{relative_path}"

            extra_args = self._content_args_for(file_path)

            self.s3.upload_file(
                str(file_path),
                self.bucket_name,
                s3_key,
                ExtraArgs=extra_args,
            )
            file_count += 1

        self.log(f"Uploaded {file_count} files")

        return f"{self.output_bucket}/{r2_prefix.rstrip('/')}" if self.output_bucket else r2_prefix.rstrip("/")

    def _extract_potree_metadata(self, potree_output: Path) -> dict:
        """Best-effort extraction of point count / bounding box from Potree output."""
        meta: dict = {}

        # Some builds output metadata.json; others embed metadata in cloud.js.
        metadata_json = potree_output / "metadata.json"
        if metadata_json.exists():
            try:
                with open(metadata_json, "r", encoding="utf-8") as f:
                    m = json.load(f)
                meta["pointCount"] = m.get("points", m.get("pointCount", 0))
                meta["boundingBox"] = m.get("boundingBox", {})
                return meta
            except Exception:
                meta["metadata_read_error"] = True

        cloud_js = potree_output / "cloud.js"
        if cloud_js.exists():
            try:
                txt = cloud_js.read_text(encoding="utf-8", errors="ignore")
                # Potree cloud.js usually contains a JS object literal; try to extract JSON-ish part.
                start = txt.find("{")
                end = txt.rfind("}")
                if start != -1 and end != -1 and end > start:
                    blob = txt[start : end + 1]
                    # Some files are valid JSON; if not, this may fail (that's ok).
                    m = json.loads(blob)
                    meta["pointCount"] = m.get("points", m.get("pointCount", 0))
                    meta["boundingBox"] = m.get("boundingBox", {})
                    return meta
            except Exception:
                meta["cloudjs_parse_failed"] = True

        meta.setdefault("pointCount", 0)
        return meta

    def update_database(self, potree_url: str, metadata: dict) -> None:
        self.log("Updating database...")

        self.supabase.table("assets").update(
            {
                "status": "READY",
                "potree_url": potree_url,
                "metadata": metadata,
                "error_message": None,
            }
        ).eq("id", self.asset_id).execute()

        self.log("Database updated successfully")

    def set_error(self, error_message: str) -> None:
        self.log(f"Setting error status: {error_message}", "ERROR")

        try:
            self.supabase.table("assets").update(
                {
                    "status": "ERROR",
                    "error_message": (error_message or "")[:500],
                }
            ).eq("id", self.asset_id).execute()
        except Exception as e:
            self.log(f"Failed to update error status: {e}", "ERROR")

    def cleanup(self) -> None:
        self.log("Cleaning up temporary files...")
        shutil.rmtree(self.work_dir, ignore_errors=True)

    def run(self) -> None:
        try:
            input_file = self.download_input()
            potree_output = self.convert_to_potree(input_file)

            potree_url = self.upload_folder(potree_output, f"processed/potree/{self.asset_id}")

            metadata = self._extract_potree_metadata(potree_output)

            self.update_database(potree_url, metadata)
            self.log("✅ Conversion complete!")

        except Exception as e:
            self.set_error(str(e))
            raise
        finally:
            self.cleanup()


def main() -> None:
    parser = argparse.ArgumentParser(description="Point Cloud Converter (Potree only)")
    parser.add_argument("--asset-id", required=True, help="Asset UUID")
    parser.add_argument("--input-url", required=False, default="", help="R2 public URL of input LAS/LAZ file (optional if --input-key provided)")
    parser.add_argument("--input-key", required=False, default="", help="R2 object key (recommended; avoids fragile URL parsing)")
    parser.add_argument("--output-bucket", required=True, help="Public base URL where processed files are served (no trailing slash)")

    args = parser.parse_args()

    converter = PointCloudConverter(
        asset_id=args.asset_id,
        input_url=args.input_url,
        input_key=(args.input_key.strip() or None),
        output_bucket=args.output_bucket,
    )
    converter.run()


if __name__ == "__main__":
    main()
