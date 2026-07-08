import sys
from pathlib import Path

# Try to import the ollama library
try:
    import ollama
except ImportError:
    print("Error: The 'ollama' library is not installed in the virtual environment.")
    print("Please install it by running:")
    print("  ./backend/.venv/bin/pip install ollama")
    sys.exit(1)

def load_file_content(base_dir, primary_name, fallback_name=None, default_input_desc=None):
    path = base_dir / primary_name
    if path.exists():
        print(f"Loading {primary_name}...")
        with open(path, "r", encoding="utf-8") as f:
            return f.read().strip()
            
    if fallback_name:
        fallback_path = base_dir / fallback_name
        if fallback_path.exists():
            print(f"Loading {fallback_name}...")
            with open(fallback_path, "r", encoding="utf-8") as f:
                return f.read().strip()

    if default_input_desc:
        print(f"\nNo '{primary_name}' or '{fallback_name}' found.")
        print(f"Enter {default_input_desc} below.")
        print("Note: To support multi-line pasting, press 'Ctrl+D' (Mac/Linux) or 'Ctrl+Z' (Windows) on a new line when finished:")
        print("-" * 60)
        try:
            user_input = sys.stdin.read().strip()
            print("-" * 60)
            return user_input
        except KeyboardInterrupt:
            print("\nAborted.")
            sys.exit(1)
            
    return ""

def main():
    # Configuration
    MODEL_NAME = "gpt-oss:20b"
    
    base_dir = Path(__file__).resolve().parent
    output_path = base_dir / "ollama_response.txt"

    # 1. Load System Prompt (from 'system_prompt' or 'system_prompt.txt')
    system_prompt = load_file_content(
        base_dir=base_dir, 
        primary_name="system_prompt", 
        fallback_name="system_prompt.txt",
        default_input_desc="system prompt"
    )

    # 2. Load User Prompt (from 'user_prompt.txt', 'user_prompt', or 'extracted_metaphors.txt')
    user_prompt = load_file_content(
        base_dir=base_dir,
        primary_name="user_prompt.txt",
        fallback_name="extracted_metaphors.txt",
        default_input_desc="user prompt"
    )

    if not user_prompt:
        print("Error: No user prompt or metaphor list content could be loaded.")
        sys.exit(1)

    # Combine system prompt and user prompt into a single prompt string
    # This is more robust for custom local models and avoids chat role misalignment
    full_prompt = ""
    if system_prompt:
        full_prompt += f"<|system|>\n{system_prompt}\n\n"
        
    full_prompt += f"<|user|>\n{user_prompt}\n\n<|assistant|>\n"

    print(f"\nSending request to local Ollama using model '{MODEL_NAME}' via 'ollama.generate'...")
    if system_prompt:
        print(f"System prompt length: {len(system_prompt)} characters.")
    print(f"User prompt length: {len(user_prompt)} characters.")
    print("Setting context window size (num_ctx) to 16,384 tokens to prevent truncation...")

    try:
        # Request generation from Ollama with increased context window
        response = ollama.generate(
            model=MODEL_NAME,
            prompt=full_prompt,
            options={
                "num_ctx": 16384,      # Large context window to fit the entire metaphor list
                "temperature": 0.2     # Deterministic generation
            }
        )
        
        # Extract the response text
        generated_text = response.get("response", "")
        
        print("\n--- Ollama Response Received ---")
        print(generated_text[:500] + "...\n[Full response saved]" if len(generated_text) > 500 else generated_text)
        
        # Save the response
        with open(output_path, "w", encoding="utf-8") as out_f:
            out_f.write(generated_text)
        print(f"\nFull response successfully saved to: {output_path}")

    except Exception as e:
        print(f"\nAn error occurred while calling Ollama: {e}")
        print("Please ensure Ollama is running locally (e.g. 'ollama serve') and that the model is loaded.")
        sys.exit(1)

if __name__ == "__main__":
    main()
