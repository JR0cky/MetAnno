import sys
from pathlib import Path
from docling.document_converter import DocumentConverter

def main():
    base_dir = Path(__file__).resolve().parent.parent.parent
    pdf_path = base_dir / "data" / "METAPHORLIST.pdf"
    md_path = base_dir / "data" / "METAPHORLIST.md"

    print(f"Converting PDF: {pdf_path}")
    if not pdf_path.exists():
        print(f"Error: {pdf_path} does not exist.")
        sys.exit(1)

    converter = DocumentConverter()
    result = converter.convert(pdf_path)
    markdown_text = result.document.export_to_markdown()

    # Ensure output directory exists
    md_path.parent.mkdir(parents=True, exist_ok=True)
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(markdown_text)

    print(f"Successfully saved Markdown to: {md_path}")

if __name__ == "__main__":
    main()
