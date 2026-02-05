# GCP Cloud Run Job Kurulum Rehberi

Bu rehber, LAS/LAZ dosyalarını işleyen Docker imajını GCP Artifact Registry'e yükleme ve Cloud Run Job oluşturma adımlarını içerir.

## Değişkenler
- **Project ID:** `gis-fixurelabs-mcp`
- **Region:** `europe-west1`
- **Repo Name:** `gis-individual-images`
- **Image Name:** `pointcloud-converter`
- **Full Image Path:** `europe-west1-docker.pkg.dev/gis-fixurelabs-mcp/gis-individual-images/pointcloud-converter:latest`

---

## 1. Hazırlık ve API
```bash
gcloud auth login
gcloud config set project gis-fixurelabs-mcp
gcloud services enable run.googleapis.com artifactregistry.googleapis.com
```

## 2. Artifact Registry Oluşturma
```bash
gcloud artifacts repositories create gis-individual-images \
    --repository-format=docker \
    --location=europe-west1 \
    --description="GIS-Fixure Individual Docker images"
```

## Adım 3: Docker Image Build & Push

```bash
# Proje dizinine gidin
cd backend/pointcloud-converter

# Image'ı build edin
docker build -t europe-west1-docker.pkg.dev/$PROJECT_ID/hekamap-images/pointcloud-converter:latest .

# Artifact Registry'ye push edin
docker push europe-west1-docker.pkg.dev/$PROJECT_ID/hekamap-images/pointcloud-converter:latest
```

## Adım 4: Cloud Run Job Oluşturma

```bash
gcloud run jobs create pointcloud-converter \
    --image=europe-west1-docker.pkg.dev/$PROJECT_ID/hekamap-images/pointcloud-converter:latest \
    --region=europe-west1 \
    --cpu=4 \
    --memory=8Gi \
    --task-timeout=3600s \
    --max-retries=2 \
    --set-env-vars="R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com" \
    --set-env-vars="R2_BUCKET_NAME=hekamap-assets" \
    --set-env-vars="SUPABASE_URL=<your-supabase-url>" \
    --set-secrets="R2_ACCESS_KEY=r2-access-key:latest" \
    --set-secrets="R2_SECRET_KEY=r2-secret-key:latest" \
    --set-secrets="SUPABASE_KEY=supabase-key:latest"
```

## Adım 5: Secret Manager'da Secret Oluşturma

```bash
# R2 Access Key
echo -n "your-r2-access-key" | gcloud secrets create r2-access-key --data-file=-

# R2 Secret Key
echo -n "your-r2-secret-key" | gcloud secrets create r2-secret-key --data-file=-

# Supabase Service Role Key
echo -n "your-supabase-service-role-key" | gcloud secrets create supabase-key --data-file=-
```

## Adım 6: Job'ı Test Etme

```bash
# Manuel olarak job'ı çalıştırın
gcloud run jobs execute pointcloud-converter \
    --region=europe-west1 \
    --args="--asset-id=test-uuid" \
    --args="--input-url=https://bucket.r2.dev/raw/test.laz" \
    --args="--output-bucket=https://bucket.r2.dev"
```

## Cloudflare Worker'dan Tetikleme

Cloudflare Worker'dan bu job'ı tetiklemek için GCP Service Account kullanmanız gerekir.

### Service Account Oluşturma

```bash
# Service account oluştur
gcloud iam service-accounts create hekamap-worker \
    --display-name="Hekamap Cloudflare Worker"

# Cloud Run Jobs çalıştırma izni ver
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:hekamap-worker@$PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/run.invoker"

# Key oluştur (Cloudflare Worker'da kullanılacak)
gcloud iam service-accounts keys create gcp-key.json \
    --iam-account=hekamap-worker@$PROJECT_ID.iam.gserviceaccount.com
```

## Maliyet Optimizasyonu

- Job sadece çalıştığında ücret alınır (cold start yok)
- 4 vCPU / 8GB RAM için yaklaşık $0.00024/saniye
- 45 dakikalık işlem: ~$0.65

## Troubleshooting

### Job başarısız olursa:
```bash
gcloud run jobs executions list --job=pointcloud-converter --region=europe-west1
gcloud run jobs executions describe <execution-id> --region=europe-west1
```

### Logları görüntülemek için:
```bash
gcloud logging read "resource.type=cloud_run_job AND resource.labels.job_name=pointcloud-converter" --limit=50
```
