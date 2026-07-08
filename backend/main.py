import uuid
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr

from backend import config
from backend.auth import (
    verify_password,
    get_password_hash,
    create_access_token,
    get_current_user,
    get_admin_user,
)
from backend.db import DatabaseClient

app = FastAPI(
    title="Metaphor Annotation Tool API",
    description="Backend services for manual metaphor annotation workflows.",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Pydantic Models ---

class LoginRequest(BaseModel):
    email: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: Dict[str, Any]

class MetaphorSpan(BaseModel):
    start: int
    end: int
    text: str
    # Classification fields (optional in identification stage, required in classification)
    source_frame: Optional[str] = ""
    target_frame: Optional[str] = ""
    conceptual_metaphor: Optional[str] = ""
    interaction_function: Optional[str] = ""
    confidence: Optional[int] = None
    comment: Optional[str] = ""
    lexicalized: Optional[bool] = None
    intentions: Optional[List[str]] = []

class IdentificationSaveRequest(BaseModel):
    project_id: str
    utterance_id: str
    metaphors: List[MetaphorSpan]
    identification_completed: bool
    metaphor_present: Optional[bool] = None

class ClassificationSaveRequest(BaseModel):
    project_id: str
    utterance_id: str
    metaphors: List[MetaphorSpan]
    classification_completed: bool
    metaphor_present: Optional[bool] = None

class ConversationAnnotationSaveRequest(BaseModel):
    project_id: str
    conversation_id: str
    source_domain: Optional[str] = ""
    target_domain: Optional[str] = ""
    conceptual_metaphor: Optional[str] = ""
    comment: Optional[str] = ""
    completed: bool = False

class ProjectCreateSchema(BaseModel):
    source_frames: List[str]
    target_frames: List[str]
    conceptual_metaphors: List[str]
    interaction_functions: List[str]

class ProjectCreateRequest(BaseModel):
    id: str
    name: str
    description: str
    dataset_id: str
    annotator_ids: List[str]
    schema_config: ProjectCreateSchema


# --- API Routes ---



@app.get("/api/health")
def health_check():
    return {"status": "healthy", "database_mode": config.DATABASE_MODE}


# --- Authentication ---

@app.post("/api/auth/login", response_model=TokenResponse)
def login(request: LoginRequest):
    user = DatabaseClient.get_user_by_email(request.email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    
    # In local/test mode, verify password. If password field not set (e.g. SSO synced), default to allow password123
    pwd_hash = user.get("password_hash")
    if not pwd_hash:
        # User exists but no password hash, create default one
        pwd_hash = get_password_hash("password123")
        user["password_hash"] = pwd_hash
        DatabaseClient.create_user(request.email, user)

    if not verify_password(request.password, pwd_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    access_token = create_access_token(data={"sub": user["email"]})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "role": user["role"]
        }
    }


@app.get("/api/auth/me")
def get_me(current_user: Dict[str, Any] = Depends(get_current_user)):
    return {
        "id": current_user["id"],
        "email": current_user["email"],
        "name": current_user["name"],
        "role": current_user["role"]
    }


# --- Projects ---

@app.get("/api/projects")
def get_projects(current_user: Dict[str, Any] = Depends(get_current_user)):
    projects = DatabaseClient.get_projects()
    
    # If annotator, filter to only projects they are assigned to
    if current_user.get("role") == "annotator":
        email = current_user["email"]
        projects = [p for p in projects if email in p.get("annotator_ids", [])]
        
    return projects


@app.get("/api/projects/{project_id}/schema")
def get_project_schema(project_id: str, current_user: Dict[str, Any] = Depends(get_current_user)):
    project = DatabaseClient.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    # Check authorization (annotator must be assigned)
    if current_user.get("role") == "annotator" and current_user["email"] not in project.get("annotator_ids", []):
        raise HTTPException(status_code=403, detail="Not authorized for this project")
        
    return project.get("schema", {})


# --- Datasets ---

@app.get("/api/datasets")
def get_datasets(current_user: Dict[str, Any] = Depends(get_current_user)):
    # Regular annotators don't strictly need this, but admins do. We allow it for all authenticated users
    return DatabaseClient.get_datasets()


# --- Utterances & Annotations ---

@app.get("/api/utterances")
def get_utterances(
    project_id: str = Query(..., description="Project ID filter"),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    project = DatabaseClient.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    if current_user.get("role") == "annotator" and current_user["email"] not in project.get("annotator_ids", []):
        raise HTTPException(status_code=403, detail="Not authorized for this project")
        
    dataset_id = project["dataset_id"]
    utterances = DatabaseClient.get_utterances_by_dataset(dataset_id)
    annotations = DatabaseClient.get_annotations_for_user(project_id, current_user["email"])
    
    ann_map = {a["utterance_id"]: a for a in annotations}
    
    # Construct response with annotation states
    result = []
    for u in utterances:
        ann = ann_map.get(u["id"])
        
        # Determine last modified
        last_modified = None
        if ann and "last_modified" in ann:
            last_modified = ann["last_modified"]
            
        result.append({
            "id": u["id"],
            "conversation_id": u["conversation_id"],
            "speaker": u["speaker"],
            "index": u["index"],
            "text": u["text"],
            "spans_count": len(ann.get("metaphors", [])) if ann else 0,
            "identification_completed": ann.get("identification_completed", False) if ann else False,
            "classification_completed": (
                ann.get("classification_completed", False) 
                if ann and ann.get("metaphor_present") is not None 
                else False
            ),
            "should_annotate": u.get("should_annotate", True),
            "last_modified": last_modified
        })
        
    return result


@app.get("/api/utterances/{utterance_id}")
def get_utterance_detail(
    utterance_id: str,
    project_id: str = Query(..., description="Project ID"),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    project = DatabaseClient.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    if current_user.get("role") == "annotator" and current_user["email"] not in project.get("annotator_ids", []):
        raise HTTPException(status_code=403, detail="Not authorized for this project")
        
    utterance = DatabaseClient.get_utterance(utterance_id)
    if not utterance:
        raise HTTPException(status_code=404, detail="Utterance not found")
        
    # Get other utterances in the same conversation for context
    conversation_id = utterance["conversation_id"]
    context_utterances = DatabaseClient.get_conversation_utterances(conversation_id)
    
    # Retrieve current user's annotation for this utterance
    annotation = DatabaseClient.get_annotation(project_id, utterance_id, current_user["email"])
    
    # If no annotation document exists, send a default structure
    if not annotation:
        annotation = {
            "project_id": project_id,
            "utterance_id": utterance_id,
            "user_id": current_user["email"],
            "identification_completed": False,
            "classification_completed": False,
            "metaphor_present": None,
            "metaphors": []
        }
    else:
        # Smart fallback for legacy annotations missing the metaphor_present field
        if "metaphor_present" not in annotation or annotation["metaphor_present"] is None:
            metaphors = annotation.get("metaphors", [])
            if len(metaphors) > 0:
                annotation["metaphor_present"] = True
            elif annotation.get("identification_completed", False):
                annotation["metaphor_present"] = False
            else:
                annotation["metaphor_present"] = None
                
        if annotation.get("metaphor_present") is None:
            annotation["classification_completed"] = False
        
    return {
        "utterance": utterance,
        "context": context_utterances,
        "annotation": annotation
    }


@app.post("/api/identification")
def save_identification(
    request: IdentificationSaveRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    project = DatabaseClient.get_project(request.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    if current_user.get("role") == "annotator" and current_user["email"] not in project.get("annotator_ids", []):
        raise HTTPException(status_code=403, detail="Not authorized for this project")
        
    # Load existing annotation if exists to merge classification data for unchanged spans
    existing = DatabaseClient.get_annotation(request.project_id, request.utterance_id, current_user["email"])
    existing_metaphors = existing.get("metaphors", []) if existing else []
    
    # Map start/end to existing classifications for easy lookup
    class_map = {}
    for m in existing_metaphors:
        key = (m.get("start"), m.get("end"))
        class_map[key] = m
        
    merged_metaphors = []
    for m in request.metaphors:
        key = (m.start, m.end)
        if key in class_map:
            # Preserve old classifications
            existing_m = class_map[key]
            merged_metaphors.append({
                "start": m.start,
                "end": m.end,
                "text": m.text,
                "source_frame": existing_m.get("source_frame", ""),
                "target_frame": existing_m.get("target_frame", ""),
                "conceptual_metaphor": existing_m.get("conceptual_metaphor", ""),
                "interaction_function": existing_m.get("interaction_function", ""),
                "confidence": existing_m.get("confidence"),
                "comment": existing_m.get("comment", ""),
                "lexicalized": existing_m.get("lexicalized"),
                "intentions": existing_m.get("intentions", [])
            })
        else:
            # It's a new span, add with defaults
            merged_metaphors.append({
                "start": m.start,
                "end": m.end,
                "text": m.text,
                "source_frame": m.source_frame or "",
                "target_frame": m.target_frame or "",
                "conceptual_metaphor": m.conceptual_metaphor or "",
                "interaction_function": m.interaction_function or "",
                "confidence": m.confidence,
                "comment": m.comment or "",
                "lexicalized": m.lexicalized,
                "intentions": m.intentions if m.intentions is not None else []
            })
            
    # Determine classification completion dynamically
    if request.metaphor_present is False:
        class_completed = True
    elif request.metaphor_present is None:
        class_completed = False
    else:
        # metaphor_present is True. Classification is complete only if all spans are completed.
        if not merged_metaphors:
            class_completed = False
        else:
            class_completed = True
            for m in merged_metaphors:
                # Every span must have confidence and a selected avoidability
                if (
                    m.get("confidence") is None or 
                    m.get("lexicalized") is None
                ):
                    class_completed = False
                    break
                # If avoidable (lexicalized is False), it must have intentions
                if m.get("lexicalized") is False and not m.get("intentions"):
                    class_completed = False
                    break
        
    annotation_doc = {
        "project_id": request.project_id,
        "utterance_id": request.utterance_id,
        "user_id": current_user["email"],
        "identification_completed": request.identification_completed,
        "classification_completed": class_completed,
        "metaphor_present": request.metaphor_present,
        "metaphors": merged_metaphors if request.metaphor_present is not False else [],
        "last_modified": datetime.utcnow().isoformat() + "Z"
    }
    
    DatabaseClient.save_annotation(
        request.project_id, request.utterance_id, current_user["email"], annotation_doc
    )
    
    return {"status": "success", "annotation": annotation_doc}


@app.post("/api/classification")
def save_classification(
    request: ClassificationSaveRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    project = DatabaseClient.get_project(request.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    if current_user.get("role") == "annotator" and current_user["email"] not in project.get("annotator_ids", []):
        raise HTTPException(status_code=403, detail="Not authorized for this project")
        
    # Load existing to see if we have one (which we should, from the identification phase)
    existing = DatabaseClient.get_annotation(request.project_id, request.utterance_id, current_user["email"])
    
    # Save classification fields
    annotation_doc = {
        "project_id": request.project_id,
        "utterance_id": request.utterance_id,
        "user_id": current_user["email"],
        "identification_completed": existing.get("identification_completed", True) if existing else True,
        "classification_completed": request.classification_completed,
        "metaphor_present": request.metaphor_present if request.metaphor_present is not None else (existing.get("metaphor_present") if existing else True),
        "metaphors": [m.dict() for m in request.metaphors],
        "last_modified": datetime.utcnow().isoformat() + "Z"
    }
    
    DatabaseClient.save_annotation(
        request.project_id, request.utterance_id, current_user["email"], annotation_doc
    )
    
    return {"status": "success", "annotation": annotation_doc}


@app.get("/api/conversations/{conversation_id}/detail")
def get_conversation_detail(
    conversation_id: str,
    project_id: str = Query(..., description="Project ID"),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    project = DatabaseClient.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    if current_user.get("role") == "annotator" and current_user["email"] not in project.get("annotator_ids", []):
        raise HTTPException(status_code=403, detail="Not authorized for this project")
        
    utterances = DatabaseClient.get_conversation_utterances(conversation_id)
    # Sort utterances by index
    utterances.sort(key=lambda u: u.get("index", 0))
    
    annotations = []
    for u in utterances:
        ann = DatabaseClient.get_annotation(project_id, u["id"], current_user["email"])
        if ann:
            annotations.append(ann)
            
    return {
        "utterances": utterances,
        "annotations": annotations
    }


@app.get("/api/conversations/{conversation_id}/annotation")
def get_conversation_annotation(
    conversation_id: str,
    project_id: str = Query(..., description="Project ID"),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    project = DatabaseClient.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    if current_user.get("role") == "annotator" and current_user["email"] not in project.get("annotator_ids", []):
        raise HTTPException(status_code=403, detail="Not authorized for this project")
        
    annotation = DatabaseClient.get_conversation_annotation(project_id, conversation_id, current_user["email"])
    if not annotation:
        annotation = {
            "project_id": project_id,
            "conversation_id": conversation_id,
            "user_id": current_user["email"],
            "source_domain": "",
            "target_domain": "",
            "conceptual_metaphor": "",
            "comment": "",
            "completed": False
        }
    return annotation


@app.post("/api/conversations/annotation")
def save_conversation_annotation(
    request: ConversationAnnotationSaveRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    project = DatabaseClient.get_project(request.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    if current_user.get("role") == "annotator" and current_user["email"] not in project.get("annotator_ids", []):
        raise HTTPException(status_code=403, detail="Not authorized for this project")
        
    import datetime
    annotation_data = {
        "source_domain": request.source_domain,
        "target_domain": request.target_domain,
        "conceptual_metaphor": request.conceptual_metaphor,
        "comment": request.comment,
        "completed": request.completed,
        "last_modified": datetime.datetime.utcnow().isoformat() + "Z"
    }
    
    saved_doc = DatabaseClient.save_conversation_annotation(
        request.project_id,
        request.conversation_id,
        current_user["email"],
        annotation_data
    )
    return {"status": "success", "annotation": saved_doc}


# --- Progress tracking ---

@app.get("/api/progress")
def get_progress(
    project_id: str = Query(..., description="Project ID"),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    project = DatabaseClient.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    # Access check: annotator must be assigned
    if current_user.get("role") == "annotator" and current_user["email"] not in project.get("annotator_ids", []):
        raise HTTPException(status_code=403, detail="Not authorized for this project")
        
    dataset_id = project["dataset_id"]
    utterances = DatabaseClient.get_utterances_by_dataset(dataset_id)
    
    # Group utterances by conversation_id
    conv_to_utts = {}
    for u in utterances:
        c_id = u["conversation_id"]
        if c_id not in conv_to_utts:
            conv_to_utts[c_id] = []
        conv_to_utts[c_id].append(u)
        
    total_conversations = len(conv_to_utts)
    if total_conversations == 0:
        return {
            "identification_progress": 0.0,
            "classification_progress": 0.0,
            "completed_count": 0,
            "remaining_count": 0
        }
        
    # Get user's annotations
    annotations = DatabaseClient.get_annotations_for_user(project_id, current_user["email"])
    ann_map = {a["utterance_id"]: a for a in annotations}
    
    # Get conversation-level annotations
    conv_annotations = DatabaseClient.get_conversation_annotations_for_user(project_id, current_user["email"])
    conv_ann_map = {a["conversation_id"]: a for a in conv_annotations}
    
    annotatable_utterances = [u for u in utterances if u.get("should_annotate", True)]
    total_turns = len(annotatable_utterances)
    identified_turns = 0
    total_metaphor_turns = 0
    classified_metaphor_turns = 0
    
    for u in annotatable_utterances:
        ann = ann_map.get(u["id"], {})
        if ann.get("identification_completed", False):
            identified_turns += 1
        
        # Check if a metaphor is marked present
        if ann.get("metaphor_present") is True:
            total_metaphor_turns += 1
            if ann.get("classification_completed", False):
                classified_metaphor_turns += 1

    id_completed_convs = 0
    class_completed_convs = 0
    
    for c_id, utts in conv_to_utts.items():
        annotatable_utts = [u for u in utts if u.get("should_annotate", True)]
        if not annotatable_utts:
            id_completed_convs += 1
            class_completed_convs += 1
            continue
            
        if all(ann_map.get(u["id"], {}).get("identification_completed", False) for u in annotatable_utts):
            id_completed_convs += 1
            
        # A conversation is complete only if all turns are classified AND the conversation metadata is annotated
        conv_ann = conv_ann_map.get(c_id)
        if all(
            ann_map.get(u["id"], {}).get("classification_completed", False)
            for u in annotatable_utts
        ) and conv_ann and conv_ann.get("completed", False):
            class_completed_convs += 1
            
    completed_count = class_completed_convs
    remaining_count = total_conversations - completed_count
    
    identification_progress = (identified_turns / total_turns) if total_turns > 0 else 0.0
    
    if total_metaphor_turns > 0:
        classification_progress = classified_metaphor_turns / total_metaphor_turns
    else:
        classification_progress = 1.0 if (identification_progress == 1.0) else 0.0
        
    conversations_progress = (class_completed_convs / total_conversations) if total_conversations > 0 else 0.0
    
    return {
        "identification_progress": identification_progress,
        "classification_progress": classification_progress,
        "conversations_progress": conversations_progress,
        "completed_count": completed_count,
        "total_conversations": total_conversations,
        "remaining_count": remaining_count
    }


# --- Administration endpoints ---

@app.post("/api/admin/projects")
def create_project(
    request: ProjectCreateRequest,
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    # Verify dataset exists
    dataset = DatabaseClient.get_dataset(request.dataset_id)
    if not dataset:
        raise HTTPException(status_code=400, detail="Dataset does not exist")
        
    # Create project
    project_doc = {
        "id": request.id,
        "name": request.name,
        "description": request.description,
        "dataset_id": request.dataset_id,
        "annotator_ids": request.annotator_ids,
        "schema": request.schema_config.dict()
    }
    
    DatabaseClient.create_project(request.id, project_doc)
    return {"status": "success", "project": project_doc}


@app.post("/api/upload_dataset")
async def upload_dataset(
    name: str = Form(...),
    file: UploadFile = File(...),
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    try:
        content = await file.read()
        conversations_data = json.loads(content.decode("utf-8"))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON file format: {e}")
        
    dataset_id = f"dataset_{uuid.uuid4().hex[:8]}"
    
    # Save dataset object
    dataset_doc = {
        "id": dataset_id,
        "name": name,
        "uploaded_at": datetime.utcnow().isoformat() + "Z",
        "uploaded_by": current_user["email"]
    }
    DatabaseClient.create_dataset(dataset_id, dataset_doc)
    
    # Parse conversations and utterances
    imported_conversations = []
    imported_utterances = []
    
    # Support multiple schemas in input JSON
    # Format 1: List of conversations: [{"id": "...", "title": "...", "utterances": [{"speaker": "...", "text": "..."}]}]
    # Format 2: Direct list of conversations as items
    if not isinstance(conversations_data, list):
        raise HTTPException(status_code=400, detail="Root element of dataset JSON must be a list of conversations")
        
    for idx_conv, conv in enumerate(conversations_data):
        conv_id = conv.get("conversation_id") or conv.get("id") or f"conv_{dataset_id}_{idx_conv}"
        conv_title = conv.get("title") or f"Conversation {idx_conv + 1}"
        
        imported_conversations.append({
            "id": conv_id,
            "dataset_id": dataset_id,
            "title": conv_title
        })
        
        utts = conv.get("utterances", [])
        for idx_utt, utt in enumerate(utts):
            utt_id = utt.get("utterance_id") or utt.get("id") or f"utt_{conv_id}_{idx_utt}"
            imported_utterances.append({
                "id": utt_id,
                "conversation_id": conv_id,
                "dataset_id": dataset_id,
                "speaker": utt.get("speaker", "user"),
                "index": idx_utt,
                "text": utt.get("text", ""),
                "should_annotate": utt.get("should_annotate", True)
            })
            
    if not imported_conversations:
        raise HTTPException(status_code=400, detail="No conversations found in the dataset file")
        
    # Save to DB
    DatabaseClient.create_conversations(imported_conversations)
    DatabaseClient.create_utterances(imported_utterances)
    
    return {
        "status": "success",
        "dataset_id": dataset_id,
        "dataset_name": name,
        "conversations_count": len(imported_conversations),
        "utterances_count": len(imported_utterances)
    }


@app.get("/api/export")
def export_annotations(
    project_id: str = Query(..., description="Project ID"),
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    project = DatabaseClient.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    dataset_id = project["dataset_id"]
    utterances = DatabaseClient.get_utterances_by_dataset(dataset_id)
    all_annotations = DatabaseClient.get_annotations_for_project(project_id)
    all_conv_annotations = DatabaseClient.get_conversation_annotations_for_project(project_id)
    
    # Group annotations by utterance_id
    ann_map = {}
    for a in all_annotations:
        utt_id = a["utterance_id"]
        if utt_id not in ann_map:
            ann_map[utt_id] = []
        ann_map[utt_id].append(a)
        
    # Group conversation annotations by (conversation_id, user_id)
    conv_ann_map = {}
    for ca in all_conv_annotations:
        key = (ca["conversation_id"], ca["user_id"])
        conv_ann_map[key] = ca
        
    export_records = []
    
    # We will export all annotations. For each user's annotation:
    for u in utterances:
        utt_anns = ann_map.get(u["id"], [])
        for ann in utt_anns:
            user_id = ann["user_id"]
            conv_id = u["conversation_id"]
            ca = conv_ann_map.get((conv_id, user_id), {})
            
            export_records.append({
                "annotator": user_id,
                "project_id": project_id,
                "conversation_id": conv_id,
                "conversation_level_annotation": {
                    "source_domain": ca.get("source_domain", ""),
                    "target_domain": ca.get("target_domain", ""),
                    "conceptual_metaphor": ca.get("conceptual_metaphor", ""),
                    "comment": ca.get("comment", ""),
                    "completed": ca.get("completed", False)
                },
                "utterance_id": u["id"],
                "speaker": u["speaker"],
                "text": u["text"],
                "metaphors": [
                    {
                        "start": m.get("start"),
                        "end": m.get("end"),
                        "text": m.get("text"),
                        "source_frame": m.get("source_frame", ""),
                        "target_frame": m.get("target_frame", ""),
                        "conceptual_metaphor": m.get("conceptual_metaphor", ""),
                        "interaction_function": m.get("interaction_function", ""),
                        "confidence": m.get("confidence"),
                        "comment": m.get("comment", "")
                    }
                    for m in ann.get("metaphors", [])
                ]
            })
            
    return export_records

# --- Serve Static Frontend Files ---
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path
import sys

if getattr(sys, "frozen", False):
    frontend_dist_path = Path(sys._MEIPASS) / "frontend" / "dist"
    if not frontend_dist_path.exists():
        frontend_dist_path = Path(sys._MEIPASS) / "_internal" / "frontend" / "dist"
else:
    frontend_dist_path = Path(__file__).resolve().parent.parent / "frontend" / "dist"

if frontend_dist_path.exists():
    app.mount("/assets", StaticFiles(directory=frontend_dist_path / "assets"), name="assets")
    
    @app.get("/{catchall:path}")
    async def serve_frontend(catchall: str):
        if catchall.startswith("api/"):
            raise HTTPException(status_code=404, detail="API route not found")
        index_file = frontend_dist_path / "index.html"
        if index_file.exists():
            return FileResponse(index_file)
        raise HTTPException(status_code=404, detail="Frontend build index.html not found")

if __name__ == "__main__":
    import uvicorn
    import os
    port = int(os.getenv("PORT", 8421))
    host = os.getenv("HOST", "127.0.0.1")
    uvicorn.run("backend.main:app" if not getattr(sys, "frozen", False) else "main:app", host=host, port=port, reload=False)
