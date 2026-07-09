import json
import os
import threading
from pathlib import Path
from typing import Dict, List, Any, Optional
import bcrypt
import config

# Firebase imports inside function/class or protected block to prevent import errors if not installed
db_firestore = None
if config.DATABASE_MODE == "firebase":
    try:
        import firebase_admin
        from firebase_admin import credentials
        from firebase_admin import firestore
        
        # Initialize firebase admin if not already initialized
        if not firebase_admin._apps:
            if config.FIREBASE_CREDENTIALS_PATH:
                cred = credentials.Certificate(config.FIREBASE_CREDENTIALS_PATH)
                firebase_admin.initialize_app(cred)
            else:
                # This will use default credentials (e.g. from GOOGLE_APPLICATION_CREDENTIALS or metadata server)
                firebase_admin.initialize_app()
        db_firestore = firestore.client()
        print("Firebase Firestore initialized successfully.")
    except Exception as e:
        print(f"Error initializing Firebase Firestore: {e}. Falling back to LOCAL mode.")
        config.DATABASE_MODE = "local"


class LocalDatabase:
    """Thread-safe local JSON database for development and testing."""
    def __init__(self, filepath: Path):
        self.filepath = filepath
        self.lock = threading.Lock()
        self._ensure_db_exists()

    def _ensure_db_exists(self):
        if not self.filepath.exists():
            self._write_db(self._get_seed_data())

    def _read_db(self) -> Dict[str, Any]:
        with self.lock:
            try:
                with open(self.filepath, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                return self._get_seed_data()

    def _write_db(self, data: Dict[str, Any]):
        with self.lock:
            with open(self.filepath, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)

    def _get_seed_data(self) -> Dict[str, Any]:
        # Hash default passwords
        admin_pwd_hash = bcrypt.hashpw("password123".encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        ann1_pwd_hash = bcrypt.hashpw("password1231annotator1".encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        ann2_pwd_hash = bcrypt.hashpw("password1232annotator2".encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        ann3_pwd_hash = bcrypt.hashpw("password1233annotator3".encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        
        users = {
            "admin": {
                "id": "admin_uid",
                "email": "admin",
                "name": "admin",
                "password_hash": admin_pwd_hash,
                "role": "admin"
            },
            "annotator1": {
                "id": "annotator1_uid",
                "email": "annotator1",
                "name": "annotator1",
                "password_hash": ann1_pwd_hash,
                "role": "annotator"
            },
            "annotator2": {
                "id": "annotator2_uid",
                "email": "annotator2",
                "name": "annotator2",
                "password_hash": ann2_pwd_hash,
                "role": "annotator"
            },
            "annotator3": {
                "id": "annotator3_uid",
                "email": "annotator3",
                "name": "annotator3",
                "password_hash": ann3_pwd_hash,
                "role": "annotator"
            }
        }
        
        shared_schema = {
            "source_frames": [
                "Human Body",
                "Health and Illness",
                "Animals",
                "Machines and Tools",
                "Buildings and Construction",
                "Plants",
                "Games and Sport",
                "Cooking and Food",
                "Economic Transactions",
                "Forces",
                "Light and Darkness",
                "Heat and Cold",
                "Movement and Direction"
            ],
            "target_frames": [
                "Emotion",
                "Desire",
                "Morality",
                "Thought",
                "Society",
                "Religion",
                "Politics",
                "Economy",
                "Human Relationships",
                "Communication",
                "Events and Actions",
                "Time",
                "Life and Death"
            ],
            "conceptual_metaphors": [
                "LIFE IS A JOURNEY",
                "ARGUMENT IS WAR",
                "TIME IS MONEY",
                "THE MIND IS A CONTAINER",
                "A PROBLEM IS A LOOP",
                "CREATIVITY IS A SEED",
                "A STORY IS A BRICK WALL",
                "EMOTIONAL RAPPROCHEMENT IS BREAKING THE ICE"
            ],
            "interaction_functions": [
                "Artistic metaphor",
                "Visualization",
                "Persuasiveness",
                "Explanation",
                "Argumentative metaphor",
                "Social interaction",
                "Humour",
                "Heuristic reasoning"
            ]
        }

        projects = {
            "proj_01": {
                "id": "proj_01",
                "name": "Main Dataset",
                "description": "Main metaphor annotation workspace.",
                "dataset_id": "dataset_main",
                "annotator_ids": ["annotator1", "annotator2", "annotator3"],
                "schema": shared_schema
            },
            "proj_pilot": {
                "id": "proj_pilot",
                "name": "Pilot Dataset",
                "description": "Pilot metaphor annotation workspace.",
                "dataset_id": "dataset_pilot",
                "annotator_ids": ["annotator1", "annotator2", "annotator3"],
                "schema": shared_schema
            }
        }
        
        datasets = {
            "dataset_main": {
                "id": "dataset_main",
                "name": "Main Dataset",
                "uploaded_at": "2026-06-24T00:00:00Z",
                "uploaded_by": "admin_uid"
            },
            "dataset_pilot": {
                "id": "dataset_pilot",
                "name": "Pilot Dataset",
                "uploaded_at": "2026-07-08T00:00:00Z",
                "uploaded_by": "admin_uid"
            }
        }
        
        conversations = {}
        utterances = {}
        
        def get_csv_path(filename: str, dataset_id: str) -> Path:
            # 1. Dev path
            dev_path = Path("/Users/hanna/Desktop/MetAnno/data") / filename
            if dev_path.exists():
                return dev_path
                
            # 2. Bundled resource path (inside PyInstaller sys._MEIPASS)
            import sys
            if getattr(sys, 'frozen', False):
                # Check both root and _internal (PyInstaller 6 directory layouts)
                bundle_path = Path(sys._MEIPASS) / "data" / filename
                if bundle_path.exists():
                    return bundle_path
                bundle_path_internal = Path(sys._MEIPASS) / "_internal" / "data" / filename
                if bundle_path_internal.exists():
                    return bundle_path_internal
                    
            # 3. Relative fallback path inside package
            local_fallback = Path(__file__).resolve().parent / "data" / filename
            if local_fallback.exists():
                return local_fallback
                
            # 4. Fallback for main_anno.csv to human_anno.csv
            if filename == "main_anno.csv":
                human_fallback = Path(__file__).resolve().parent / "data" / "human_anno.csv"
                if human_fallback.exists():
                    return human_fallback
                    
            return dev_path

        def load_csv(filename: str, dataset_id: str):
            csv_path = get_csv_path(filename, dataset_id)
            if not csv_path.exists():
                return
            
            if csv_path.exists():
                import csv
                try:
                    with open(csv_path, mode="r", encoding="utf-8", newline="") as f:
                        reader = csv.DictReader(f)
                        for row in reader:
                            c_id = row["conversation_id"]
                            suffix = dataset_id.split("_")[-1]
                            conv_key = f"conv_{suffix}_{c_id}"
                            
                            if conv_key not in conversations:
                                platform_str = row.get("platform", "Unknown")
                                topic_str = row.get("topic", "")
                                topic_info = f" - {topic_str}" if topic_str else ""
                                conversations[conv_key] = {
                                    "id": conv_key,
                                    "dataset_id": dataset_id,
                                    "title": f"Conversation {c_id} ({platform_str}){topic_info}"
                                }
                                
                            u_idx_str = row["message_index"]
                            utt_key = f"utt_{suffix}_{c_id}_{u_idx_str}"
                            
                            should_ann_raw = row.get("should_annotate", "True")
                            should_ann = should_ann_raw.lower() in ("true", "1", "yes")
                            
                            utterances[utt_key] = {
                                "id": utt_key,
                                "conversation_id": conv_key,
                                "dataset_id": dataset_id,
                                "speaker": "assistant" if row["role"] == "llm" else "user",
                                "index": int(u_idx_str) if u_idx_str.isdigit() else 0,
                                "text": row["plain_text"],
                                "should_annotate": should_ann
                            }
                except Exception as e:
                    print(f"Error reading CSV {csv_path}: {e}")

        load_csv("main_anno.csv", "dataset_main")
        load_csv("pilot_anno.csv", "dataset_pilot")
        
        # Fallback if CSV load failed
        if not conversations:
            conversations = {
                "dataset_main_conv_1": {
                    "id": "dataset_main_conv_1",
                    "dataset_id": "dataset_main",
                    "title": "Fallback Dialogue"
                }
            }
            utterances = {
                "dataset_main_utt_1_1": {
                    "id": "dataset_main_utt_1_1",
                    "conversation_id": "dataset_main_conv_1",
                    "dataset_id": "dataset_main",
                    "speaker": "user",
                    "index": 0,
                    "text": "Fallback dialogue turn.",
                    "should_annotate": True
                }
            }
            
        annotations = {}
        
        return {
            "users": users,
            "projects": projects,
            "datasets": datasets,
            "conversations": conversations,
            "utterances": utterances,
            "annotations": annotations,
            "conversation_annotations": {}
        }


local_db = LocalDatabase(config.LOCAL_DB_PATH)


class DatabaseClient:
    """Database client abstracting the underlying storage (Firestore vs. Local JSON)."""

    # --- Users ---
    @staticmethod
    def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
        email = email.lower().strip()
        if config.DATABASE_MODE == "local":
            data = local_db._read_db()
            return data["users"].get(email)
        else:
            doc = db_firestore.collection("users").document(email).get()
            return doc.to_dict() if doc.exists else None

    @staticmethod
    def create_user(email: str, user_data: Dict[str, Any]) -> Dict[str, Any]:
        email = email.lower().strip()
        user_data["email"] = email
        if config.DATABASE_MODE == "local":
            data = local_db._read_db()
            data["users"][email] = user_data
            local_db._write_db(data)
        else:
            db_firestore.collection("users").document(email).set(user_data)
        return user_data

    # --- Projects ---
    @staticmethod
    def get_projects() -> List[Dict[str, Any]]:
        if config.DATABASE_MODE == "local":
            data = local_db._read_db()
            return list(data["projects"].values())
        else:
            docs = db_firestore.collection("projects").stream()
            return [doc.to_dict() for doc in docs]

    @staticmethod
    def get_project(project_id: str) -> Optional[Dict[str, Any]]:
        if config.DATABASE_MODE == "local":
            data = local_db._read_db()
            return data["projects"].get(project_id)
        else:
            doc = db_firestore.collection("projects").document(project_id).get()
            return doc.to_dict() if doc.exists else None

    @staticmethod
    def create_project(project_id: str, project_data: Dict[str, Any]) -> Dict[str, Any]:
        project_data["id"] = project_id
        if config.DATABASE_MODE == "local":
            data = local_db._read_db()
            data["projects"][project_id] = project_data
            local_db._write_db(data)
        else:
            db_firestore.collection("projects").document(project_id).set(project_data)
        return project_data

    # --- Datasets ---
    @staticmethod
    def get_datasets() -> List[Dict[str, Any]]:
        if config.DATABASE_MODE == "local":
            data = local_db._read_db()
            return list(data["datasets"].values())
        else:
            docs = db_firestore.collection("datasets").stream()
            return [doc.to_dict() for doc in docs]

    @staticmethod
    def get_dataset(dataset_id: str) -> Optional[Dict[str, Any]]:
        if config.DATABASE_MODE == "local":
            data = local_db._read_db()
            return data["datasets"].get(dataset_id)
        else:
            doc = db_firestore.collection("datasets").document(dataset_id).get()
            return doc.to_dict() if doc.exists else None

    @staticmethod
    def create_dataset(dataset_id: str, dataset_data: Dict[str, Any]) -> Dict[str, Any]:
        dataset_data["id"] = dataset_id
        if config.DATABASE_MODE == "local":
            data = local_db._read_db()
            data["datasets"][dataset_id] = dataset_data
            local_db._write_db(data)
        else:
            db_firestore.collection("datasets").document(dataset_id).set(dataset_data)
        return dataset_data

    # --- Conversations ---
    @staticmethod
    def get_conversations(dataset_id: str) -> List[Dict[str, Any]]:
        if config.DATABASE_MODE == "local":
            data = local_db._read_db()
            return [c for c in data["conversations"].values() if c["dataset_id"] == dataset_id]
        else:
            docs = db_firestore.collection("conversations").where("dataset_id", "==", dataset_id).stream()
            return [doc.to_dict() for doc in docs]

    @staticmethod
    def create_conversations(conversations_list: List[Dict[str, Any]]):
        if config.DATABASE_MODE == "local":
            data = local_db._read_db()
            for c in conversations_list:
                data["conversations"][c["id"]] = c
            local_db._write_db(data)
        else:
            # Simple batch or sequential insert
            for c in conversations_list:
                db_firestore.collection("conversations").document(c["id"]).set(c)

    # --- Utterances ---
    @staticmethod
    def get_utterances_by_dataset(dataset_id: str) -> List[Dict[str, Any]]:
        if config.DATABASE_MODE == "local":
            data = local_db._read_db()
            utts = [u for u in data["utterances"].values() if u["dataset_id"] == dataset_id]
            # Sort by conversation and then index
            utts.sort(key=lambda x: (x["conversation_id"], x["index"]))
            return utts
        else:
            docs = db_firestore.collection("utterances").where("dataset_id", "==", dataset_id).stream()
            utts = [doc.to_dict() for doc in docs]
            utts.sort(key=lambda x: (x["conversation_id"], x["index"]))
            return utts

    @staticmethod
    def get_utterance(utterance_id: str) -> Optional[Dict[str, Any]]:
        if config.DATABASE_MODE == "local":
            data = local_db._read_db()
            return data["utterances"].get(utterance_id)
        else:
            doc = db_firestore.collection("utterances").document(utterance_id).get()
            return doc.to_dict() if doc.exists else None

    @staticmethod
    def get_conversation_utterances(conversation_id: str) -> List[Dict[str, Any]]:
        if config.DATABASE_MODE == "local":
            data = local_db._read_db()
            utts = [u for u in data["utterances"].values() if u["conversation_id"] == conversation_id]
            utts.sort(key=lambda x: x["index"])
            return utts
        else:
            docs = db_firestore.collection("utterances").where("conversation_id", "==", conversation_id).stream()
            utts = [doc.to_dict() for doc in docs]
            utts.sort(key=lambda x: x["index"])
            return utts

    @staticmethod
    def create_utterances(utterances_list: List[Dict[str, Any]]):
        if config.DATABASE_MODE == "local":
            data = local_db._read_db()
            for u in utterances_list:
                data["utterances"][u["id"]] = u
            local_db._write_db(data)
        else:
            for u in utterances_list:
                db_firestore.collection("utterances").document(u["id"]).set(u)

    # --- Annotations ---
    @staticmethod
    def get_annotation(project_id: str, utterance_id: str, user_id: str) -> Optional[Dict[str, Any]]:
        ann_id = f"ann_{project_id}_{utterance_id}_{user_id.replace('@', '_').replace('.', '_')}"
        if config.DATABASE_MODE == "local":
            data = local_db._read_db()
            return data["annotations"].get(ann_id)
        else:
            doc = db_firestore.collection("annotations").document(ann_id).get()
            return doc.to_dict() if doc.exists else None

    @staticmethod
    def save_annotation(project_id: str, utterance_id: str, user_id: str, annotation_data: Dict[str, Any]) -> Dict[str, Any]:
        ann_id = f"ann_{project_id}_{utterance_id}_{user_id.replace('@', '_').replace('.', '_')}"
        annotation_data["id"] = ann_id
        annotation_data["project_id"] = project_id
        annotation_data["utterance_id"] = utterance_id
        annotation_data["user_id"] = user_id
        
        if config.DATABASE_MODE == "local":
            data = local_db._read_db()
            data["annotations"][ann_id] = annotation_data
            local_db._write_db(data)
        else:
            db_firestore.collection("annotations").document(ann_id).set(annotation_data)
        return annotation_data

    @staticmethod
    def get_annotations_for_user(project_id: str, user_id: str) -> List[Dict[str, Any]]:
        if config.DATABASE_MODE == "local":
            data = local_db._read_db()
            return [
                a for a in data["annotations"].values()
                if a["project_id"] == project_id and a["user_id"] == user_id
            ]
        else:
            docs = db_firestore.collection("annotations") \
                .where("project_id", "==", project_id) \
                .where("user_id", "==", user_id).stream()
            return [doc.to_dict() for doc in docs]

    @staticmethod
    def get_annotations_for_project(project_id: str) -> List[Dict[str, Any]]:
        if config.DATABASE_MODE == "local":
            data = local_db._read_db()
            return [a for a in data["annotations"].values() if a["project_id"] == project_id]
        else:
            docs = db_firestore.collection("annotations") \
                .where("project_id", "==", project_id).stream()
            return [doc.to_dict() for doc in docs]

    # --- Conversation Annotations ---
    @staticmethod
    def get_conversation_annotation(project_id: str, conversation_id: str, user_id: str) -> Optional[Dict[str, Any]]:
        ann_id = f"conv_ann_{project_id}_{conversation_id}_{user_id.replace('@', '_').replace('.', '_')}"
        if config.DATABASE_MODE == "local":
            data = local_db._read_db()
            conv_anns = data.setdefault("conversation_annotations", {})
            return conv_anns.get(ann_id)
        else:
            doc = db_firestore.collection("conversation_annotations").document(ann_id).get()
            return doc.to_dict() if doc.exists else None

    @staticmethod
    def save_conversation_annotation(project_id: str, conversation_id: str, user_id: str, annotation_data: Dict[str, Any]) -> Dict[str, Any]:
        ann_id = f"conv_ann_{project_id}_{conversation_id}_{user_id.replace('@', '_').replace('.', '_')}"
        annotation_data["id"] = ann_id
        annotation_data["project_id"] = project_id
        annotation_data["conversation_id"] = conversation_id
        annotation_data["user_id"] = user_id
        
        if config.DATABASE_MODE == "local":
            data = local_db._read_db()
            conv_anns = data.setdefault("conversation_annotations", {})
            conv_anns[ann_id] = annotation_data
            local_db._write_db(data)
        else:
            db_firestore.collection("conversation_annotations").document(ann_id).set(annotation_data)
        return annotation_data

    @staticmethod
    def get_conversation_annotations_for_user(project_id: str, user_id: str) -> List[Dict[str, Any]]:
        if config.DATABASE_MODE == "local":
            data = local_db._read_db()
            conv_anns = data.setdefault("conversation_annotations", {})
            return [
                a for a in conv_anns.values()
                if a.get("project_id") == project_id and a.get("user_id") == user_id
            ]
        else:
            docs = db_firestore.collection("conversation_annotations") \
                .where("project_id", "==", project_id) \
                .where("user_id", "==", user_id).stream()
            return [doc.to_dict() for doc in docs]

    @staticmethod
    def get_conversation_annotations_for_project(project_id: str) -> List[Dict[str, Any]]:
        if config.DATABASE_MODE == "local":
            data = local_db._read_db()
            conv_anns = data.setdefault("conversation_annotations", {})
            return [a for a in conv_anns.values() if a.get("project_id") == project_id]
        else:
            docs = db_firestore.collection("conversation_annotations") \
                .where("project_id", "==", project_id).stream()
            return [doc.to_dict() for doc in docs]
