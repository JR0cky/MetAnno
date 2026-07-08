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

def clean_json_text(text):
    """
    Cleans markdown formatting and retrieves a valid JSON string.
    """
    # Remove markdown code block symbols if present
    match = re.search(r'```(?:json)?\s*(\{.*\})\s*```', text, re.DOTALL | re.IGNORECASE)
    if match:
        return match.group(1).strip()
        
    start = text.find('{')
    end = text.rfind('}')
    if start != -1 and end != -1 and end >= start:
        return text[start:end+1].strip()
        
    return text.strip()

def query_ollama_for_taxonomy(model_name, concept_type, concepts_list):
    """
    Queries Ollama to group a list of concepts into at most 10 high-level categories.
    """
    concepts_str = "\n".join([f"- {c}" for c in concepts_list])
    
    prompt = f"""You are a cognitive linguist specializing in Conceptual Metaphor Theory. Below is a list of unique {concept_type} concepts extracted from the Master Metaphor List. 

Your task is to:
1. Define a set of at most 10 high-level, mutually exclusive semantic categories (macro-domains) that can encompass all these concepts.
2. Map each {concept_type} concept from the list to exactly one of these high-level categories.

Return your response ONLY as a valid JSON object matching the following structure:
{{
  "categories": [
    {{
      "name": "CATEGORY_NAME",
      "description": "Brief description of what this category encompasses."
    }}
  ],
  "mappings": {{
    "Concept Name 1": "CATEGORY_NAME",
    "Concept Name 2": "CATEGORY_NAME"
  }}
}}

Do not include any conversational text, markdown formatting blocks (other than the JSON itself), or explanations outside of the JSON.

Here is the list of unique {concept_type} concepts:
{concepts_str}
"""

    print(f"Prompting {model_name} to categorize {len(concepts_list)} {concept_type}s into <= 10 categories...")
    
    try:
        response = ollama.generate(
            model=model_name,
            prompt=prompt,
            options={{
                "temperature": 0.1,  # low temperature for stable structure
                "num_ctx": 8192
            }}
        )
        response_text = response.get("response", "")
        cleaned_json = clean_json_text(response_text)
        return json.loads(cleaned_json)
    except Exception as e:
        print(f"Error querying/parsing Ollama response: {e}")
        # Print snippet of response for debugging if parsing failed
        if 'response_text' in locals():
            print("Model output was:")
            print(response_text[:500] + "...")
        return None

def write_report(report_path, target_data, source_data):
    """
    Generates a human-readable text report of the high-level semantic categories.
    """
    with open(report_path, "w", encoding="utf-8") as f:
        f.write("MASTER METAPHOR LIST - HIGH-LEVEL SEMANTIC CATEGORIES REPORT (Max 10)\n")
        f.write("="*80 + "\n\n")

        # 1. Target Categories
        f.write("PART 1: TARGET SEMANTIC CATEGORIES (Abstract Concepts)\n")
        f.write("-" * 80 + "\n")
        if target_data:
            categories = target_data.get("categories", [])
            mappings = target_data.get("mappings", {})
            
            # Group concepts by category for reporting
            grouped = {}
            for concept, cat_name in mappings.items():
                grouped.setdefault(cat_name, []).append(concept)
                
            for i, cat in enumerate(categories, 1):
                name = cat.get("name")
                desc = cat.get("description", "No description provided.")
                items = grouped.get(name, [])
                f.write(f"{i}. Category: {name}\n")
                f.write(f"   Description: {desc}\n")
                f.write(f"   Items ({len(items)}): {', '.join(sorted(items))}\n\n")
        else:
            f.write("Failed to generate target categories.\n")
            
        f.write("\n" + "="*80 + "\n\n")

        # 2. Source Categories
        f.write("PART 2: SOURCE SEMANTIC CATEGORIES (Concrete / Physical Schemas)\n")
        f.write("-" * 80 + "\n")
        if source_data:
            categories = source_data.get("categories", [])
            mappings = source_data.get("mappings", {})
            
            # Group concepts by category for reporting
            grouped = {}
            for concept, cat_name in mappings.items():
                grouped.setdefault(cat_name, []).append(concept)
                
            for i, cat in enumerate(categories, 1):
                name = cat.get("name")
                desc = cat.get("description", "No description provided.")
                items = grouped.get(name, [])
                f.write(f"{i}. Category: {name}\n")
                f.write(f"   Description: {desc}\n")
                f.write(f"   Items ({len(items)}): {', '.join(sorted(items))}\n\n")
        else:
            f.write("Failed to generate source categories.\n")

def main():
    MODEL_NAME = "gpt-oss-20b"
    
    base_dir = Path(__file__).resolve().parent
    json_path = base_dir / "extracted_metaphors.json"
    
    target_out_path = base_dir / "target_categories.json"
    source_out_path = base_dir / "source_categories.json"
    report_path = base_dir / "semantic_categories_report.txt"

    if not json_path.exists():
        print(f"Error: {json_path} not found. Please run extract_metaphors.py first.")
        sys.exit(1)

    # 1. Read unique concepts
    with open(json_path, "r", encoding="utf-8") as f:
        metaphors = json.load(f)

    targets = set()
    sources = set()
    for item in metaphors:
        x_val = item.get("x", "").strip().title()
        y_val = item.get("y", "").strip().title()
        if x_val:
            targets.add(x_val)
        if y_val:
            sources.add(y_val)

    unique_targets = sorted(list(targets))
    unique_sources = sorted(list(sources))

    # 2. Query Ollama for Targets
    target_taxonomy = query_ollama_for_taxonomy(MODEL_NAME, "target", unique_targets)
    if target_taxonomy:
        with open(target_out_path, "w", encoding="utf-8") as f:
            json.dump(target_taxonomy, f, indent=2, ensure_ascii=False)
        print(f"Saved target categories and mappings to: {target_out_path}")

    # 3. Query Ollama for Sources
    source_taxonomy = query_ollama_for_taxonomy(MODEL_NAME, "source", unique_sources)
    if source_taxonomy:
        with open(source_out_path, "w", encoding="utf-8") as f:
            json.dump(source_taxonomy, f, indent=2, ensure_ascii=False)
        print(f"Saved source categories and mappings to: {source_out_path}")

    # 4. Generate human-readable report
    write_report(report_path, target_taxonomy, source_taxonomy)
    print(f"Generated semantic categories summary report at: {report_path}")

if __name__ == "__main__":
    main()
