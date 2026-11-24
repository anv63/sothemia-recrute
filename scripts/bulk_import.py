#!/usr/bin/env python3
"""
Bulk Import Script for Sothema ATS CVthèque.
Extracts, analyzes, and registers the 2,484 PDF resumes in `data/` into `resume_data.db`.
Uses multi-processing (CPU parallelization) for extraction and batched SQLite transactions.
"""
import glob
import hashlib
import json
import os
import sqlite3
import subprocess
import sys
import time
from concurrent.futures import ProcessPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from utils import document_extractor
from utils.resume_analyzer import ResumeAnalyzer
import sothema_quality as quality
from ats_store import DB_PATH


def _extract_pdf_fast(filename: str, content: bytes) -> document_extractor.ExtractionResult:
    """High-performance PDF text & layout extraction via pdftotext with fallback."""
    try:
        proc = subprocess.run(
            ["pdftotext", "-layout", "-", "-"],
            input=content,
            capture_output=True,
            timeout=15,
            check=True,
        )
        text = proc.stdout.decode("utf-8", errors="replace")
        pages = [p for p in text.split("\f") if p.strip()] or [text]
        result = document_extractor.ExtractionResult(Path(filename).name, "pdf")
        result.page_count = len(pages)
        for p_idx, page_text in enumerate(pages, 1):
            for l_idx, line in enumerate(page_text.splitlines(), 1):
                clean = document_extractor._clean_text(line)
                if clean:
                    result.source_lines.append(
                        document_extractor.SourceLine(clean, p_idx, l_idx, "pdftotext_layout")
                    )
        return document_extractor._finalize(result)
    except Exception:
        return document_extractor.extract_document(filename, content)


# Human-friendly French mappings for Kaggle resume categories
CATEGORY_MAPPING = {
    "ACCOUNTANT": ("Finance / comptabilité", "Comptable"),
    "ADVOCATE": ("Juridique", "Avocat / Conseiller juridique"),
    "AGRICULTURE": ("Agriculture / agroalimentaire", "Agronome"),
    "APPAREL": ("Mode / textile", "Styliste / Modéliste"),
    "ARTS": ("Arts / création", "Artiste / Directeur créatif"),
    "AUTOMOBILE": ("Transport / automobile", "Ingénieur automobile"),
    "AVIATION": ("Transport / aviation", "Spécialiste aéronautique"),
    "BANKING": ("Finance / banque", "Conseiller bancaire"),
    "BPO": ("Relation client / BPO", "Chargé de clientèle"),
    "BUSINESS-DEVELOPMENT": ("Commercial / vente", "Business Developer"),
    "CHEF": ("Hôtellerie / restauration", "Chef cuisinier"),
    "CONSTRUCTION": ("Ingénierie / BTP", "Conducteur de travaux"),
    "CONSULTANT": ("Conseil / stratégie", "Consultant"),
    "DESIGNER": ("Design / création", "Designer graphique / UX"),
    "DIGITAL-MEDIA": ("Marketing / médias", "Responsable médias numériques"),
    "ENGINEERING": ("Ingénierie / BTP", "Ingénieur"),
    "FINANCE": ("Finance / comptabilité", "Analyste financier"),
    "FITNESS": ("Santé / bien-être", "Coach sportif / Fitness"),
    "HEALTHCARE": ("Santé / médical", "Professionnel de santé"),
    "HR": ("Ressources humaines", "Chargé de recrutement / RH"),
    "INFORMATION-TECHNOLOGY": ("Informatique / data", "Ingénieur logiciel / Informaticien"),
    "PUBLIC-RELATIONS": ("Marketing / communication", "Relations publiques"),
    "SALES": ("Commercial / vente", "Commercial"),
    "TEACHER": ("Enseignement / formation", "Enseignant / Formateur"),
}

_worker_analyzer = None


def _init_worker():
    global _worker_analyzer
    _worker_analyzer = ResumeAnalyzer()


