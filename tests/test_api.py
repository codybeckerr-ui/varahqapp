import unittest
from fastapi.testclient import TestClient
from api.template import app
class AuthBoundaryTests(unittest.TestCase):
 def test_anonymous_request_is_rejected(self):
  r=TestClient(app).post('/api/template',json={'action':'compile','template_id':'23bc0fba-f241-4bd2-b287-5f9627108946'})
  self.assertEqual(r.status_code,403)
 def test_health_has_no_sensitive_configuration(self):
  r=TestClient(app).get('/api/template'); self.assertEqual(r.status_code,200)
  self.assertEqual(set(r.json()),{'service','version'})
