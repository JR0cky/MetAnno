import unittest
from fastapi.testclient import TestClient

from backend.main import app

class TestMetaphorAnnotationAPI(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.auth_headers = {}
        self.login_annotator()

    def login_annotator(self):
        # Authenticate as default annotator1
        response = self.client.post(
            "/api/auth/login",
            json={"email": "annotator1", "password": "password1231annotator1"}
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.token = data["access_token"]
        self.auth_headers = {"Authorization": f"Bearer {self.token}"}

    def test_health(self):
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "healthy")

    def test_get_projects(self):
        response = self.client.get("/api/projects", headers=self.auth_headers)
        self.assertEqual(response.status_code, 200)
        projects = response.json()
        self.assertGreater(len(projects), 0)
        self.assertEqual(projects[0]["id"], "proj_01")

    def test_get_project_schema(self):
        response = self.client.get("/api/projects/proj_01/schema", headers=self.auth_headers)
        self.assertEqual(response.status_code, 200)
        schema = response.json()
        self.assertIn("source_frames", schema)
        self.assertIn("target_frames", schema)
        self.assertIn("conceptual_metaphors", schema)
        self.assertIn("interaction_functions", schema)

    def test_get_utterances(self):
        response = self.client.get("/api/utterances?project_id=proj_01", headers=self.auth_headers)
        self.assertEqual(response.status_code, 200)
        utterances = response.json()
        self.assertGreater(len(utterances), 0)
        self.assertTrue(utterances[0]["conversation_id"].startswith("conv_"))

    def test_get_utterance_detail(self):
        # Fetch the first utterance ID
        utts_response = self.client.get("/api/utterances?project_id=proj_01", headers=self.auth_headers)
        utts = utts_response.json()
        self.assertGreater(len(utts), 1)
        utt_id = utts[1]["id"]
        
        response = self.client.get(f"/api/utterances/{utt_id}?project_id=proj_01", headers=self.auth_headers)
        self.assertEqual(response.status_code, 200)
        detail = response.json()
        self.assertIn("utterance", detail)
        self.assertIn("context", detail)
        self.assertIn("annotation", detail)
        self.assertEqual(detail["utterance"]["id"], utt_id)

    def test_save_identification_and_classification(self):
        # Fetch an utterance ID dynamically
        utts_response = self.client.get("/api/utterances?project_id=proj_01", headers=self.auth_headers)
        utts = utts_response.json()
        self.assertGreater(len(utts), 1)
        utt_id = utts[1]["id"]
        utt_text = utts[1]["text"]
        
        # 1. Save Metaphor Spans (Identification Stage)
        # We can use a simple span from the actual text or a dummy span since the model supports arbitrary spans.
        id_payload = {
            "project_id": "proj_01",
            "utterance_id": utt_id,
            "metaphors": [
                {"start": 0, "end": min(5, len(utt_text)), "text": utt_text[:min(5, len(utt_text))]}
            ],
            "identification_completed": True
        }
        id_res = self.client.post("/api/identification", json=id_payload, headers=self.auth_headers)
        self.assertEqual(id_res.status_code, 200)
        self.assertTrue(id_res.json()["annotation"]["identification_completed"])
        self.assertEqual(len(id_res.json()["annotation"]["metaphors"]), 1)
        
        # 2. Save Classification Properties (Classification Stage)
        class_payload = {
            "project_id": "proj_01",
            "utterance_id": utt_id,
            "metaphors": [
                {
                    "start": 0,
                    "end": min(5, len(utt_text)),
                    "text": utt_text[:min(5, len(utt_text))],
                    "source_frame": "machine",
                    "target_frame": "problem_solving",
                    "conceptual_metaphor": "A PROBLEM IS A LOOP",
                    "interaction_function": "Problem framing",
                    "confidence": 5,
                    "comment": "Perfect loop example."
                }
              ],
              "classification_completed": True
        }
        class_res = self.client.post("/api/classification", json=class_payload, headers=self.auth_headers)
        self.assertEqual(class_res.status_code, 200)
        self.assertTrue(class_res.json()["annotation"]["classification_completed"])
        self.assertEqual(class_res.json()["annotation"]["metaphors"][0]["source_frame"], "machine")

    def test_save_conversation_annotation(self):
        # Fetch an utterance to get its conversation ID dynamically
        utts_response = self.client.get("/api/utterances?project_id=proj_01", headers=self.auth_headers)
        utts = utts_response.json()
        self.assertGreater(len(utts), 0)
        conv_id = utts[0]["conversation_id"]
        
        # 1. Fetch default conversation annotation (should return successfully)
        get_res = self.client.get(f"/api/conversations/{conv_id}/annotation?project_id=proj_01", headers=self.auth_headers)
        self.assertEqual(get_res.status_code, 200)
        ann = get_res.json()
        self.assertEqual(ann["conversation_id"], conv_id)
        self.assertIn("source_domain", ann)
        
        # 2. Save conversation annotation
        save_payload = {
            "project_id": "proj_01",
            "conversation_id": conv_id,
            "source_domain": "WAR",
            "target_domain": "ARGUMENT",
            "conceptual_metaphor": "ARGUMENT IS WAR",
            "comment": "Nice session.",
            "completed": True
        }
        save_res = self.client.post("/api/conversations/annotation", json=save_payload, headers=self.auth_headers)
        self.assertEqual(save_res.status_code, 200)
        self.assertTrue(save_res.json()["annotation"]["completed"])
        self.assertEqual(save_res.json()["annotation"]["source_domain"], "WAR")
        
        # 3. Fetch again and confirm values persisted
        get_res2 = self.client.get(f"/api/conversations/{conv_id}/annotation?project_id=proj_01", headers=self.auth_headers)
        self.assertEqual(get_res2.status_code, 200)
        ann2 = get_res2.json()
        self.assertEqual(ann2["source_domain"], "WAR")
        self.assertEqual(ann2["target_domain"], "ARGUMENT")
        self.assertEqual(ann2["conceptual_metaphor"], "ARGUMENT IS WAR")
        self.assertEqual(ann2["comment"], "Nice session.")
        self.assertTrue(ann2["completed"])

    def test_progress_tracking(self):
        response = self.client.get("/api/progress?project_id=proj_01", headers=self.auth_headers)
        self.assertEqual(response.status_code, 200)
        progress = response.json()
        self.assertIn("identification_progress", progress)
        self.assertIn("classification_progress", progress)
        self.assertIn("completed_count", progress)
        self.assertIn("remaining_count", progress)

    def test_admin_export_restriction_and_success(self):
        # 1. Attempt export as regular annotator (should fail with 403)
        err_res = self.client.get("/api/export?project_id=proj_01", headers=self.auth_headers)
        self.assertEqual(err_res.status_code, 403)
        
        # 2. Authenticate as admin
        admin_login = self.client.post(
            "/api/auth/login",
            json={"email": "admin", "password": "password123"}
        )
        self.assertEqual(admin_login.status_code, 200)
        admin_token = admin_login.json()["access_token"]
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        
        # 3. Export project annotations (should succeed)
        export_res = self.client.get("/api/export?project_id=proj_01", headers=admin_headers)
        self.assertEqual(export_res.status_code, 200)
        self.assertIsInstance(export_res.json(), list)

if __name__ == "__main__":
    unittest.main()