def _process_file(file_path_str: str) -> dict:
    """Worker task: reads PDF, extracts layout text, analyzes skills and quality."""
    fpath = Path(file_path_str)
    category_dir = fpath.parent.name
    filename = fpath.name
    cat_sector, cat_role = CATEGORY_MAPPING.get(category_dir, (category_dir, category_dir))

    try:
        with open(fpath, "rb") as f:
            file_bytes = f.read()

        file_size = len(file_bytes)
        sha256 = hashlib.sha256(file_bytes).hexdigest()

        # Extract text and layout
        extraction = _extract_pdf_fast(filename, file_bytes)
        raw_text = extraction.display_text or extraction.normalized_text or ""

        # For flat directories (e.g. data/page_001.pdf), extract target role from document header
        if category_dir == "data" or category_dir not in CATEGORY_MAPPING:
            header_lines = [l.strip() for l in raw_text.splitlines() if l.strip()]
            if len(header_lines) >= 2 and not any(ch in header_lines[1] for ch in "@+0123456789") and len(header_lines[1]) < 60:
                cat_role = header_lines[1]
            else:
                cat_role = "Candidat"
            cat_sector = "Candidatures"

        # Analyze using ResumeAnalyzer and Sothema quality engine
        analysis = quality.prepare_analysis(
            raw_text, _worker_analyzer, role_info=None, criteria_label=cat_role, extraction=extraction
        )

        meta = analysis.get("sothema", {})
        ats_score = int(analysis.get("ats_score") or 0)
        confidence = meta.get("confidence") or 0.70

        # Detected name or fallback to candidate identifier
        detected_name = (analysis.get("name") or "").strip()
        if not detected_name:
            candidate_name = f"Candidat #{fpath.stem}"
        else:
            candidate_name = detected_name

        email = (analysis.get("email") or "").strip().lower()
        phone = (analysis.get("phone") or "").strip()
        summary = (analysis.get("summary") or "").strip()
        skills = meta.get("skills") or analysis.get("skills") or []
        education = analysis.get("education") or []
        experience = analysis.get("experience") or []

        return {
            "success": True,
            "filename": filename,
            "category": category_dir,
            "sector": cat_sector,
            "target_role": cat_role,
            "sha256": sha256,
            "file_bytes": file_bytes,
            "file_size": file_size,
            "file_type": "pdf",
            "full_name": candidate_name,
            "email": email,
            "phone": phone,
            "summary": summary,
            "raw_text": raw_text,
            "analysis": analysis,
            "score": ats_score,
            "confidence": confidence,
            "skills": skills,
            "education": education,
            "experience": experience,
        }
    except Exception as exc:
        return {
            "success": False,
            "filename": filename,
            "category": category_dir,
            "error": str(exc),
        }


def _now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def get_existing_fingerprints(conn: sqlite3.Connection) -> set:
    """Fetch existing SHA256 hashes to prevent redundant insertions."""
    cursor = conn.cursor()
    cursor.execute("SELECT fingerprint FROM ats_candidates WHERE fingerprint IS NOT NULL")
    return {row[0] for row in cursor.fetchall()}


