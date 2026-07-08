import json
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Try to import mdkeychunker
try:
    from mdkeychunker import Pipeline, Config
except ImportError:
    print("Error: mdkeychunker is not installed in this environment. Please run:")
    print("pip install mdkeychunker")
    sys.exit(1)

def main():
    base_dir = Path(__file__).resolve().parent
    
    # Load .env file from the data directory or current workspace root
    env_path = base_dir / ".env"
    if env_path.exists():
        print(f"Loading environment from {env_path}")
        load_dotenv(dotenv_path=env_path)
    else:
        load_dotenv()

    # Retrieve credentials
    provider = os.getenv("LLM_PROVIDER")
    api_key = os.getenv("LLM_API_KEY") or os.getenv("OPENAI_API_KEY")
    model = os.getenv("LLM_MODEL")

    if not api_key:
        print("Error: No API key found. Please set the OPENAI_API_KEY or LLM_API_KEY environment variable.")
        print("Alternatively, create a '.env' file in the 'data/' directory with:")
        print("OPENAI_API_KEY=your-api-key-here")
        sys.exit(1)

    # Set up defaults for MDKeyChunker configuration if they aren't explicitly set
    if not provider:
        os.environ["LLM_PROVIDER"] = "openai"
    if not model:
        os.environ["LLM_MODEL"] = "gpt-4o-mini"
    if api_key and not os.getenv("LLM_API_KEY"):
        os.environ["LLM_API_KEY"] = api_key

    md_path = base_dir / "METAPHORLIST.md"
    output_path = base_dir / "metaphor_chunks.json"

    if not md_path.exists():
        print(f"Error: Markdown file {md_path} not found.")
        sys.exit(1)

    print(f"Initializing MDKeyChunker pipeline (using model: {os.getenv('LLM_MODEL')})...")
    try:
        config = Config.from_env()
        pipeline = Pipeline(config)
        
        print(f"Chunking document: {md_path}...")
        chunks = pipeline.process_file(str(md_path))
        
        chunks_data = []
        for chunk in chunks:
            chunks_data.append({
                "key": getattr(chunk, "key", ""),
                "title": getattr(chunk, "title", ""),
                "summary": getattr(chunk, "summary", ""),
                "content": getattr(chunk, "content", ""),
                "keywords": getattr(chunk, "keywords", []),
                "entities": getattr(chunk, "entities", []),
                "questions": getattr(chunk, "questions", [])
            })

        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(chunks_data, f, indent=2, ensure_ascii=False)

        print(f"Successfully chunked markdown file!")
        print(f"Generated {len(chunks_data)} chunks and saved to: {output_path}")

    except Exception as e:
        print(f"An error occurred during chunking: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
