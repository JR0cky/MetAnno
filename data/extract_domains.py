import json
from pathlib import Path

def main():
    base_dir = Path(__file__).resolve().parent
    json_path = base_dir / "extracted_metaphors.json"
    targets_path = base_dir / "targets.txt"
    sources_path = base_dir / "sources.txt"
    grouped_path = base_dir / "domains_by_category.txt"

    if not json_path.exists():
        print(f"Error: {json_path} not found.")
        print("Please run extract_metaphors.py first.")
        return

    print(f"Reading from {json_path}...")
    with open(json_path, "r", encoding="utf-8") as f:
        metaphors = json.load(f)

    targets = set()
    sources = set()
    
    # Dict to group by category (e.g. EVENT STRUCTURE, MENTAL EVENTS)
    by_category = {}

    for item in metaphors:
        cat = item.get("category", "UNKNOWN")
        x_val = item.get("x", "").strip().title()
        y_val = item.get("y", "").strip().title()
        
        # Add to flat sets
        if x_val:
            targets.add(x_val)
        if y_val:
            sources.add(y_val)
            
        # Group by MML chapter category
        cat_data = by_category.setdefault(cat, {"targets": set(), "sources": set()})
        if x_val:
            cat_data["targets"].add(x_val)
        if y_val:
            cat_data["sources"].add(y_val)

    # Sort flat lists alphabetically
    sorted_targets = sorted(list(targets))
    sorted_sources = sorted(list(sources))

    # 1. Write flat target domains
    with open(targets_path, "w", encoding="utf-8") as f:
        for t in sorted_targets:
            f.write(f"{t}\n")

    # 2. Write flat source domains
    with open(sources_path, "w", encoding="utf-8") as f:
        for s in sorted_sources:
            f.write(f"{s}\n")

    # 3. Write grouped domains report
    with open(grouped_path, "w", encoding="utf-8") as f:
        f.write("DOMAINS GROUPED BY ORIGINAL MASTER METAPHOR LIST CHAPTERS\n")
        f.write("="*80 + "\n\n")
        
        for cat, data in sorted(by_category.items()):
            f.write(f"CHAPTER: {cat}\n")
            f.write("-" * (len(cat) + 9) + "\n")
            
            f.write(f"  TARGET DOMAINS ({len(data['targets'])} unique abstract concepts):\n")
            for t in sorted(list(data["targets"])):
                f.write(f"    - {t}\n")
                
            f.write(f"\n  SOURCE DOMAINS ({len(data['sources'])} unique concrete domains):\n")
            for s in sorted(list(data["sources"])):
                f.write(f"    - {s}\n")
            f.write("\n" + "="*80 + "\n\n")

    print(f"Successfully extracted domains:")
    print(f"- Saved flat target list ({len(sorted_targets)} unique) to: {targets_path}")
    print(f"- Saved flat source list ({len(sorted_sources)} unique) to: {sources_path}")
    print(f"- Saved grouped chapter categories report to: {grouped_path}")

if __name__ == "__main__":
    main()