def import_cvtheque(data_dir="data", max_workers=4, batch_size=50):
    """Main bulk import coordinator."""
    print("=" * 80)
    print("SOTHEMA HR INTELLIGENCE — BULK IMPORT CVTHÈQUE")
    print("=" * 80)
    print(f"Database Path : {DB_PATH}")
    print(f"Data Dir      : {data_dir}")
    print(f"CPU Workers   : {max_workers}")
    print(f"Batch Size    : {batch_size}")
    print("-" * 80)

    # 1. Gather all PDF files (supports flat or nested subdirectories)
    pdf_files = sorted(glob.glob(os.path.join(data_dir, "**", "*.pdf"), recursive=True))
    total_files = len(pdf_files)
    print(f"Found {total_files} PDF files in {data_dir}/.")

    if not pdf_files:
        print("No PDF files found to import.")
        return

    # 2. Check existing database records
    conn = sqlite3.connect(DB_PATH, timeout=30)
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA synchronous = NORMAL")
    existing_fingerprints = get_existing_fingerprints(conn)
    print(f"Database currently holds {len(existing_fingerprints)} unique candidate fingerprints.")

    # 3. Setup batch execution
    inserted_count = 0
    duplicate_count = 0
    error_count = 0

    batch_ats = []
    batch_audit = []
    batch_legacy = []

    t_start = time.time()
    last_print_time = t_start

    def flush_batches():
        nonlocal batch_ats, batch_audit, batch_legacy
        if not batch_ats:
            return
        with conn:
            cursor = conn.cursor()
            # Insert ats_candidates
            cursor.executemany("""
                INSERT OR IGNORE INTO ats_candidates (
                    fingerprint, source_filename, original_file, file_type, file_size, full_name,
                    email, phone, summary, raw_text, structured_json, local_analysis_json,
                    score, confidence, processing, review, target_role, created_by, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ready', 'a_examiner', ?, ?, ?, ?)
            """, batch_ats)

            # Insert audit events
            cursor.executemany("""
                INSERT INTO ats_audit_log (action, candidate_id, details, created_at, actor)
                VALUES ('candidate_ingested', NULL, ?, ?, 'bulk_import')
            """, batch_audit)

            # Insert into legacy resume_data table
            cursor.executemany("""
                INSERT INTO resume_data (
                    name, email, phone, summary, target_role, target_category,
                    education, experience, skills, template, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Modern', ?)
            """, batch_legacy)

        batch_ats.clear()
        batch_audit.clear()
        batch_legacy.clear()

    print("\nStarting parallel processing...\n")
    processed_count = 0

    with ProcessPoolExecutor(max_workers=max_workers, initializer=_init_worker) as executor:
        future_map = {executor.submit(_process_file, f): f for f in pdf_files}

        for future in as_completed(future_map):
            processed_count += 1
            res = future.result()

            if not res["success"]:
                error_count += 1
                print(f"[ERROR] {res['filename']}: {res.get('error')}")
                continue

            sha = res["sha256"]
            if sha in existing_fingerprints:
                duplicate_count += 1
                continue

            existing_fingerprints.add(sha)
            now_iso = _now()
            analysis_json = json.dumps(res["analysis"], ensure_ascii=False)

            # Prepare ats_candidates tuple
            batch_ats.append((
                sha,
                res["filename"],
                sqlite3.Binary(res["file_bytes"]),
                res["file_type"],
                res["file_size"],
                res["full_name"],
                res["email"],
                res["phone"],
                res["summary"],
                res["raw_text"],
                analysis_json,
                analysis_json,
                res["score"],
                res["confidence"],
                res["target_role"],
                "bulk_import",
                now_iso,
                now_iso,
            ))

            # Prepare ats_audit_log
            audit_details = json.dumps({
                "filename": res["filename"],
                "sha256": sha,
                "score": res["score"],
                "category": res["category"],
            }, ensure_ascii=False)
            batch_audit.append((audit_details, now_iso))

            # Prepare legacy resume_data
            batch_legacy.append((
                res["full_name"],
                res["email"],
                res["phone"],
                res["summary"],
                res["target_role"],
                res["sector"],
                json.dumps(res["education"], ensure_ascii=False),
                json.dumps(res["experience"], ensure_ascii=False),
                json.dumps(res["skills"], ensure_ascii=False),
                now_iso,
            ))

            inserted_count += 1

            if len(batch_ats) >= batch_size:
                flush_batches()

            # Progress update
            curr_time = time.time()
            if curr_time - last_print_time >= 2.0 or processed_count == total_files:
                elapsed = curr_time - t_start
                rate = processed_count / elapsed if elapsed > 0 else 0
                pct = (processed_count / total_files) * 100
                eta = (total_files - processed_count) / rate if rate > 0 else 0
                print(f"[{pct:5.1f}%] {processed_count}/{total_files} | "
                      f"Inserted: {inserted_count} | Dups: {duplicate_count} | "
                      f"Errors: {error_count} | Rate: {rate:.1f} CV/s | "
                      f"Elapsed: {elapsed:.0f}s | ETA: {eta:.0f}s")
                last_print_time = curr_time

    # Final batch flush
    flush_batches()
    conn.close()

    total_time = time.time() - t_start
    print("\n" + "=" * 80)
    print("IMPORT COMPLETE")
    print("=" * 80)
    print(f"Total PDFs Scanned : {total_files}")
    print(f"Successfully Added : {inserted_count}")
    print(f"Duplicates Skipped : {duplicate_count}")
    print(f"Processing Errors  : {error_count}")
    print(f"Total Time Taken   : {total_time:.1f} seconds ({total_time/60:.2f} minutes)")
    print(f"Average Throughput : {total_files / total_time:.1f} CV/second")
    print("=" * 80)


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Bulk Import Resumes into Sothema ATS CVthèque")
    parser.add_argument("--data-dir", type=str, default="data", help="Directory containing PDF resumes (default: data)")
    parser.add_argument("--workers", type=int, default=4, help="Number of parallel worker processes (default: 4)")
    parser.add_argument("--batch-size", type=int, default=50, help="SQLite transaction batch size (default: 50)")
    args = parser.parse_args()

    import_cvtheque(data_dir=args.data_dir, max_workers=args.workers, batch_size=args.batch_size)
