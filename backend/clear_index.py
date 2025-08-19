#!/usr/bin/env python3
"""
Script to clear the document index and ensure clean state.
This should be run when setting up the project on a new system.
"""

import json
import os
import shutil
from pathlib import Path


def clear_document_index():
    """Clear the document index directory and create a clean state."""

    # Get the current directory
    current_dir = Path(__file__).parent
    index_dir = current_dir / "document_index"

    print(f"🧹 Clearing document index at: {index_dir}")
    
    if index_dir.exists():
        try:
            # Remove the entire directory
            shutil.rmtree(index_dir)
            print("✅ Document index directory removed successfully")
        except Exception as e:
            print(f"❌ Error removing document index: {e}")
            return False
    else:
        print("ℹ️ Document index directory doesn't exist")

    # Create a clean index directory
    try:
        index_dir.mkdir(exist_ok=True)

        # Create a .gitkeep file to ensure the directory is tracked but empty
        gitkeep_file = index_dir / ".gitkeep"
        gitkeep_file.touch()

        # Create a README explaining the directory
        readme_content = """# Document Index Directory

This directory contains the document index for the PDF analysis system.
It is automatically generated when documents are uploaded and indexed.

**IMPORTANT**: This directory should NOT be committed to git.
It contains system-specific data that varies between installations.

The directory will be automatically created when needed.
"""

        readme_file = index_dir / "README.md"
        with open(readme_file, "w") as f:
            f.write(readme_content)

        print("✅ Clean document index directory created")
        print("✅ Added .gitkeep and README.md files")

        return True

    except Exception as e:
        print(f"❌ Error creating clean index directory: {e}")
        return False


def check_git_status():
    """Check if document_index is properly ignored by git."""

    current_dir = Path(__file__).parent
    index_dir = current_dir / "document_index"

    print("\n🔍 Checking git status...")

    # Check if .gitignore contains document_index
    gitignore_file = current_dir.parent / ".gitignore"

    if gitignore_file.exists():
        with open(gitignore_file, "r") as f:
            content = f.read()
            if "document_index/" in content:
                print("✅ document_index/ is properly ignored in .gitignore")
            else:
                print("❌ document_index/ is NOT in .gitignore")
                print("   Please add 'document_index/' to .gitignore")
    else:
        print("❌ .gitignore file not found")

    # Check if the directory is tracked by git
    import subprocess

    try:
        result = subprocess.run(
            ["git", "status", "--porcelain", str(index_dir)],
            capture_output=True,
            text=True,
            cwd=current_dir.parent,
        )

        if result.stdout.strip():
            print("⚠️  document_index directory is tracked by git")
            print("   You may need to remove it from git tracking:")
            print("   git rm -r --cached backend/document_index/")
        else:
            print("✅ document_index directory is not tracked by git")

    except Exception as e:
        print(f"⚠️  Could not check git status: {e}")


if __name__ == "__main__":
    print("🚀 Document Index Cleanup Script")
    print("=" * 40)

    success = clear_document_index()

    if success:
        print("\n🎉 Document index cleanup completed successfully!")
        print("The system will now start with a clean state.")
        print("Upload new PDFs to rebuild the index.")
    else:
        print("\n❌ Document index cleanup failed!")
        print("Please check the error messages above.")

    check_git_status()

    print("\n📋 Next steps:")
    print("1. Upload your PDF documents")
    print("2. The system will automatically index them")
    print("3. Each system will have its own clean index")
