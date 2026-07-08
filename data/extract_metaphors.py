import re
import json
import sys
from pathlib import Path

def extract_metaphors(input_path, output_txt_path, output_json_path):
    print(f"Reading from {input_path}...")
    if not input_path.exists():
        print(f"Error: Input file {input_path} not found.")
        sys.exit(1)

    with open(input_path, "r", encoding="utf-8") as f:
        lines = f.readlines()

    # Regex to check if the line starts with one or more hashes OR a digit
    prefix_regex = re.compile(r'^(?:#+|\d+)')
    
    # Regex to match X IS Y or X ARE Y (case-insensitive)
    metaphor_regex = re.compile(r'\b(.+?)\s+\b(is|are)\b\s+(.+)', re.IGNORECASE)

    # Category trackers
    active_chapter = "UNKNOWN"
    active_file = "UNKNOWN"

    # Regex to detect chapter headers (e.g., "## EVENT STRUCTURE pp. 1-79", "## MENTAL EVENTS", etc.)
    chapter_regex = re.compile(
        r'^##\s*(EVENT STRUCTURE|MENTAL EVENTS|EMOTIONS|OTHER|INDEX)\b', 
        re.IGNORECASE
    )
    
    # Regex to detect file markers (e.g., "See File: Attributes", "See the File For This Metaphor: EventStructLoc")
    file_regex = re.compile(
        r'\bSee\s+(?:[\w\s\-]+)?File\b(?:[\w\s\-]+)?:?\s*(\w+)', 
        re.IGNORECASE
    )

    extracted = []

    for i, line in enumerate(lines, 1):
        stripped = line.strip()
        if not stripped:
            continue

        # Check for chapter changes
        chapter_match = chapter_regex.search(stripped)
        if chapter_match:
            active_chapter = chapter_match.group(1).upper()
            continue

        # Check for file/sub-category changes
        file_match = file_regex.search(stripped)
        if file_match:
            active_file = file_match.group(1).strip()
            continue

        # Check if line starts with hashes or numbers (potential metaphors)
        if prefix_regex.match(stripped):
            # Clean leading hashes
            cleaned = re.sub(r'^#+\s*', '', stripped).strip()
            
            # Extract list number if present
            list_number = None
            list_num_match = re.match(r'^(\d+)\.?\s+', cleaned)
            if list_num_match:
                list_number = list_num_match.group(1)
                cleaned = cleaned[list_num_match.end():].strip()

            # Extract special case or sub-case labels
            special_case_label = None
            is_special_case = False
            special_case_match = re.match(r'^(Special\s+(?:sub-)?case\s+\d+):\s*', cleaned, re.IGNORECASE)
            if special_case_match:
                special_case_label = special_case_match.group(1)
                is_special_case = True
                cleaned = cleaned[special_case_match.end():].strip()

            # Check if there is still a list number after the special case label
            if not list_number:
                list_num_match2 = re.match(r'^(\d+)\.?\s+', cleaned)
                if list_num_match2:
                    list_number = list_num_match2.group(1)
                    cleaned = cleaned[list_num_match2.end():].strip()

            # Check if the remaining string has the form X IS Y or X ARE Y
            match = metaphor_regex.search(cleaned)
            if match:
                x_val = match.group(1).strip()
                verb = match.group(2).strip()
                y_val = match.group(3).strip()
                
                is_all_caps = (x_val.isupper() and y_val.isupper())

                extracted.append({
                    "line_number": i,
                    "original_line": stripped,
                    "category": active_chapter,
                    "sub_category": active_file,
                    "is_special_case": is_special_case,
                    "special_case_label": special_case_label,
                    "list_number": list_number,
                    "metaphor": f"{x_val} {verb.upper()} {y_val}",
                    "x": x_val,
                    "relation": verb.lower(),
                    "y": y_val,
                    "is_all_caps": is_all_caps
                })

    # Save to TXT report grouped by Category and Sub-category
    with open(output_txt_path, "w", encoding="utf-8") as f:
        f.write(f"Extracted {len(extracted)} Metaphors\n")
        f.write("="*80 + "\n\n")
        
        general = [item for item in extracted if not item["is_special_case"]]
        special = [item for item in extracted if item["is_special_case"]]
        
        f.write(f"--- GENERAL METAPHORS ({len(general)}) ---\n")
        current_cat, current_sub = None, None
        for item in general:
            if item["category"] != current_cat or item["sub_category"] != current_sub:
                current_cat = item["category"]
                current_sub = item["sub_category"]
                f.write(f"\n[{current_cat} / {current_sub}]\n" + "-"*40 + "\n")
                
            prefix = f"{item['list_number']}. " if item['list_number'] else "- "
            f.write(f"Line {item['line_number']}: {prefix}{item['x']} {item['relation'].upper()} {item['y']}\n")
            
        f.write("\n" + "="*80 + "\n\n")
        f.write(f"--- SPECIAL CASES AND DEVIATIONS ({len(special)}) ---\n")
        current_cat, current_sub = None, None
        for item in special:
            if item["category"] != current_cat or item["sub_category"] != current_sub:
                current_cat = item["category"]
                current_sub = item["sub_category"]
                f.write(f"\n[{current_cat} / {current_sub}]\n" + "-"*40 + "\n")
                
            prefix = f"[{item['special_case_label']}] "
            if item['list_number']:
                prefix += f"{item['list_number']}. "
            f.write(f"Line {item['line_number']}: {prefix}{item['x']} {item['relation'].upper()} {item['y']}\n")

    # Save to JSON data
    with open(output_json_path, "w", encoding="utf-8") as f:
        json.dump(extracted, f, indent=2, ensure_ascii=False)

    print(f"Extraction complete!")
    print(f"Extracted {len(extracted)} metaphors ({len(general)} general, {len(special)} special).")
    print(f"Saved text report to: {output_txt_path}")
    print(f"Saved JSON data to: {output_json_path}")

def main():
    base_dir = Path(__file__).resolve().parent
    input_file = base_dir / "METAPHORLIST.md"
    output_txt = base_dir / "extracted_metaphors.txt"
    output_json = base_dir / "extracted_metaphors.json"

    extract_metaphors(input_file, output_txt, output_json)

if __name__ == "__main__":
    main()
