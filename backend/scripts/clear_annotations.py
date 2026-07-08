import json
from pathlib import Path

def main():
    db_path = Path(__file__).resolve().parent.parent.parent.parent.parent / "Desktop" / "MetAnno" / "backend" / "data" / "local_db.json"
    if not db_path.exists():
        # Fallback to relative path if absolute path structure is different
        db_path = Path("/Users/hanna/Desktop/MetAnno/backend/data/local_db.json")
        
    if not db_path.exists():
        print(f"Error: Database file not found at {db_path}")
        return
        
    try:
        with open(db_path, "r", encoding="utf-8") as f:
            db_data = json.load(f)
            
        # Reset annotations and conversation_annotations
        db_data["annotations"] = {}
        db_data["conversation_annotations"] = {}
        
        with open(db_path, "w", encoding="utf-8") as f:
            json.dump(db_data, f, indent=2, ensure_ascii=False)
            
        print("Success: All annotations and conversation annotations have been cleared from local_db.json!")
        print("Progress is now reset to 0%. Refresh the dashboard to see the 'Start' state.")
    except Exception as e:
        print(f"Failed to clear database: {e}")

if __name__ == "__main__":
    main()
