import os
from typing import List
from ..models.schemas import DocumentItem


def safe_filename(name: str) -> str:
    return os.path.basename(name).replace("..", "_")


def save_pdf_bytes(files_dir: str, filename: str, content: bytes) -> DocumentItem:
    os.makedirs(files_dir, exist_ok=True)
    fname = safe_filename(filename)
    path = os.path.join(files_dir, fname)
    with open(path, "wb") as f:
        f.write(content)
    return DocumentItem(filename=fname, url=f"/files/{fname}")


def list_pdfs(files_dir: str) -> List[DocumentItem]:
    os.makedirs(files_dir, exist_ok=True)
    out: List[DocumentItem] = []
    for name in sorted(os.listdir(files_dir)):
        if name.lower().endswith(".pdf"):
            out.append(DocumentItem(filename=name, url=f"/files/{name}"))
    return out
