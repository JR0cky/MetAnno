import json
import re
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

def extract_json_array(text):
    """
    Extracts the first valid JSON array found in the text.
    Handles Markdown code blocks and leading/trailing conversational text.
    """
    # Look for a JSON array block [...]
    match = re.search(r'(\[\s*\{.*\}\s*\])', text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass
            
    # Fallback to direct array slicing if regex failed
    start = text.find('[')
    end = text.rfind(']')
    if start != -1 and end != -1 and end > start:
        try:
            return json.loads(text[start:end+1])
        except json.JSONDecodeError:
            pass
            
    return None

def main():
    MODEL_NAME = "gpt-oss:20b"
    BATCH_SIZE = 30  # Adjust based on speed and performance
    
    base_dir = Path(__file__).resolve().parent
    system_prompt_path = base_dir / "system_prompt"
    user_prompt_path = base_dir / "user_prompt.txt"
    metaphors_json_path = base_dir / "extracted_metaphors.json"
    
    output_json_path = base_dir / "mapped_metaphors.json"
    progress_file_path = base_dir / "batch_progress.json"

    # 1. Load System Prompt
    system_prompt = ""
    if system_prompt_path.exists():
        with open(system_prompt_path, "r", encoding="utf-8") as f:
            system_prompt = f.read().strip()
    else:
        # Check system_prompt.txt
        sys_txt = base_dir / "system_prompt.txt"
        if sys_txt.exists():
            with open(sys_txt, "r", encoding="utf-8") as f:
                system_prompt = f.read().strip()

    # 2. Extract User Prompt Template Header
    # We read from user_prompt.txt but only keep the instructions & examples (lines before the actual list starts)
    user_header = ""
    if user_prompt_path.exists():
        with open(user_prompt_path, "r", encoding="utf-8") as f:
            lines = f.readlines()
        
        header_lines = []
        for line in lines:
            if "Extracted 713 Metaphors" in line or "--- GENERAL METAPHORS" in line:
                break
            header_lines.append(line)
        user_header = "".join(header_lines).strip()
    else:
        print("Error: user_prompt.txt is required to extract the instructions and examples.")
        sys.exit(1)

    # 3. Load Metaphors list from JSON
    if not metaphors_json_path.exists():
        print(f"Error: {metaphors_json_path} not found. Please run extract_metaphors.py first.")
        sys.exit(1)
        
    with open(metaphors_json_path, "r", encoding="utf-8") as f:
        all_metaphors = json.load(f)

    total_metaphors = len(all_metaphors)
    print(f"Total metaphors to process: {total_metaphors}")
    print(f"Batch size: {BATCH_SIZE} (approx. { (total_metaphors + BATCH_SIZE - 1) // BATCH_SIZE } batches)")

    # 4. Load existing progress if resuming
    processed_results = []
    start_index = 0
    if progress_file_path.exists():
        try:
            with open(progress_file_path, "r", encoding="utf-8") as f:
                progress_data = json.load(f)
                processed_results = progress_data.get("results", [])
                start_index = progress_data.get("next_index", 0)
                print(f"Resuming progress: Already processed {start_index}/{total_metaphors} metaphors.")
        except Exception as e:
            print(f"Warning: Failed to load progress file: {e}. Starting from scratch.")

    # 5. Process in batches
    for index in range(start_index, total_metaphors, BATCH_SIZE):
        batch = all_metaphors[index:index + BATCH_SIZE]
        batch_num = (index // BATCH_SIZE) + 1
        total_batches = (total_metaphors + BATCH_SIZE - 1) // BATCH_SIZE
        
        print(f"\n==========================================")
        print(f"Processing Batch {batch_num}/{total_batches} (Metaphors {index+1} to {min(index+BATCH_SIZE, total_metaphors)})")
        print(f"==========================================")

        # Format metaphors list for this batch
        metaphors_block = ""
        for item in batch:
            prefix = f"Line {item['line_number']}: "
            if item.get('is_special_case'):
                prefix += f"[{item.get('special_case_label')}] "
            elif item.get('list_number'):
                prefix += f"{item.get('list_number')}. "
            else:
                prefix += "- "
            
            metaphors_block += f"{prefix}{item['x']} {item['relation'].upper()} {item['y']}\n"

        # Combine instructions + specific metaphors for this batch
        prompt = f"{user_header}\n\nAnnotate the following {len(batch)} metaphors:\n\n{metaphors_block.strip()}\n\nOutput a valid JSON array containing exactly {len(batch)} elements."

        # Setup prompt roles
        full_prompt = ""
        if system_prompt:
            full_prompt += f"<|system|>\n{system_prompt}\n\n"
        full_prompt += f"<|user|>\n{prompt}\n\n<|assistant|>\n"

        # Query model
        try:
            response = ollama.generate(
                model=MODEL_NAME,
                prompt=full_prompt,
                options={
                    "num_ctx": 8192,
                    "temperature": 0.1
                }
            )
            
            response_text = response.get("response", "")
            batch_results = extract_json_array(response_text)
            
            if batch_results and isinstance(batch_results, list):
                print(f"Success! Extracted {len(batch_results)} annotated metaphors from batch response.")
                processed_results.extend(batch_results)
            else:
                print("Warning: Could not parse output JSON array for this batch. Model response:")
                print("-" * 50)
                print(response_text[:300] + "...")
                print("-" * 50)
                # Keep original metaphors but blank values as placeholder so mapping order is not lost
                for item in batch:
                    processed_results.append({
                        "metaphor": f"{item['x']} {item['relation'].upper()} {item['y']}",
                        "source_domain": "",
                        "target_domain": "",
                        "confidence": 0.0,
                        "reasoning": "Failed to parse from LLM response"
                    })
            
            # Save incremental progress
            with open(progress_file_path, "w", encoding="utf-8") as f:
                json.dump({
                    "next_index": index + len(batch),
                    "results": processed_results
                }, f, indent=2, ensure_ascii=False)

        except Exception as e:
            print(f"Error calling Ollama on batch {batch_num}: {e}")
            print("Stopping. You can run the script again to resume from this batch.")
            break

    # 6. Save final compiled results
    if len(processed_results) > 0:
        with open(output_json_path, "w", encoding="utf-8") as f:
            json.dump(processed_results, f, indent=2, ensure_ascii=False)
        print(f"\nProcessing complete!")
        print(f"Saved total {len(processed_results)} annotated metaphors to: {output_json_path}")
        
        # Clean up progress file
        if progress_file_path.exists():
            progress_file_path.unlink()
            
if __name__ == "__main__":
    main()
