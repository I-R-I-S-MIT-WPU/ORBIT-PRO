import os
from typing import List

import fitz  # PyMuPDF

from ..models.schemas import DocumentItem


def safe_filename(name: str) -> str:
    return os.path.basename(name).replace("..", "_")


def extract_pdf_metadata(file_path: str) -> tuple[int, int]:
    """Extract page count and file size from PDF."""
    try:
        # Get file size
        size = os.path.getsize(file_path)

        # Get page count using PyMuPDF
        doc = fitz.open(file_path)
        pages = len(doc)
        doc.close()

        return pages, size
    except Exception as e:
        print(f"Error extracting PDF metadata from {file_path}: {e}")
        return 0, 0


def save_pdf_bytes(files_dir: str, filename: str, content: bytes) -> DocumentItem:
    os.makedirs(files_dir, exist_ok=True)
    fname = safe_filename(filename)
    path = os.path.join(files_dir, fname)

    # Save the file
    with open(path, "wb") as f:
        f.write(content)

    # Extract metadata
    pages, size = extract_pdf_metadata(path)

    return DocumentItem(filename=fname, url=f"/files/{fname}", pages=pages, size=size)


def list_pdfs(files_dir: str) -> List[DocumentItem]:
    os.makedirs(files_dir, exist_ok=True)
    out: List[DocumentItem] = []

    for name in sorted(os.listdir(files_dir)):
        if name.lower().endswith(".pdf"):
            file_path = os.path.join(files_dir, name)
            pages, size = extract_pdf_metadata(file_path)

            out.append(
                DocumentItem(
                    filename=name, url=f"/files/{name}", pages=pages, size=size
                )
            )

    return out
